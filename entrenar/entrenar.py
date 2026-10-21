#!/usr/bin/env python3
"""Entrena el clasificador de setas con las fotos de entrenar/imagenes y lo exporta a
TensorFlow.js en public/modelo, listo para que la app lo use sin conexión.

Uso:
    python3 entrenar.py                       # MobileNetV2, 224 px, ~15 épocas
    python3 entrenar.py --epocas 12 --arquitectura mobilenetv3

En un Mac con Apple Silicon y tensorflow-metal tarda del orden de 30-90 minutos con
~15.000 fotos; solo con CPU, varias horas. Se puede interrumpir con Ctrl+C: exporta
el mejor modelo que haya conseguido hasta ese momento.
"""
import argparse
import datetime
import json
import pathlib
import sys

import numpy as np
import tensorflow as tf

try:
    import tf_keras as keras  # Keras 2, el que entiende tensorflowjs
except ImportError:
    from tensorflow import keras  # type: ignore

import os
if os.environ.get("SIN_GPU"):
    tf.config.set_visible_devices([], "GPU")  # por si el plugin Metal da problemas

# En Apple Silicon el optimizador Adam "nuevo" es lento y el plugin Metal falla al
# recompilar con capas descongeladas; el "legacy" funciona bien.
Adam = getattr(getattr(keras.optimizers, "legacy", keras.optimizers), "Adam")

RAIZ = pathlib.Path(__file__).resolve().parent.parent
IMAGENES = pathlib.Path(__file__).resolve().parent / "imagenes"
SALIDA = RAIZ / "public" / "modelo"
ESPECIES = json.loads((RAIZ / "public" / "data" / "especies.json").read_text())["especies"]
COMESTIBILIDAD = {e["id"]: e["comestibilidad"] for e in ESPECIES}


def limpiar_imagenes():
    """Quita los archivos ._* que macOS crea en discos ExFAT y las imágenes corruptas:
    cualquiera de ellos hace fallar la lectura del dataset."""
    from PIL import Image
    borrados = 0
    for f in IMAGENES.rglob("*"):
        if not f.is_file() or f.name.startswith("_"):
            continue
        if f.name.startswith("._"):
            f.unlink(); borrados += 1; continue
        if f.suffix.lower() == ".jpg":
            try:
                with Image.open(f) as im:
                    im.verify()
            except Exception:
                f.unlink(); borrados += 1
    if borrados:
        print(f"Limpieza: {borrados} archivos no válidos eliminados")


