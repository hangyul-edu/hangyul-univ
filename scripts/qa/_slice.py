# Slice a tall screenshot into half-scale chunks for manual review: python3 scripts/qa/_slice.py in.png outprefix [step]
import sys
from PIL import Image
im=Image.open(sys.argv[1]); step=int(sys.argv[3]) if len(sys.argv)>3 else 2400
w,h=im.size; s=2 if w>800 else 1
for i,y in enumerate(range(0,h,step)):
    c=im.crop((0,y,w,min(h,y+step))); c=c.resize((c.width//s,c.height//s)); c.save(f'{sys.argv[2]}-{i}.png')
print(h, (h+step-1)//step)
