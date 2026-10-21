#!/usr/bin/env python3
"""Evalúa un modelo .keras sobre SU 15 % de validación: acierto, top3 y, sobre todo, qué fracción
de fotos de especies tóxicas o mortales toma por comestibles, con detalle por especie.

La partición se toma de un archivo division-*.json (lo escribe entrenar.py) o, si no lo hay, se
reproduce la de Keras (semilla 42) sobre los archivos que existían cuando se entrenó (--antes-de).

Uso: python3 evaluar.py --modelo ../public/modelo_mejor.keras [--division division-X.json | --antes-de 2026-10-17]
"""
import argparse, datetime, json, os, pathlib
import numpy as np
import tensorflow as tf
try:
    import tf_keras as keras
except ImportError:
    from tensorflow import keras

RAIZ = pathlib.Path(__file__).resolve().parent.parent
IMAGENES = pathlib.Path(__file__).resolve().parent / "imagenes"
ESPECIES = {e["id"]: e for e in json.loads((RAIZ / "public" / "data" / "especies.json").read_text())["especies"]}
PELIGROSAS = {"toxica", "mortal"}
COMESTIBLES = {"comestible", "comestible_con_precaucion"}

ap = argparse.ArgumentParser()
ap.add_argument("--modelo", default=str(RAIZ / "public" / "modelo_mejor.keras"))
ap.add_argument("--division", default=None, help="division-*.json escrito por entrenar.py")
ap.add_argument("--antes-de", default=None, help="fecha AAAA-MM-DD: solo archivos creados antes (los que había al entrenar)")
ap.add_argument("--tamano", type=int, default=224)
ap.add_argument("--salida", default=str(pathlib.Path(__file__).resolve().parent / "evaluacion.json"))
args = ap.parse_args()

clases = sorted(d.name for d in IMAGENES.iterdir() if d.is_dir() and not d.name.startswith((".", "_")))
if args.division:
    div = json.loads(pathlib.Path(args.division).read_text())
    clases = div["etiquetas"]
    val = div["validacion"]
else:
    corte = datetime.datetime.fromisoformat(args.antes_de).timestamp() if args.antes_de else None
    archivos = []
    for c in clases:  # mismo orden que Keras: clases ordenadas, archivos ordenados
        for f in sorted(os.listdir(IMAGENES / c)):
            if not f.lower().endswith((".jpg", ".jpeg", ".png", ".bmp", ".gif")) or f.startswith("._"):
                continue
            if corte and (IMAGENES / c / f).stat().st_mtime >= corte:
                continue
            archivos.append(f"{c}/{f}")
    rng = np.random.RandomState(42)
    rng.shuffle(archivos)
    n_val = int(0.15 * len(archivos))
    val = archivos[-n_val:]
    print(f"Partición reproducida: {len(archivos)} archivos, {n_val} de validación")

idx = {c: i for i, c in enumerate(clases)}
modelo = keras.models.load_model(args.modelo, compile=False)

def cargar(ruta):
    img = tf.io.decode_image(tf.io.read_file(str(IMAGENES / ruta)), channels=3, expand_animations=False)
    return tf.image.resize(img, (args.tamano, args.tamano))

reales = np.array([idx[r.split("/")[0]] for r in val])
probs = []
with tf.device("/CPU:0"):
    for i in range(0, len(val), 64):
        lote = tf.stack([cargar(r) for r in val[i:i + 64]])
        probs.append(modelo.predict(lote, verbose=0))
probs = np.concatenate(probs)
preds = np.argmax(probs, axis=1)
top3 = np.argsort(-probs, axis=1)[:, :3]
n = len(reales)
top1 = float((preds == reales).mean())
top3_acc = float(np.mean([reales[i] in top3[i] for i in range(n)]))

pel_total = pel_como_com = 0
por_especie = {}
for r, p in zip(reales, preds):
    er, ep = clases[r], clases[p]
    if ESPECIES[er]["comestibilidad"] in PELIGROSAS:
        pel_total += 1
        d = por_especie.setdefault(er, {"fotos": 0, "como_comestible": 0, "confundida_con": {}})
        d["fotos"] += 1
        if ESPECIES[ep]["comestibilidad"] in COMESTIBLES:
            pel_como_com += 1
            d["como_comestible"] += 1
            d["confundida_con"][ep] = d["confundida_con"].get(ep, 0) + 1
riesgo = pel_como_com / pel_total if pel_total else None
acierto_especie = {}
for c in clases:
    ids = np.where(reales == idx[c])[0]
    if len(ids):
        acierto_especie[c] = float(np.mean(preds[ids] == reales[ids]))
peores = sorted(acierto_especie.items(), key=lambda kv: kv[1])[:10]

resultado = {"modelo": args.modelo, "n_validacion": int(n), "top1": round(top1, 4), "top3": round(top3_acc, 4),
             "riesgo_peligrosa_como_comestible": None if riesgo is None else round(riesgo, 4),
             "peligrosas_total": pel_total, "peligrosas_como_comestibles": pel_como_com,
             "peligrosas_por_especie": dict(sorted(por_especie.items(), key=lambda kv: -kv[1]["como_comestible"])),
             "peores_especies": peores, "acierto_por_especie": acierto_especie}
pathlib.Path(args.salida).write_text(json.dumps(resultado, indent=2, ensure_ascii=False))
print(f"Validación ({n} fotos): top1 {top1:.3f} · top3 {top3_acc:.3f} · peligrosas tomadas por comestibles {pel_como_com}/{pel_total} ({(riesgo or 0)*100:.1f} %)")
print("Peligrosas que más se confunden con comestibles:")
for k, v in list(resultado["peligrosas_por_especie"].items())[:8]:
    conf = ", ".join(f"{ESPECIES[c]['comunes'][0]} ({m})" for c, m in sorted(v["confundida_con"].items(), key=lambda kv: -kv[1])[:3])
    print(f"  {ESPECIES[k]['comunes'][0]}: {v['como_comestible']}/{v['fotos']} -> {conf}")
print("Especies con peor acierto:", ", ".join(f"{ESPECIES[e]['comunes'][0]} {a*100:.0f}%" for e, a in peores[:8]))
