# Entrenar el modelo de reconocimiento

La app reconoce fotos **en el propio móvil** con un modelo TensorFlow.js. Ese modelo hay que entrenarlo una vez con fotos reales de las 88 especies de la guía. Todo se hace en tu Mac con dos scripts.

## 1. Preparar Python (una vez)

```bash
cd entrenar
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
pip install tensorflow-metal   # opcional: usa la GPU del Mac (mucho más rápido)
```

Si pip no encuentra las versiones, usa Python 3.10-3.12 (`brew install python@3.12` y `python3.12 -m venv .venv`).

## 2. Descargar fotos

```bash
python3 descargar_imagenes.py --por-especie 200
```

Baja hasta 200 fotos por especie desde GBIF (observaciones con imagen, casi todas de iNaturalist, con licencia Creative Commons). Unos 15.000 archivos y 1-2 GB; tarda entre 30 minutos y 2 horas según la conexión. Se puede cortar y relanzar. Con `--paises ES,PT,FR,IT` limita a observaciones de esos países (fotos más parecidas a lo que verás, pero menos cantidad).

Al acabar avisa de las especies con pocas fotos: el modelo las reconocerá peor.

## 3. Entrenar y exportar

```bash
python3 entrenar.py
```

Entrena un MobileNetV2 (transferencia desde ImageNet, ajuste fino de las últimas capas, aumento de datos), evalúa con un 15 % de fotos reservadas y exporta el modelo cuantizado (unos 3-4 MB) a `public/modelo/` junto con `meta.json` (etiquetas, tamaño de entrada y métricas). La app lo detecta sola al arrancar con red, lo guarda en el móvil y desde entonces funciona sin conexión.

Tiempo orientativo: 30-90 minutos con GPU (tensorflow-metal), varias horas solo con CPU. Ctrl+C exporta el mejor modelo conseguido hasta ese momento.

## Si el proyecto está en un disco externo (ExFAT)

macOS crea archivos ocultos `._nombre.jpg` junto a cada foto en discos ExFAT; no son imágenes y rompen el entrenamiento. `entrenar.py` los borra al empezar (y también las fotos corruptas). El entorno de Python no puede vivir en ExFAT: `ejecutar_todo.sh` lo crea en `~/.micelio/venv`.

## Qué esperar

Con unas 150-200 fotos por especie, un modelo así suele acertar la especie exacta entre el 65 y el 85 % de las veces y la tiene entre las tres primeras más del 90 %. **No es suficiente para fiarse de la foto sola**: por eso la app, tras el reconocimiento, te pide verificar en mano los rasgos que distinguen a las especies peligrosas (qué hay debajo, anillo, base del pie, látex) y solo entonces puede subir el semáforo.

La métrica que más importa está en `meta.json`: `riesgo_peligrosa_como_comestible`, la fracción de fotos de especies tóxicas o mortales que el modelo tomó por comestibles. Cuanto más baja, mejor; si supera 0,15, entrena con más fotos de esas especies (`--solo amanita-phalloides,...` en la descarga).

## Resultados obtenidos (15/10/2026, Mac M4)

| Modelo | Fotos | Épocas | Especie exacta | Entre las 3 primeras | Peligrosas tomadas por comestibles |
| --- | --- | --- | --- | --- | --- |
| v1 | 17.681 (≈200/especie) | 12 | 60 % | 81 % | 15 % |
| v2 | 17.681 | 30, 80 capas ajustables | 63,5 % | 82 % | 18 % |

El modelo aprende las fotos de entrenamiento mucho mejor (90 %) que las nuevas (63 %): le faltan datos, no épocas. Por eso el siguiente paso es 400 fotos por especie.

`exportar.py` vuelve a exportar `public/modelo_mejor.keras` (el mejor punto del último entrenamiento) sin reentrenar, por ejemplo si falló la exportación. `entrenar.py` solo sustituye el modelo de la app si el nuevo acierta más; si no, lo deja en `entrenar/modelo-descartado-FECHA`.

## Mejorar el modelo

- Más fotos por especie (`--por-especie 400`).
- Añadir tus propias fotos a `imagenes/<id>/` (las de tus salidas son las más parecidas a las que harás).
- `--arquitectura mobilenetv3` suele ganar unos puntos; la conversión a TensorFlow.js es algo más delicada.
- Añadir especies a `datos/parte*.json`, ejecutar `npm run datos` y volver a descargar y entrenar.
