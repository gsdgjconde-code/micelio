# Dónde lo dejamos (21/10/2026)

## Estado
- App completa en esta carpeta: fotos con reconocimiento en el móvil, clave de campo, guía de 88 especies, mapa (ruta, setales, volver al inicio, GPX, mapa sin red), historial. 23 tests en verde (`npm test`).
- Modelo de reconocimiento **v3** publicado (mejor punto, época 24: 74 % especie exacta, 88 % entre las tres primeras; entrenado con 35.000 fotos en CPU porque la GPU abortaba con este tamaño). Evaluado el 21/10 con `evaluar.py`: 74,4 % / 88,7 % / peligrosas tomadas por comestibles 11,9 % (detalle en `entrenar/evaluacion.json`).
- Si el entrenamiento v3 llegó al final y mejoró el 74 %, habrá sobrescrito `public/modelo` con uno mejor: ejecutar `npm run publicar` para subirlo. Si no, no hay nada que hacer.
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
