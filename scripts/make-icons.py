"""Genera los iconos PNG de Micelio con Pillow: seta con red de micelio bajo tierra."""
import math
import random
from pathlib import Path
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "public" / "icons"
OUT.mkdir(parents=True, exist_ok=True)

FONDO_ARRIBA = (47, 93, 58)
FONDO_ABAJO = (28, 58, 38)
SOMBRERO = (200, 86, 48)
SOMBRERO_SOMBRA = (160, 62, 36)
PUNTO = (250, 240, 222)
PIE = (242, 230, 204)
PIE_SOMBRA = (214, 198, 166)
MICELIO = (236, 232, 214)
TIERRA = (22, 44, 30)


def dibujar(lado: int, maskable: bool = False) -> Image.Image:
    s = 8
    L = lado * s
    img = Image.new("RGBA", (L, L), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # Fondo con degradado vertical y esquinas redondeadas
    fondo = Image.new("RGBA", (L, L), (0, 0, 0, 0))
    fd = ImageDraw.Draw(fondo)
    for y in range(L):
        t = y / L
        c = tuple(int(FONDO_ARRIBA[i] * (1 - t) + FONDO_ABAJO[i] * t) for i in range(3))
        fd.line([(0, y), (L, y)], fill=c + (255,))
    mascara = Image.new("L", (L, L), 0)
    ImageDraw.Draw(mascara).rounded_rectangle([0, 0, L - 1, L - 1], radius=0 if maskable else L // 5, fill=255)
    img.paste(fondo, (0, 0), mascara)

    m = 0.20 if maskable else 0.11
    x0, y0, x1, y1 = L * m, L * m, L * (1 - m), L * (1 - m)
    w, h = x1 - x0, y1 - y0
    suelo = y0 + h * 0.72

    # Tierra: franja inferior más oscura
    d.rectangle([0, suelo, L, L], fill=TIERRA + (0,))
    tierra = Image.new("RGBA", (L, L), (0, 0, 0, 0))
    ImageDraw.Draw(tierra).rectangle([0, suelo, L, L], fill=TIERRA + (255,))
    img.paste(tierra, (0, 0), Image.composite(mascara, Image.new("L", (L, L), 0), tierra.split()[3]))
    d = ImageDraw.Draw(img)

    # Micelio: hilos ramificados hacia abajo desde la base del pie
    random.seed(7)
    base_x = x0 + w / 2
    def hilo(x, y, ang, longitud, grosor, nivel):
        if nivel > 4 or longitud < w * 0.03:
            return
        x2 = x + math.cos(ang) * longitud
        y2 = y + math.sin(ang) * longitud
        d.line([(x, y), (x2, y2)], fill=MICELIO + (int(255 * (0.9 - nivel * 0.15)),), width=max(1, int(grosor)))
        for k in range(2):
            desvio = (random.random() - 0.5) * 1.3 + (k - 0.5) * 0.9
            hilo(x2, y2, ang + desvio, longitud * 0.68, grosor * 0.7, nivel + 1)
    for i, a in enumerate([-0.95, -0.45, 0.0, 0.45, 0.95]):
        hilo(base_x + (i - 2) * w * 0.035, suelo + h * 0.005, math.pi / 2 + a * 0.9, h * 0.11, w * 0.018, 0)

    # Pie
    pw, ph = w * 0.30, h * 0.40
    px = x0 + (w - pw) / 2
    py = suelo - ph + h * 0.01
    d.rounded_rectangle([px, py, px + pw, suelo + h * 0.01], radius=pw * 0.35, fill=PIE)
    d.rounded_rectangle([px + pw * 0.62, py + ph * 0.1, px + pw, suelo + h * 0.01], radius=pw * 0.3, fill=PIE_SOMBRA)

    # Sombrero: media elipse con sombra inferior
    cx0, cy0, cx1, cy1 = x0 + w * 0.02, y0 + h * 0.0, x1 - w * 0.02, y0 + h * 0.86
    d.pieslice([cx0, cy0, cx1, cy1], 180, 360, fill=SOMBRERO)
    d.rectangle([cx0, y0 + h * 0.40, cx1, y0 + h * 0.455], fill=SOMBRERO_SOMBRA)
    d.rounded_rectangle([cx0, y0 + h * 0.39, cx1, y0 + h * 0.45], radius=h * 0.03, fill=SOMBRERO_SOMBRA)

    # Puntos del sombrero
    for (fx, fy, fr) in [(0.27, 0.27, 0.065), (0.52, 0.13, 0.055), (0.74, 0.30, 0.05), (0.42, 0.36, 0.035), (0.63, 0.37, 0.028)]:
        r = w * fr
        cx, cy = x0 + w * fx, y0 + h * fy
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=PUNTO)

    return img.resize((lado, lado), Image.LANCZOS)


dibujar(192).save(OUT / "icon-192.png")
dibujar(180).save(OUT / "icon-180.png")
dibujar(512).save(OUT / "icon-512.png")
dibujar(512, maskable=True).save(OUT / "icon-512-maskable.png")

print("Iconos generados en", OUT)
