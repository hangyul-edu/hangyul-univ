"""V25 — contact sheet of every film-led institution's YouTube poster, for a person to classify (REPORT §312 D2).
    python3 scripts/universities/v25-poster-sheet.py <out-dir>
Writes sheet-NN.jpg and index.json (n → slug, video_id). Classification is recorded separately (poster-review.json)."""
import io, json, sys, time, urllib.request
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
ROOT = Path(__file__).resolve().parents[2]
out = Path(sys.argv[1]); out.mkdir(parents=True, exist_ok=True)
content = json.loads((ROOT / 'server/app/data/university_content.json').read_text())['records']
items = [(s, r['youtube']['video_id']) for s, r in sorted(content.items())
         if not (r.get('media') or {}).get('hero') and (r.get('youtube') or {}).get('video_id')]
font = ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc', 15)
index, tw, th, cols, per = {}, 400, 225, 5, 20
for s0 in range(0, len(items), per):
    batch = items[s0:s0 + per]
    sheet = Image.new('RGB', (cols * (tw + 8), ((len(batch) + cols - 1) // cols) * (th + 26)), 'white')
    d = ImageDraw.Draw(sheet)
    for j, (slug, vid) in enumerate(batch):
        n = s0 + j
        try:
            b = urllib.request.urlopen(urllib.request.Request(f'https://i.ytimg.com/vi/{vid}/hqdefault.jpg', headers={'User-Agent': 'HangyulUniv-media/1.0'}), timeout=30).read()
            im = Image.open(io.BytesIO(b)).convert('RGB')
            im = im.crop((0, 45, 480, 315))  # hqdefault is letterboxed 4:3 around a 16:9 frame
        except Exception:
            im = Image.new('RGB', (tw, th), 'gray')
        im = im.resize((tw, th))
        x, y = (j % cols) * (tw + 8), (j // cols) * (th + 26)
        sheet.paste(im, (x, y)); d.rectangle([x, y, x + 40, y + 20], fill='black'); d.text((x + 3, y + 1), str(n), fill='yellow', font=font)
        d.text((x, y + th + 3), slug[:44], fill='black', font=font)
        index[n] = {'slug': slug, 'video_id': vid}
        time.sleep(0.2)
    sheet.save(out / f'sheet-{s0 // per:02d}.jpg', quality=80)
(out / 'index.json').write_text(json.dumps(index, indent=1))
print(len(items))
