"""Private object storage abstraction + upload validation. Files are never served from a public path."""
import hashlib
import socket
import struct
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

from fastapi import HTTPException, status

from app.core.config import get_settings

settings = get_settings()

# Magic-byte sniffing: the client-declared Content-Type is not trusted.
SIGNATURES: list[tuple[bytes, int, str]] = [
    (b"%PDF-", 0, "application/pdf"),
    (b"\x89PNG\r\n\x1a\n", 0, "image/png"),
    (b"\xff\xd8\xff", 0, "image/jpeg"),
    (b"WEBP", 8, "image/webp"),
]
ALLOWED_MIME = {"application/pdf", "image/png", "image/jpeg", "image/webp"}


def sniff_mime(data: bytes) -> str | None:
    for sig, offset, mime in SIGNATURES:
        if data[offset : offset + len(sig)] == sig:
            if mime == "image/webp" and data[:4] != b"RIFF":
                continue
            return mime
    return None


def validate_upload(data: bytes, filename: str) -> str:
    limit = settings.max_upload_mb * 1024 * 1024
    if len(data) == 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "The file is empty.")
    if len(data) > limit:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, f"Files must be {settings.max_upload_mb} MB or smaller.")
    mime = sniff_mime(data)
    if mime not in ALLOWED_MIME:
        raise HTTPException(
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "Upload a PDF, JPG, PNG or WEBP file."
        )
    if "/" in filename or "\\" in filename or len(filename) > 255:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid file name.")
    if looks_truncated(data, mime):
        # V9 reliability: an interrupted upload arrives as a cut-off file. Refuse it before anything is stored, so no
        # half-written version ever replaces a good one.
        raise HTTPException(422, "This file looks incomplete — the upload may have been interrupted. Please upload it again.")
    return mime


def looks_truncated(data: bytes, mime: str) -> bool:
    """A PDF must end with its %%EOF marker (allowing trailing whitespace/junk in the last 2 KB, as real writers produce);
    a PNG must contain its IEND chunk near the end. Other formats are not checked (no reliable end marker)."""
    if mime == "application/pdf":
        return b"%%EOF" not in data[-2048:]
    if mime == "image/png":
        return b"IEND" not in data[-64:]
    return False


class Storage(Protocol):
    def put(self, data: bytes, *, prefix: str) -> str: ...
    def get(self, key: str) -> bytes: ...
    def delete(self, key: str) -> None: ...


class LocalStorage:
    def __init__(self, root: Path):
        self.root = root
        self.root.mkdir(parents=True, exist_ok=True)

    def _path(self, key: str) -> Path:
        p = (self.root / key).resolve()
        if not str(p).startswith(str(self.root.resolve())):
            raise ValueError("invalid key")
        return p

    def put(self, data: bytes, *, prefix: str) -> str:
        key = f"{prefix}/{uuid.uuid4().hex}"
        path = self._path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        return key

    def get(self, key: str) -> bytes:
        return self._path(key).read_bytes()

    def delete(self, key: str) -> None:
        self._path(key).unlink(missing_ok=True)


