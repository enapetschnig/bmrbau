#!/usr/bin/env python3
"""
Generates PWA icons for Schafferhofer Bau.
Design: White background, bold red "S" centered.
Brand color: #d80b05
"""

from PIL import Image, ImageDraw, ImageFont
import os
import shutil

BRAND_RED = (216, 11, 5)
WHITE = (255, 255, 255)
PUBLIC_DIR = os.path.join(os.path.dirname(__file__), "..", "public")
FONT_PATH = "/System/Library/Fonts/Helvetica.ttc"


def make_icon(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), WHITE + (255,))
    draw = ImageDraw.Draw(img)

    font_size = int(size * 0.72)
    try:
        font = ImageFont.truetype(FONT_PATH, font_size, index=1)  # Bold variant
    except Exception:
        font = ImageFont.load_default()

    text = "S"
    bbox = draw.textbbox((0, 0), text, font=font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]
    x = (size - text_w) // 2 - bbox[0]
    y = (size - text_h) // 2 - bbox[1]

    draw.text((x, y), text, fill=BRAND_RED + (255,), font=font)
    return img


def save_png(img: Image.Image, path: str):
    rgb = Image.new("RGB", img.size, WHITE)
    rgb.paste(img, mask=img.split()[3])
    rgb.save(path, "PNG", optimize=True)
    print(f"  Written: {path}")


sizes = {
    "icon-512.png": 512,
    "icon-192.png": 192,
    "apple-touch-icon.png": 180,
}

for filename, size in sizes.items():
    img = make_icon(size)
    save_png(img, os.path.join(PUBLIC_DIR, filename))

# icon.png = duplicate of 512
shutil.copy(
    os.path.join(PUBLIC_DIR, "icon-512.png"),
    os.path.join(PUBLIC_DIR, "icon.png"),
)
print(f"  Copied:  {os.path.join(PUBLIC_DIR, 'icon.png')}")

# favicon.ico (32x32 + 16x16)
favicon_img = make_icon(32)
favicon_16 = make_icon(16)
favicon_path = os.path.join(PUBLIC_DIR, "favicon.ico")
favicon_img.save(favicon_path, format="ICO", sizes=[(32, 32), (16, 16)],
                 append_images=[favicon_16])
print(f"  Written: {favicon_path}")

print("\nDone. Icons generated successfully.")
