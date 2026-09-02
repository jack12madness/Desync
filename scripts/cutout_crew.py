from rembg import remove
from PIL import Image

src = Image.open("/app/assets/hero-crew-upscaled.png").convert("RGB")
out = remove(src)
out.save("/app/frontend/public/images/hero-crew.png")
print("cutout saved:", out.size, out.mode, flush=True)
