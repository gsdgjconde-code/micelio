"""Genera los iconos PNG de la PWA (una seta sencilla) con Pillow."""
from pathlib import Path
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "public" / "icons"
OUT.mkdir(parents=True, exist_ok=True)

FONDO = (47, 93, 58)
SOMBRERO = (196, 66, 52)
PUNTO = (250, 240, 220)
PIE = (240, 228, 200)


def dibujar(lado: int, maskable: bool = False) -> Image.Image:
    s = 8  # supersampling para bordes suaves
    L = lado * s
    img = Image.new("RGBA", (L, L), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    radio = L // 2 if maskable else L // 5
    d.rounded_rectangle([0, 0, L - 1, L - 1], radius=radio, fill=FONDO)

    # zona segura: en maskable el contenido se encoge
    m = 0.20 if maskable else 0.12
    x0, y0, x1, y1 = L * m, L * m, L * (1 - m), L * (1 - m)
    w, h = x1 - x0, y1 - y0

    # pie
    pw, ph = w * 0.34, h * 0.48
    px = x0 + (w - pw) / 2
    py = y0 + h * 0.46
    d.rounded_rectangle([px, py, px + pw, py + ph], radius=pw * 0.3, fill=PIE)

    # sombrero (media elipse)
    cx0, cy0, cx1, cy1 = x0, y0 + h * 0.02, x1, y0 + h * 1.0
    d.pieslice([cx0, cy0, cx1, cy1], 180, 360, fill=SOMBRERO)
    # borde inferior recto del sombrero
    d.rectangle([cx0 + w * 0.05, y0 + h * 0.47, cx1 - w * 0.05, y0 + h * 0.53], fill=SOMBRERO)

    # puntos
    for (fx, fy, fr) in [(0.3, 0.28, 0.07), (0.56, 0.16, 0.06), (0.72, 0.36, 0.055), (0.45, 0.4, 0.045)]:
        r = w * fr
        cx, cy = x0 + w * fx, y0 + h * fy
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=PUNTO)

    return img.resize((lado, lado), Image.LANCZOS)


dibujar(192).save(OUT / "icon-192.png")
dibujar(180).save(OUT / "icon-180.png")
dibujar(512).save(OUT / "icon-512.png")
dibujar(512, maskable=True).save(OUT / "icon-512-maskable.png")
print("Iconos generados en", OUT)
