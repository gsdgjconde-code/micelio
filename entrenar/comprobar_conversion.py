#!/usr/bin/env python3
"""Comprueba que una arquitectura se puede exportar a TensorFlow.js ANTES de entrenarla:
construye el modelo sin entrenar, lo exporta a public/pruebas/modelo-<arq>/ y lo deja listo
para cargarlo en la app (http://localhost:3000/pruebas/modelo-<arq>/model.json).

Uso: python3 comprobar_conversion.py --arquitectura mobilenetv3 --tamano 288
"""
import argparse, json, pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from entrenar import construir  # reutiliza la definición real del modelo
import tensorflowjs as tfjs

ap = argparse.ArgumentParser()
ap.add_argument("--arquitectura", default="mobilenetv3")
ap.add_argument("--tamano", type=int, default=224)
ap.add_argument("--formato", choices=["layers", "graph"], default="graph", help="graph: SavedModel -> grafo TF.js (admite cualquier capa, p. ej. MobileNetV3)")
args = ap.parse_args()
RAIZ = pathlib.Path(__file__).resolve().parent.parent
destino = RAIZ / "public" / "pruebas" / f"modelo-{args.arquitectura}-{args.tamano}"
modelo, _ = construir(args.arquitectura, 88, args.tamano)
destino.mkdir(parents=True, exist_ok=True)
for f in list(destino.glob("*")):
    try: f.unlink()
    except FileNotFoundError: pass
from entrenar import exportar_tfjs
exportar_tfjs(modelo, destino, args.formato)
(destino / "meta.json").write_text(json.dumps({"version": "prueba-conversion", "formato": args.formato, "entrada": {"tamano": args.tamano, "rango": "0-255"}, "etiquetas": [f"c{i}" for i in range(88)], "prueba": True}))
tam = sum(f.stat().st_size for f in destino.glob("*") if not f.name.startswith("._")) / 1e6
print(f"Exportado {args.arquitectura} @ {args.tamano}px a {destino.relative_to(RAIZ)} ({tam:.1f} MB). Cárgalo en la app para verificar.")
