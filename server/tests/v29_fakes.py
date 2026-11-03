"""V29 test doubles: a fake clamd that speaks the real INSTREAM wire protocol over a unix socket, so the scanner client is
exercised byte-for-byte without a 1 GB ClamAV daemon in the suite. `docs/qa/v29/security/clamd-eicar.txt` records the
same client against the real daemon."""
import os
import socket
import struct
import tempfile
import threading

EICAR = b"X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*"


class FakeClamd:
    """mode: "ok" (FOUND only for EICAR), "error" (protocol ERROR reply), "down" (socket closed)."""

    def __init__(self, mode: str = "ok"):
        self.mode = mode
        self.path = os.path.join(tempfile.mkdtemp(prefix="fake-clamd-"), "clamd.sock")
        self.sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        self.sock.bind(self.path)
        self.sock.listen(8)
        self.scanned = 0
        self._t = threading.Thread(target=self._serve, daemon=True)
        self._t.start()

    def _serve(self):
        while True:
            try:
                conn, _ = self.sock.accept()
            except OSError:
                return
            with conn:
                try:
                    self._handle(conn)
                except OSError:
                    pass

    @staticmethod
    def _recv_exact(conn, n):
        buf = b""
        while len(buf) < n:
            part = conn.recv(n - len(buf))
            if not part:
                raise OSError("eof")
            buf += part
        return buf

    def _handle(self, conn):
        cmd = b""
        while not cmd.endswith(b"\0"):
            cmd += self._recv_exact(conn, 1)
        if cmd == b"zPING\0":
            conn.sendall(b"PONG\0")
            return
        assert cmd == b"zINSTREAM\0", cmd
        data = b""
        while True:
            (n,) = struct.unpack(">I", self._recv_exact(conn, 4))
            if n == 0:
                break
            data += self._recv_exact(conn, n)
        self.scanned += 1
        if self.mode == "error":
            conn.sendall(b"INSTREAM size limit exceeded. ERROR\0")
        elif EICAR in data:
            conn.sendall(b"stream: Eicar-Test-Signature FOUND\0")
        else:
            conn.sendall(b"stream: OK\0")

    def close(self):
        self.sock.close()


def pdf(body: bytes = b"hello") -> bytes:
    return b"%PDF-1.4\n" + body + b"\n%%EOF\n"