class S3Storage:
    """S3 / S3-compatible (MinIO) private object storage (V29).

    * The bucket is private: objects are written with no ACL and read back only by this server, which streams them
      through the authorised, HMAC-signed `/files/{token}` route — the signed-URL authorisation model is unchanged
      and no object URL is ever handed to a browser.
    * Server-side encryption on every PUT: `AES256` (SSE-S3) or `aws:kms` (+ `HG_S3_KMS_KEY_ID`). A bucket default
      encryption policy should also be set (`scripts/ops/s3-bucket-policy.json`); the per-request header makes the
      guarantee independent of it.
    * `Cache-Control: private, no-store` and a neutral content type on the object, so a misconfigured CDN or a
      direct GET cannot cache or render it.
    * Least privilege: the server's credentials need `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject` on
      `arn:aws:s3:::<bucket>/<prefix>*` and nothing else (no `ListBucket`, no `PutBucketPolicy`, no ACL actions).
    """

    def __init__(self, *, bucket: str | None = None, client=None) -> None:
        s = get_settings()
        self.bucket = bucket or s.s3_bucket
        if not self.bucket:
            raise RuntimeError("HG_S3_BUCKET is required when HG_STORAGE_BACKEND=s3.")
        self.prefix = (s.s3_key_prefix or "").strip("/")
        self.sse = s.s3_sse
        self.kms_key_id = s.s3_kms_key_id
        if s.is_production and self.sse not in ("AES256", "aws:kms"):
            raise RuntimeError("Production requires server-side encryption (HG_S3_SSE=AES256 or aws:kms).")
        if client is None:
            import boto3
            from botocore.config import Config

            kw = {"region_name": s.s3_region, "config": Config(signature_version="s3v4", retries={"max_attempts": 3, "mode": "standard"},
                                                              s3={"addressing_style": "path" if s.s3_endpoint_url else "auto"})}
            if s.s3_endpoint_url:
                kw["endpoint_url"] = s.s3_endpoint_url
            if s.s3_access_key_id and s.s3_secret_access_key:
                kw["aws_access_key_id"], kw["aws_secret_access_key"] = s.s3_access_key_id, s.s3_secret_access_key
            client = boto3.client("s3", **kw)
        self.client = client

    def _key(self, key: str) -> str:
        if not key or ".." in key.split("/") or key.startswith("/"):
            raise ValueError("invalid key")
        return f"{self.prefix}/{key}" if self.prefix else key

    def put(self, data: bytes, *, prefix: str) -> str:
        key = f"{prefix}/{uuid.uuid4().hex}"
        extra: dict = {"CacheControl": "private, no-store", "ContentType": "application/octet-stream", "ContentDisposition": "attachment"}
        if self.sse == "aws:kms":
            extra["ServerSideEncryption"] = "aws:kms"
            if self.kms_key_id:
                extra["SSEKMSKeyId"] = self.kms_key_id
        elif self.sse == "AES256":
            extra["ServerSideEncryption"] = "AES256"
        self.client.put_object(Bucket=self.bucket, Key=self._key(key), Body=data, **extra)
        return key

    def get(self, key: str) -> bytes:
        return self.client.get_object(Bucket=self.bucket, Key=self._key(key))["Body"].read()

    def delete(self, key: str) -> None:
        self.client.delete_object(Bucket=self.bucket, Key=self._key(key))

    def head(self, key: str) -> dict:
        return self.client.head_object(Bucket=self.bucket, Key=self._key(key))


# ------------------------------------------------------------------------------------------------ malware scanning
#
# Scan states recorded on every DocumentVersion / MessageAttachment:
#   PENDING   stored privately, not yet scanned (or the scanner was unreachable — the worker retries)
#   ERROR     the scanner answered with an error; retried by the worker
#   CLEAN     scanned, nothing found → the document becomes reviewable / downloadable
#   INFECTED  signature found → bytes deleted from storage, version kept as a blocked record, audited, never served
#   SKIPPED   the no-op development scanner; refused in production at start-up
CLEAN, INFECTED, ERROR, PENDING, SKIPPED = "CLEAN", "INFECTED", "ERROR", "PENDING", "SKIPPED"
SERVABLE_SCAN_STATES = {CLEAN, SKIPPED}


class ScannerError(RuntimeError):
    """The scanner could not give a verdict (unreachable, timeout, protocol error, size limit)."""


@dataclass(frozen=True)
class ScanResult:
    status: str  # CLEAN | INFECTED | SKIPPED
    signature: str | None = None


class MalwareScanner(Protocol):
    def scan(self, data: bytes) -> str: ...


class NoopScanner:
    """Development scanner: records SKIPPED. Production refuses to start with it (`config.v29_production_violations`)."""

    name = "noop"

    def scan(self, data: bytes) -> str:
        return SKIPPED

    def scan_result(self, data: bytes) -> ScanResult:
        return ScanResult(SKIPPED)


