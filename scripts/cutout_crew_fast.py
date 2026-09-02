import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

src = Image.open("/app/assets/hero-crew-upscaled.png").convert("RGB")
a = np.array(src)
h, w, _ = a.shape

near_white = (a[..., 0] > 232) & (a[..., 1] > 232) & (a[..., 2] > 232)
labels, n = ndimage.label(near_white)
border_labels = set(np.unique(np.concatenate([labels[0, :], labels[-1, :], labels[:, 0], labels[:, -1]])))
border_labels.discard(0)
bg = np.isin(labels, list(border_labels))

out = np.dstack([a, np.full((h, w), 255, dtype=np.uint8)])
out[..., 3][bg] = 0

mask = out[..., 3] > 0
mask = ndimage.binary_erosion(mask, iterations=2)
out[..., 3][~mask] = 0

img = Image.fromarray(out, "RGBA")
alpha = img.getchannel("A").filter(ImageFilter.GaussianBlur(1.4))
img.putalpha(alpha)
img.save("/app/frontend/public/images/hero-crew.png")
print("saved", img.size, img.mode, "| bg fraction:", round(bg.mean(), 2), flush=True)
