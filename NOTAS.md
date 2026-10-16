# Dónde lo dejamos (16/10/2026)

## Estado
- App completa en esta carpeta: fotos con reconocimiento en el móvil, clave de campo, guía de 88 especies, mapa (ruta, setales, volver al inicio, GPX, mapa sin red), historial. 23 tests en verde (`npm test`).
- Modelo de reconocimiento **v2** instalado en `public/modelo` (63,5 % especie exacta, 82 % entre las tres primeras).
- Descarga ampliada terminada (34.600 fotos, con sinónimos para las especies escasas). Entrenamiento **v3** lanzado el 16/10 por la tarde (`entrenar/registro-entrenamiento-v3.log`; si abortó con la GPU, `-v3-cpu.log`).
- HTTPS local listo: `certs/` con certificado para la IP del Mac; `npm run dist` genera `dist/` para publicar la app en un hosting estático (GitHub Pages, Netlify…).

## Para continuar mañana
```bash
cd "/Volumes/DISCO SARA/app setas/micelio"
source ~/.micelio/venv/bin/activate
python entrenar/descargar_imagenes.py --por-especie 400 --hilos 16   # termina la descarga (salta lo ya bajado)
python entrenar/entrenar.py --epocas 30                              # entrena el v3; solo sustituye al v2 si acierta más
```
Registros: `entrenar/registro-descarga-400.log`, `entrenar/registro-entrenamiento-v3.log`.

## Pendiente
1. Probar en el móvil por HTTPS (túnel `cloudflared tunnel --url http://localhost:3000` o certificado): GPS, instalación, fotos reales.
2. Revisar textos y preguntas de la verificación con setas de verdad.
3. Icono definitivo de Micelio.
4. Decidir si la segunda opinión con Claude se publica (necesita servidor en internet y clave de API).
