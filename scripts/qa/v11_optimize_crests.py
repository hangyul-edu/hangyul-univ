"""V11 — shrink the owner-supplied university crests for a 100 px-tall logo band.

Two of the 23 crests ship a full-resolution photograph base64-embedded inside the SVG (Yonsei a JPEG, Ewha a
PNG): 626 KB and 541 KB of raster that renders into a 100 px box, and base64 does not gzip away. A third is
heavy vector with 9-decimal coordinates. Nothing in the drawing changes — only the resolution it is stored at
and the precision of the numbers.

    python3 -I scripts/qa/v11_optimize_crests.py [--check]
"""
import base64, io, re, sys
from pathlib import Path
from PIL import Image

DST = Path("apps/marketing-web/public/media/universities")
TARGET_H = 240          # 2.4x the 100 px render height, so it stays crisp on a 2x display
RASTER = re.compile(rb'data:image/(png|jpeg|jpg);base64,([A-Za-z0-9+/=]+)')


def shrink_raster(blob: bytes) -> bytes:
    """Re-encode one embedded raster at TARGET_H, keeping its alpha channel if it had one."""
    def repl(m):
        kind, b64 = m.group(1).decode(), m.group(2)
        im = Image.open(io.BytesIO(base64.b64decode(b64)))
        if im.height <= TARGET_H:
            return m.group(0)
        w = max(1, round(im.width * TARGET_H / im.height))
        im = im.convert("RGBA" if im.mode in ("RGBA", "LA", "P") else "RGB").resize((w, TARGET_H), Image.LANCZOS)
        buf = io.BytesIO()
        # WebP carries alpha and beats both source formats at this size; every target browser supports it.
        im.save(buf, "WEBP", quality=88, method=6)
        return b"data:image/webp;base64," + base64.b64encode(buf.getvalue())
    return RASTER.sub(repl, blob)


def trim_precision(text: str) -> str:
    """Round long path coordinates — but ONLY those at or above 1.

    Figma writes patterns in `objectBoundingBox` units, where the whole transform is legitimately tiny:
    `matrix(0.00028 0 0 0.00029 -0.0001 0)`. Rounding those to 2 decimals produces `matrix(0 0 0 0 0 0)`, a
    zero-scale matrix, and the crest silently renders as nothing — which is exactly what happened to the Yonsei
    and Ewha marks the first time this ran. Values below 1 are therefore left completely alone; a coordinate of
    64.123456789 on a 64-unit artboard is the only kind that is safe to shorten.
    """
    return re.sub(r'\b([1-9]\d*\.\d{3,})', lambda m: f"{float(m.group(1)):.2f}".rstrip('0').rstrip('.'), text)


def main() -> int:
    check = "--check" in sys.argv
    before = after = 0
    for f in sorted(DST.glob("u-*.svg")):
        raw = f.read_bytes()
        before += len(raw)
        out = shrink_raster(raw)
        out = trim_precision(out.decode("utf-8", "surrogateescape")).encode("utf-8", "surrogateescape")
        out = re.sub(rb">\s+<", b"><", out).strip()
        after += len(out)
        if not check and out != raw:
            f.write_bytes(out)
    print(f"crests: {before/1024:.0f} KB -> {after/1024:.0f} KB ({'would be ' if check else ''}{100 - after*100//before}% smaller)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