def construir(arquitectura, n_clases, tamano):
    entrada = keras.Input(shape=(tamano, tamano, 3), name="imagen")
    if arquitectura == "mobilenetv3":
        base = keras.applications.MobileNetV3Large(input_shape=(tamano, tamano, 3), include_top=False, weights="imagenet", include_preprocessing=True)
        x = base(entrada)
    else:
        base = keras.applications.MobileNetV2(input_shape=(tamano, tamano, 3), include_top=False, weights="imagenet")
        x = keras.layers.Rescaling(1.0 / 127.5, offset=-1.0)(entrada)  # la app envía píxeles 0-255
        x = base(x)
    x = keras.layers.GlobalAveragePooling2D()(x)
    x = keras.layers.Dropout(0.3)(x)
    salida = keras.layers.Dense(n_clases, activation="softmax", name="especie")(x)
    return keras.Model(entrada, salida), base


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--epocas", type=int, default=30, help="épocas totales (cabeza + ajuste fino); para antes si deja de mejorar")
    ap.add_argument("--descongelar", type=int, default=80, help="capas finales de la base que se ajustan (más = mejor acierto, más lento)")
    ap.add_argument("--continuar", default=None, help="ruta a un modelo .keras guardado por un entrenamiento anterior para seguir ajustándolo (salta la fase de cabeza)")
    ap.add_argument("--epoca-inicial", type=int, default=0, help="con --continuar: época por la que se quedó (solo para numerar)")
    ap.add_argument("--pesos-clase", action="store_true", help="da más peso a las especies con pocas fotos (útil para las peligrosas escasas)")
    ap.add_argument("--val-lotes", type=int, default=40, help="lotes de validación usados DURANTE el entrenamiento (el plugin Metal aborta con validaciones grandes); la evaluación final usa todo")
    ap.add_argument("--tamano", type=int, default=224)
    ap.add_argument("--lote", type=int, default=32)
    ap.add_argument("--arquitectura", choices=["mobilenetv2", "mobilenetv3"], default="mobilenetv2")
    args = ap.parse_args()

    if not IMAGENES.exists():
        sys.exit("No hay fotos: ejecuta antes descargar_imagenes.py")
    limpiar_imagenes()
    carpetas = sorted(d for d in IMAGENES.iterdir() if d.is_dir() and any(d.glob("*.jpg")))
    print(f"{len(carpetas)} especies con fotos")

    comun = dict(validation_split=0.15, seed=42, image_size=(args.tamano, args.tamano), batch_size=args.lote, label_mode="categorical")
    ds_train = keras.utils.image_dataset_from_directory(IMAGENES, subset="training", **comun)
    ds_val = keras.utils.image_dataset_from_directory(IMAGENES, subset="validation", **comun)
    etiquetas = list(ds_train.class_names)
    n_train = len(ds_train.file_paths)
    n_val = len(ds_val.file_paths)
    # Guarda la partición para poder evaluar después exactamente sobre las mismas fotos
    division = pathlib.Path(__file__).resolve().parent / f"division-{datetime.datetime.now().strftime('%Y%m%d-%H%M')}.json"
    division.write_text(json.dumps({"etiquetas": etiquetas, "validacion": [str(pathlib.Path(f).relative_to(IMAGENES)) for f in ds_val.file_paths]}))
    print(f"Partición guardada en {division.name} ({n_train} entrenamiento / {n_val} validación)")

    aumento = keras.Sequential([
        keras.layers.RandomFlip("horizontal"),
        keras.layers.RandomRotation(0.15),
        keras.layers.RandomZoom(0.25),
        keras.layers.RandomTranslation(0.1, 0.1),
        keras.layers.RandomContrast(0.25),
        keras.layers.RandomBrightness(0.2),
    ])
    autotune = tf.data.AUTOTUNE
    ds_train = ds_train.map(lambda x, y: (aumento(x, training=True), y), num_parallel_calls=autotune).prefetch(autotune)
    ds_val = ds_val.prefetch(autotune)
    ds_val_entreno = ds_val.take(args.val_lotes) if args.val_lotes > 0 else ds_val

    pesos_clase = None
    if args.pesos_clase:
        import collections
        conteo = {e: len([f for f in os.listdir(IMAGENES / e) if f.lower().endswith(".jpg") and not f.startswith("._")]) for e in etiquetas}
        mediana = float(np.median(list(conteo.values())))
        pesos_clase = {i: float(np.clip(mediana / max(1, conteo[e]), 0.5, 3.0)) for i, e in enumerate(etiquetas)}
        print("Pesos por clase (mín/máx):", round(min(pesos_clase.values()), 2), round(max(pesos_clase.values()), 2))

    if args.continuar:
        modelo = keras.models.load_model(args.continuar, compile=False)
        base = next(c for c in modelo.layers if isinstance(c, keras.Model))
        print(f"Continuando desde {args.continuar} (época {args.epoca_inicial})")
    else:
        modelo, base = construir(args.arquitectura, len(etiquetas), args.tamano)
    top3 = keras.metrics.TopKCategoricalAccuracy(k=3, name="top3")
    mejor = SALIDA.parent / "modelo_mejor.keras"
    callbacks = [
        keras.callbacks.ModelCheckpoint(str(mejor), monitor="val_accuracy", save_best_only=True),
        keras.callbacks.EarlyStopping(monitor="val_accuracy", patience=6, restore_best_weights=True),
        keras.callbacks.ReduceLROnPlateau(monitor="val_loss", factor=0.5, patience=2, min_lr=1e-6, verbose=1),
    ]
    perdida = keras.losses.CategoricalCrossentropy(label_smoothing=0.1)

    epocas_cabeza = max(3, min(5, args.epocas // 4))
    try:
        if not args.continuar:
            # Fase 1: solo la cabeza
            base.trainable = False
            modelo.compile(optimizer=Adam(learning_rate=1e-3), loss=perdida, metrics=["accuracy", top3])
            modelo.fit(ds_train, validation_data=ds_val_entreno, epochs=epocas_cabeza, callbacks=callbacks, verbose=2, class_weight=pesos_clase)
        # Fase 2: ajuste fino de las últimas capas
        base.trainable = True
        for capa in base.layers[:-args.descongelar]:
            capa.trainable = False
        lr = 1e-4 if args.continuar else 2e-4
        modelo.compile(optimizer=Adam(learning_rate=lr), loss=perdida, metrics=["accuracy", top3])
        modelo.fit(ds_train, validation_data=ds_val_entreno, epochs=args.epocas, initial_epoch=args.epoca_inicial if args.continuar else epocas_cabeza, callbacks=callbacks, verbose=2, class_weight=pesos_clase)
    except KeyboardInterrupt:
        print("\nInterrumpido: se exporta el mejor modelo hasta ahora.")
        if mejor.exists():
            modelo = keras.models.load_model(str(mejor))

    # Evaluación completa en CPU (el plugin Metal falla con conjuntos grandes):
    # acierto y, sobre todo, cuántas setas peligrosas se confunden con comestibles
    with tf.device("/CPU:0"):
        perdida, top1, top3v = modelo.evaluate(ds_val, verbose=0)
    peligrosas_como_comestibles, peligrosas_total = 0, 0
    for x, y in ds_val:
        with tf.device("/CPU:0"):
            pred = np.argmax(modelo.predict(x, verbose=0), axis=1)
        real = np.argmax(y.numpy(), axis=1)
        for p, r in zip(pred, real):
            if COMESTIBILIDAD.get(etiquetas[r]) in ("toxica", "mortal"):
                peligrosas_total += 1
                if COMESTIBILIDAD.get(etiquetas[p]) in ("comestible", "comestible_con_precaucion"):
                    peligrosas_como_comestibles += 1
    riesgo = peligrosas_como_comestibles / peligrosas_total if peligrosas_total else None
    print(f"\nValidación: top1 {top1:.3f} · top3 {top3v:.3f} · peligrosas tomadas por comestibles: {peligrosas_como_comestibles}/{peligrosas_total}")

    # Exportar a TensorFlow.js (solo si mejora al modelo que ya está en la app)
    actual = None
    if (SALIDA / "meta.json").exists():
        try:
            actual = json.loads((SALIDA / "meta.json").read_text())
        except Exception:
            actual = None
    destino = SALIDA
    if actual and not actual.get("prueba") and actual.get("metricas", {}).get("top1", 0) >= float(top1):
        destino = SALIDA.parent.parent / "entrenar" / f"modelo-descartado-{datetime.datetime.now().strftime('%Y%m%d-%H%M')}"
        print(f"El modelo actual de la app ({actual['metricas']['top1']:.3f}) es igual o mejor: este se guarda aparte en {destino}")
    exportar(modelo, destino, etiquetas, args, top1, top3v, n_train, n_val, riesgo)


def exportar(modelo, destino, etiquetas, args, top1, top3v, n_train, n_val, riesgo):
    import tensorflowjs as tfjs
    destino.mkdir(parents=True, exist_ok=True)
    for viejo in list(destino.glob("*")):
        try:
            viejo.unlink()
        except FileNotFoundError:
            pass  # en ExFAT el ._archivo desaparece con el archivo
    tfjs.converters.save_keras_model(modelo, str(destino), quantization_dtype_map={"uint8": "*"})
    meta = {
        "version": datetime.datetime.now().strftime("%Y%m%d-%H%M"),
        "formato": "layers",
        "arquitectura": args.arquitectura,
        "entrada": {"tamano": args.tamano, "rango": "0-255"},
        "etiquetas": etiquetas,
        "metricas": {"top1": round(float(top1), 4), "top3": round(float(top3v), 4), "n_entrenamiento": n_train, "n_validacion": n_val, "riesgo_peligrosa_como_comestible": None if riesgo is None else round(riesgo, 4)},
        "prueba": False,
        "generado": datetime.datetime.now().isoformat(timespec="seconds"),
    }
    (destino / "meta.json").write_text(json.dumps(meta, indent=2, ensure_ascii=False))
    print(f"Modelo exportado a {destino} ({sum(f.stat().st_size for f in destino.glob('*') if not f.name.startswith('._')) / 1e6:.1f} MB). Arranca la app y abre la pestaña Fotos.")


if __name__ == "__main__":
    main()
