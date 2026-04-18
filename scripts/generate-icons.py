#!/usr/bin/env python3
"""
Generiert PWA-Icons und In-App-Logos fuer BMR Bau.
Quelle: Originales BMR-Logo (JPG) - erzeugt:
  - bmr-logo.png         : Vollstaendiges Wortmark-Logo
  - bmr-monogram.png     : Quadratischer Ausschnitt (gruener Kasten mit Monogramm)
  - icon-192.png / 512   : PWA-Icons (Maskable-ready, vollflaechig gruen)
  - apple-touch-icon.png : iOS Home-Screen Icon (180px)
  - favicon.ico          : 16/32 px
"""

import os
from PIL import Image

BRAND_GREEN = (124, 163, 115)  # BMR-Gruen (entspricht etwa #7CA373)
WHITE = (255, 255, 255)

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, ".."))
PUBLIC_DIR = os.path.join(PROJECT_ROOT, "public")

# Quelle: Original-Logo in den Downloads (optional ueberschreibbar per ENV)
SOURCE_LOGO = os.environ.get(
    "BMR_LOGO_SRC",
    os.path.expanduser("~/Downloads/BMR Bau GmbH Logo optimiert.jpg"),
)


def load_source() -> Image.Image:
    if not os.path.exists(SOURCE_LOGO):
        raise FileNotFoundError(f"Original-Logo nicht gefunden: {SOURCE_LOGO}")
    img = Image.open(SOURCE_LOGO).convert("RGB")
    return img


def extract_monogram(full: Image.Image) -> Image.Image:
    """Schneidet den quadratischen Monogramm-Kasten aus dem Logo aus.

    Das BMR-Logo besitzt links einen quadratischen, gruenen Kasten mit dem
    weissen JR-Monogramm. Dieser ist etwa so breit wie die gesamte Logo-Hoehe.
    """
    w, h = full.size
    # Der Monogramm-Kasten ist ueblicherweise etwas kleiner als die Gesamthoehe
    # (kleine Luft rundherum). Wir nehmen die Hoehe als Seitenlaenge und
    # starten beim linken Rand.
    side = h
    box = full.crop((0, 0, side, side))
    return box


def make_app_icon(monogram: Image.Image, size: int) -> Image.Image:
    """Skaliert den gruenen Monogramm-Kasten 1:1 auf die gewuenschte Groesse.

    Der gruene Hintergrund reicht bereits bis zum Rand, daher entsteht ein
    sauberes, maskable-freundliches App-Icon ohne doppelte Rahmen.
    """
    return monogram.resize((size, size), Image.LANCZOS).convert("RGB")


def save_png(img: Image.Image, path: str):
    img.save(path, "PNG", optimize=True)
    print(f"  Written: {path}")


def main():
    full = load_source()
    monogram = extract_monogram(full)

    # Vollstaendiges Logo (verkleinert auf max 1200 Breite fuer Web-Nutzung)
    full_for_web = full.copy()
    max_w = 1200
    if full_for_web.width > max_w:
        ratio = max_w / full_for_web.width
        new_h = int(full_for_web.height * ratio)
        full_for_web = full_for_web.resize((max_w, new_h), Image.LANCZOS)
    save_png(full_for_web, os.path.join(PUBLIC_DIR, "bmr-logo.png"))

    # Reiner Monogramm-Kasten (z.B. fuer Avatare / Chat-Bubbles)
    monogram_web = monogram.resize((512, 512), Image.LANCZOS)
    save_png(monogram_web, os.path.join(PUBLIC_DIR, "bmr-monogram.png"))

    # PWA-Icons
    save_png(make_app_icon(monogram, 192), os.path.join(PUBLIC_DIR, "icon-192.png"))
    save_png(make_app_icon(monogram, 512), os.path.join(PUBLIC_DIR, "icon-512.png"))
    save_png(make_app_icon(monogram, 180), os.path.join(PUBLIC_DIR, "apple-touch-icon.png"))

    # Favicon (Monogramm direkt heruntergerechnet, damit es auch bei 16px erkennbar ist)
    favicon_32 = monogram.resize((32, 32), Image.LANCZOS)
    favicon_16 = monogram.resize((16, 16), Image.LANCZOS)
    favicon_path = os.path.join(PUBLIC_DIR, "favicon.ico")
    favicon_32.save(
        favicon_path,
        format="ICO",
        sizes=[(32, 32), (16, 16)],
        append_images=[favicon_16],
    )
    print(f"  Written: {favicon_path}")

    print("\nFertig. BMR-Icons erzeugt.")


if __name__ == "__main__":
    main()
