# Dónde lo dejamos (21/10/2026, noche)

## Estado
- App completa en esta carpeta: fotos con reconocimiento en el móvil, clave de campo, guía de 88 especies, mapa (ruta, setales, volver al inicio, GPX, mapa sin red), historial. 23 tests en verde (`npm test`).
- Modelo de reconocimiento **v3** publicado (mejor punto, época 24: 74 % especie exacta, 88 % entre las tres primeras; entrenado con 35.000 fotos en CPU porque la GPU abortaba con este tamaño). Evaluado el 21/10 con `evaluar.py`: 74,4 % / 88,7 % / peligrosas tomadas por comestibles 11,9 % (detalle en `entrenar/evaluacion.json`).
- **v4 a medias** (50.677 fotos, 575 por especie; en CPU porque la GPU se cae por encima de ~35.000 fotos). Se apagó el Mac el 21/10 a las 20:30 en la época 21 de 30 (mejor punto: época 19, 74,8 % sobre validación parcial); copia del mejor punto en `entrenar/v4-parcial.keras` y en `public/modelo_mejor.keras` y la partición en `entrenar/division-20261021-1654.json`. Para continuarlo (fase de ajuste fino, desde la época en que se quedó, ver `entrenar/registro-entrenamiento-v4-cpu.log`):
  ```bash
  source ~/.micelio/venv/bin/activate
  cp public/modelo_mejor.keras entrenar/v4-parcial.keras
  SIN_GPU=1 nice -n 15 python entrenar/entrenar.py --continuar entrenar/v4-parcial.keras --epoca-inicial 21 --epocas 30 --val-lotes 40
  python entrenar/evaluar.py --modelo public/modelo_mejor.keras --division entrenar/division-20261021-1654.json
  npm run publicar   # solo si evaluar.py da más del 74,4 % del v3
  ```
  Ojo: `--continuar` recompila el modelo y la partición de validación se vuelve a calcular con la misma semilla sobre los mismos archivos (no añadir fotos antes de continuar).
- HTTPS local listo: `certs/` con certificado para la IP del Mac; `npm run dist` genera `dist/` para publicar la app en un hosting estático (GitHub Pages, Netlify…).

## Publicación
- Repositorio: https://github.com/gsdgjconde-code/micelio (público). App: https://gsdgjconde-code.github.io/micelio/
- Para actualizar lo publicado: `npm run publicar` (sube `dist/` a `gh-pages`).

## Para continuar mañana
```bash
cd "/Volumes/DISCO SARA/app setas/micelio"
npm start                      # app local en http://localhost:3000
npm run publicar               # sube la app (con el modelo de public/modelo) a GitHub Pages
```
Para seguir mejorando el modelo: más fotos (`descargar_imagenes.py --por-especie 600`) y `SIN_GPU=1 python entrenar/entrenar.py --epocas 30` (la GPU aborta con conjuntos grandes).
Registros: `entrenar/registro-descarga-400.log`, `entrenar/registro-entrenamiento-v3.log`.

## Pendiente
1. Instalar desde https://gsdgjconde-code.github.io/micelio/ en el móvil y probar con setas reales: fotos, GPS, mapa, setales.
2. Revisar textos y preguntas de la verificación con setas de verdad.
4. Decidir si la segunda opinión con Claude se publica (necesita servidor en internet y clave de API).
