"""V29 — verify S3Storage against a real S3-compatible endpoint (MinIO in QA). Prints evidence; never prints secrets.

    HG_S3_ENDPOINT_URL=http://127.0.0.1:9000 HG_S3_BUCKET=… HG_S3_ACCESS_KEY_ID=… HG_S3_SECRET_ACCESS_KEY=… \
        .venv/bin/python -m scripts.v29_s3_verify
"""
import json
import sys

import httpx

from app.core.config import get_settings
from app.core.storage import S3Storage


def main() -> int:
    s = get_settings()
    st = S3Storage()
    c = st.client
    print(f"endpoint={s.s3_endpoint_url} bucket={st.bucket} sse={st.sse} prefix={st.prefix or '-'}")
    try:
        enc = c.get_bucket_encryption(Bucket=st.bucket)["ServerSideEncryptionConfiguration"]["Rules"][0]["ApplyServerSideEncryptionByDefault"]
        print("bucket default encryption:", json.dumps(enc))
    except Exception as exc:  # noqa: BLE001
        print("bucket default encryption: none", type(exc).__name__)
    try:
        print("bucket policy:", c.get_bucket_policy(Bucket=st.bucket)["Policy"])
    except Exception as exc:  # noqa: BLE001
        print("bucket policy: none (private by default)", type(exc).__name__)
    body = b"%PDF-1.4\nv29 private object\n%%EOF\n"
    key = st.put(body, prefix="v29-verify/students/demo")
    print("put key:", key)
    h = st.head(key)
    print("head: ServerSideEncryption=%s CacheControl=%s ContentType=%s ContentDisposition=%s" % (
        h.get("ServerSideEncryption"), h.get("CacheControl"), h.get("ContentType"), h.get("ContentDisposition")))
    got = st.get(key)
    print("get via adapter: bytes_match=%s" % (got == body))
    full = f"{st.prefix}/{key}" if st.prefix else key
    anon = httpx.get(f"{s.s3_endpoint_url.rstrip('/')}/{st.bucket}/{full}", timeout=10)
    print(f"anonymous GET object -> HTTP {anon.status_code} ({'denied' if anon.status_code in (401, 403) else 'ALLOWED!'})")
    lst = httpx.get(f"{s.s3_endpoint_url.rstrip('/')}/{st.bucket}?list-type=2", timeout=10)
    print(f"anonymous LIST bucket -> HTTP {lst.status_code} ({'denied' if lst.status_code in (401, 403) else 'ALLOWED!'})")
    url = c.generate_presigned_url("get_object", Params={"Bucket": st.bucket, "Key": full}, ExpiresIn=60)
    pre = httpx.get(url, timeout=10)
    print(f"presigned GET (60 s, server-side only; not used by the app) -> HTTP {pre.status_code}")
    st.delete(key)
    try:
        st.get(key)
        gone = False
    except c.exceptions.NoSuchKey:
        gone = True
    print("delete via adapter: object gone=%s" % gone)
    ok = got == body and anon.status_code in (401, 403) and lst.status_code in (401, 403) and gone and h.get("ServerSideEncryption") == st.sse
    print("RESULT:", "PASS" if ok else "FAIL")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
