"""Slice a tall full-page screenshot into viewable panels: python3 slice.py <png> <outdir> [chunk_px] [scale]"""
import sys
from pathlib import Path
from PIL import Image
src, out = Path(sys.argv[1]), Path(sys.argv[2])
chunk = int(sys.argv[3]) if len(sys.argv) > 3 else 1600
scale = float(sys.argv[4]) if len(sys.argv) > 4 else 0.6
out.mkdir(parents=True, exist_ok=True)
im = Image.open(src).convert('RGB')
n = 0
for y in range(0, im.height, chunk):
    c = im.crop((0, y, im.width, min(im.height, y + chunk)))
    c = c.resize((int(c.width * scale), int(c.height * scale)))
    c.save(out / f'{src.stem}-{n:02d}.jpg', quality=82); n += 1
print(im.size, n)