class ClamdScanner:
    """ClamAV daemon client speaking the INSTREAM protocol directly over a unix socket or TCP (no extra dependency).

    Protocol: send `zINSTREAM\0`, then chunks of `<4-byte big-endian length><bytes>`, then a zero-length chunk;
    clamd replies `stream: OK`, `stream: <Signature> FOUND`, or `... ERROR` (e.g. `INSTREAM size limit exceeded`).
    """

    name = "clamd"
    CHUNK = 64 * 1024

    def __init__(self, *, socket_path: str | None = None, host: str | None = None, port: int = 3310, timeout: float = 30.0):
        if not socket_path and not host:
            raise RuntimeError("ClamdScanner needs HG_CLAMD_SOCKET or HG_CLAMD_HOST.")
        self.socket_path, self.host, self.port, self.timeout = socket_path, host, port, timeout

    def _connect(self) -> socket.socket:
        try:
            if self.socket_path:
                s = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
                s.settimeout(self.timeout)
                s.connect(self.socket_path)
            else:
                s = socket.create_connection((self.host, self.port), timeout=self.timeout)
                s.settimeout(self.timeout)
            return s
        except OSError as exc:
            raise ScannerError(f"clamd unreachable: {exc.__class__.__name__}") from None

    def _command(self, cmd: bytes) -> str:
        with self._connect() as s:
            s.sendall(b"z" + cmd + b"\0")
            return self._read(s)

    @staticmethod
    def _read(s: socket.socket) -> str:
        buf = b""
        while not buf.endswith(b"\0"):
            part = s.recv(4096)
            if not part:
                break
            buf += part
        return buf.rstrip(b"\0").decode("utf-8", "replace").strip()

    def ping(self) -> bool:
        try:
            return self._command(b"PING") == "PONG"
        except (ScannerError, OSError):
            return False

    def version(self) -> str:
        return self._command(b"VERSION")

    def scan_result(self, data: bytes) -> ScanResult:
        try:
            with self._connect() as s:
                s.sendall(b"zINSTREAM\0")
                for i in range(0, len(data), self.CHUNK):
                    chunk = data[i : i + self.CHUNK]
                    s.sendall(struct.pack(">I", len(chunk)) + chunk)
                s.sendall(struct.pack(">I", 0))
                reply = self._read(s)
        except ScannerError:
            raise
        except OSError as exc:
            raise ScannerError(f"clamd I/O failed: {exc.__class__.__name__}") from None
        # "stream: OK" | "stream: Eicar-Test-Signature FOUND" | "INSTREAM size limit exceeded. ERROR"
        if reply.endswith("FOUND"):
            sig = reply.split(":", 1)[-1].strip()[: -len("FOUND")].strip()
            return ScanResult(INFECTED, sig or "unknown")
        if reply.endswith("OK"):
            return ScanResult(CLEAN)
        raise ScannerError(f"clamd error: {reply[:120]}")

    def scan(self, data: bytes) -> str:
        return self.scan_result(data).status


_storage: Storage | None = None
_scanner = None


def get_storage() -> Storage:
    global _storage
    if _storage is None:
        s = get_settings()
        if s.storage_backend == "s3":
            _storage = S3Storage()
        elif s.is_production:
            raise RuntimeError("HG_STORAGE_BACKEND=local is refused in production.")  # fail closed
        else:
            _storage = LocalStorage(s.storage_path)
    return _storage


def get_scanner():
    global _scanner
    if _scanner is None:
        s = get_settings()
        if s.malware_scanner == "clamd":
            _scanner = ClamdScanner(socket_path=s.clamd_socket, host=s.clamd_host, port=s.clamd_port, timeout=s.clamd_timeout_seconds)
        elif s.is_production:
            raise RuntimeError("The no-op malware scanner is refused in production.")  # fail closed
        else:
            _scanner = NoopScanner()
    return _scanner


def scan_bytes(data: bytes) -> tuple[str, str | None]:
    """(status, signature) — CLEAN / INFECTED / SKIPPED, or ERROR when the scanner could not decide."""
    try:
        r = get_scanner().scan_result(data)
        return r.status, r.signature
    except ScannerError as exc:
        from app.services import monitoring

        monitoring.record("SCAN_ERROR", "malware_scanner", str(exc)[:200], severity="warning")
        return ERROR, None


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()
