from PIL import Image, ImageStat
import sys
from collections import Counter

src = r"assets/galstian-logo.png"
out = r"assets/galstian-logo.png"  # overwrite original with transparent version
out_copy = r"assets/galstian-logo-transparent.png"

im = Image.open(src).convert("RGBA")
px = im.load()
w,h = im.size

# Sample border pixels to guess background color
border_pixels = []
for x in range(w):
    border_pixels.append(px[x,0][:3])
    border_pixels.append(px[x,h-1][:3])
for y in range(h):
    border_pixels.append(px[0,y][:3])
    border_pixels.append(px[w-1,y][:3])

# Find most common color
most_common = Counter(border_pixels).most_common(1)[0][0]
bg = most_common

# create new image with alpha where pixels similar to bg become transparent
threshold = 60  # color distance threshold; tweak if needed

def color_dist(c1,c2):
    return sum((a-b)**2 for a,b in zip(c1,c2))**0.5

new = Image.new("RGBA", (w,h))
data = []
for y in range(h):
    for x in range(w):
        r,g,b,a = px[x,y]
        if color_dist((r,g,b), bg) < threshold:
            data.append((r,g,b,0))
        else:
            data.append((r,g,b,a))
new.putdata(data)

# save outputs
new.save(out_copy)
new.save(out)

# also write base64 file
import base64
with open(out, "rb") as f:
    b = base64.b64encode(f.read()).decode('ascii')
with open(r"assets/galstian-logo.b64","w",encoding='ascii') as f:
    f.write(b)

print("TRANSPARENT_DONE", out, out_copy)
