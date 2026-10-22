#!/usr/bin/env python3
"""Exporta a TensorFlow.js el mejor modelo guardado por entrenar.py (public/modelo_mejor.keras)
sin volver a entrenar. Útil si la exportación falló o para recuperar un modelo.

Uso: python3 exportar.py --top1 0.635 --top3 0.816 --riesgo 0.181 [--destino ../public/modelo]
"""
import argparse, datetime, json, pathlib, sys
RAIZ = pathlib.Path(__file__).resolve().parent.parent
ESPECIES = json.loads((RAIZ / "public" / "data" / "especies.json").read_text())["especies"]
IMAGENES = pathlib.Path(__file__).resolve().parent / "imagenes"

ap = argparse.ArgumentParser()
ap.add_argument("--modelo", default=str(RAIZ / "public" / "modelo_mejor.keras"))
ap.add_argument("--destino", default=str(RAIZ / "public" / "modelo"))
ap.add_argument("--top1", type=float, required=True)
ap.add_argument("--top3", type=float, required=True)
ap.add_argument("--riesgo", type=float, default=None)
ap.add_argument("--tamano", type=int, default=224)
ap.add_argument("--arquitectura", default="mobilenetv2", help="mobilenetv2 -> formato layers; otras -> graph")
args = ap.parse_args()

try:
    import tf_keras as keras
except ImportError:
    from tensorflow import keras
import tensorflowjs as tfjs

modelo = keras.models.load_model(args.modelo, compile=False)
# Las etiquetas son las carpetas de imágenes en orden alfabético (así las lee image_dataset_from_directory)
etiquetas = sorted(d.name for d in IMAGENES.iterdir() if d.is_dir() and not d.name.startswith((".", "_")))
assert len(etiquetas) == modelo.output_shape[-1], f"{len(etiquetas)} carpetas frente a {modelo.output_shape[-1]} salidas"
destino = pathlib.Path(args.destino)
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from entrenar import exportar_tfjs, formato_para
formato = formato_para(args.arquitectura)
exportar_tfjs(modelo, destino, formato)
meta = {
    "version": datetime.datetime.now().strftime("%Y%m%d-%H%M"),
    "formato": formato, "arquitectura": args.arquitectura,
    "entrada": {"tamano": args.tamano, "rango": "0-255"},
    "etiquetas": etiquetas,
    "metricas": {"top1": args.top1, "top3": args.top3, "riesgo_peligrosa_como_comestible": args.riesgo},
    "prueba": False, "generado": datetime.datetime.now().isoformat(timespec="seconds"),
}
(destino / "meta.json").write_text(json.dumps(meta, indent=2, ensure_ascii=False))
print(f"Exportado a {destino}: {len(etiquetas)} especies, top1 {args.top1}")
