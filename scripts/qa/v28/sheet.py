"""Contact sheet: python3 scripts/qa/v28/sheet.py <out.png> <col_width> <img...> — labels each tile with its file name."""
import sys
from PIL import Image, ImageDraw
out, cw, files = sys.argv[1], int(sys.argv[2]), sys.argv[3:]
tiles = []
for f in files:
    im = Image.open(f).convert('RGB')
    r = cw / im.width
    im = im.resize((cw, int(im.height * r)))
    lab = Image.new('RGB', (cw, 18), 'white'); ImageDraw.Draw(lab).text((4, 3), f.split('/')[-1], fill='black')
    t = Image.new('RGB', (cw, im.height + 18), 'white'); t.paste(lab, (0, 0)); t.paste(im, (0, 18)); tiles.append(t)
cols = min(len(tiles), int(sys.argv[4]) if False else 3)
rows = [tiles[i:i + cols] for i in range(0, len(tiles), cols)]
H = sum(max(t.height for t in row) for row in rows)
sheet = Image.new('RGB', (cw * cols + 8 * (cols - 1), H + 8 * len(rows)), (200, 200, 200))
y = 0
for row in rows:
    x = 0
    for t in row:
        sheet.paste(t, (x, y)); x += cw + 8
    y += max(t.height for t in row) + 8
sheet.save(out)
