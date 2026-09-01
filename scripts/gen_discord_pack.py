import os
from PIL import Image, ImageDraw, ImageFilter, ImageFont

FONT_BOLD = "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"
FONT_REG = "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"

NAVY = (5, 11, 24)
NAVY2 = (13, 32, 72)
BLUE = (46, 107, 255)
BLUE_L = (143, 184, 240)
WHITE = (241, 245, 249)
GRAY = (148, 163, 184)

OUT_DIR = "/app/assets/discord-pack"
SS = 2  # supersample


def vgrad(size, top, bottom):
    w, h = size
    img = Image.new("RGB", (1, h))
    for y in range(h):
        t = y / max(h - 1, 1)
        img.putpixel((0, y), tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3)))
    return img.resize((w, h))


def glow_blob(img, center, radius, color, alpha, blur):
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    x, y = center
    d.ellipse([x - radius, y - radius, x + radius, y + radius], fill=color + (alpha,))
    layer = layer.filter(ImageFilter.GaussianBlur(blur))
    img.alpha_composite(layer)


def d_mask(size):
    """Glitch-split D mask (white on black), relative geometry."""
    S = size
    m = Image.new("L", (S, S), 0)

    def draw_d(dd):
        dd.rectangle([0.28 * S, 0.19 * S, 0.55 * S, 0.81 * S], fill=255)
        dd.pieslice([0.55 * S - 0.31 * S, 0.19 * S, 0.55 * S + 0.31 * S, 0.81 * S], -90, 90, fill=255)
        dd.rectangle([0.39 * S, 0.28 * S, 0.52 * S, 0.72 * S], fill=0)
        dd.pieslice([0.52 * S - 0.22 * S, 0.28 * S, 0.52 * S + 0.22 * S, 0.72 * S], -90, 90, fill=0)

    full = Image.new("L", (S, S), 0)
    draw_d(ImageDraw.Draw(full))
    split_top = int(0.46 * S)
    split_bot = int(0.50 * S)
    shift = int(0.055 * S)
    m.paste(full.crop((0, 0, S, split_top)), (shift, 0))
    m.paste(full.crop((0, split_bot, S, S)), (-shift, split_bot))
    return m


def d_mark(size):
    """RGBA glitch D with blue gradient + glow."""
    S = size * SS
    mask = d_mask(S)
    grad = vgrad((S, S), BLUE_L, BLUE).convert("RGBA")
    mark = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    mark.paste(grad, (0, 0), mask)
    glow = Image.new("RGBA", (S, S), BLUE + (140,))
    glow.putalpha(mask)
    glow = glow.filter(ImageFilter.GaussianBlur(S // 26))
    out = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    out.alpha_composite(glow)
    out.alpha_composite(mark)
    return out.resize((size, size), Image.LANCZOS)


def grid(img, step, color=(46, 107, 255, 14)):
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    w, h = img.size
    for x in range(0, w, step):
        d.line([(x, 0), (x, h)], fill=color, width=1)
    for y in range(0, h, step):
        d.line([(0, y), (w, y)], fill=color, width=1)
    img.alpha_composite(layer)


def tracked_text(d, xy, text, font, fill, tracking=0):
    x, y = xy
    for ch in text:
        d.text((x, y), ch, font=font, fill=fill)
        x += d.textlength(ch, font=font) + tracking
    return x


def save(img, name, final_size):
    img = img.resize(final_size, Image.LANCZOS).convert("RGB")
    img.save(os.path.join(OUT_DIR, name), "PNG")
    print("saved", name, final_size)


def avatar():
    S = 512 * SS
    img = vgrad((S, S), (10, 22, 40), NAVY).convert("RGBA")
    glow_blob(img, (S // 2, S // 2), int(S * 0.42), BLUE, 60, S // 10)
    mark = d_mark(int(S * 0.62))
    img.alpha_composite(mark, ((S - mark.width) // 2, (S - mark.height) // 2))
    save(img, "desync-avatar-512.png", (512, 512))


def banner():
    W, H = 960 * SS, 540 * SS
    img = vgrad((W, H), NAVY2, NAVY).convert("RGBA")
    grid(img, 40 * SS)
    glow_blob(img, (int(W * 0.28), int(H * 0.5)), int(H * 0.75), BLUE, 70, H // 5)
    mark = d_mark(int(H * 0.66))
    img.alpha_composite(mark, (int(W * 0.08), (H - mark.height) // 2))
    d = ImageDraw.Draw(img)
    f_word = ImageFont.truetype(FONT_BOLD, int(96 * SS))
    f_tag = ImageFont.truetype(FONT_REG, int(22 * SS))
    x0 = int(W * 0.08) + mark.width + int(30 * SS)
    y0 = int(H * 0.36)
    x = d.text((x0, y0), "De", font=f_word, fill=WHITE)
    x = x0 + d.textlength("De", font=f_word)
    d.text((x, y0), "sync", font=f_word, fill=BLUE)
    tracked_text(d, (x0 + 4, y0 + int(112 * SS)), "UNDETECTED. UNMATCHED.", f_tag, GRAY, tracking=4 * SS)
    save(img, "desync-banner-960x540.png", (960, 540))


def welcome():
    W, H = 1920 * SS, 640 * SS
    img = vgrad((W, H), (10, 22, 40), NAVY).convert("RGBA")
    grid(img, 48 * SS)
    glow_blob(img, (int(W * 0.8), int(H * 0.5)), int(H * 0.9), BLUE, 80, H // 4)
    glow_blob(img, (int(W * 0.15), int(H * 0.2)), int(H * 0.6), BLUE, 40, H // 4)
    mark = d_mark(int(H * 0.72))
    img.alpha_composite(mark, (int(W * 0.76), (H - mark.height) // 2))
    d = ImageDraw.Draw(img)
    f_pre = ImageFont.truetype(FONT_REG, int(30 * SS))
    f_big = ImageFont.truetype(FONT_BOLD, int(120 * SS))
    f_sub = ImageFont.truetype(FONT_REG, int(32 * SS))
    x0 = int(W * 0.07)
    tracked_text(d, (x0, int(H * 0.24)), "W E L C O M E   T O", f_pre, BLUE_L, tracking=2 * SS)
    d.text((x0 - 4, int(H * 0.32)), "DESYNC", font=f_big, fill=WHITE)
    d.text((x0, int(H * 0.62)), "Undetected cheats for FiveM, Rust, Warzone & more.", font=f_sub, fill=GRAY)
    d.text((x0, int(H * 0.72)), "Grab your key in the shop - status page always honest.", font=f_sub, fill=GRAY)
    save(img, "desync-welcome-1920x640.png", (1920, 640))


if __name__ == "__main__":
    os.makedirs(OUT_DIR, exist_ok=True)
    avatar()
    banner()
    welcome()
    print("done ->", OUT_DIR)
