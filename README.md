# Micelio: guía e identificador de setas

App web para el móvil (PWA) pensada para salir a por setas **sin cobertura**. Reconoce las fotos en el propio móvil con un modelo de reconocimiento de imágenes guardado en el dispositivo, lleva dentro una guía de 88 especies ibéricas y una clave de identificación por rasgos, y, si hay red, permite pedir una segunda opinión a la visión de Claude.

> **Importante.** Ni una foto ni una clave permiten garantizar que una seta es comestible. La app orienta y te obliga a comprobar los rasgos en el campo; la decisión final debe pasar por una persona experta o una asociación micológica. El verde significa "probablemente comestible, confírmalo", nunca "cómetela".

## Qué hace

| Sección | Qué hay | ¿Sin conexión? |
| --- | --- | --- |
| **Fotos** | Hasta 4 fotos (sombrero, parte de abajo, pie con base, extra). Un modelo TensorFlow.js guardado en el móvil las reconoce al instante y propone las especies más parecidas de la guía. Después te pide **verificar en mano** los rasgos que separan la especie de sus confusiones peligrosas (qué hay debajo, anillo, base del pie, látex y las preguntas que más distinguen en cada caso) y solo entonces puede subir el semáforo. Con red, botón de segunda opinión con Claude. | Sí |
| **Clave** | Asistente paso a paso con los rasgos que miraría un micólogo (qué hay bajo el sombrero, anillo, volva, látex, viraje, olor, hábitat, árboles, época, esporada). Filtra las especies compatibles y lanza alertas de seguridad (rasgos de amanita, setas pequeñas blancas, cortina, poros rojos, látex blanco…). | Sí |
| **Guía** | Fichas de las 88 especies con cómo reconocerlas, qué comprobar en el campo, con qué se confunden (enlazadas), precauciones y normativa. Buscador y filtros. Buenas prácticas y qué hacer ante una intoxicación (síndromes y tiempos de aparición, teléfonos). | Sí |
| **Mapa** | Mapa topográfico con tu posición. Graba la ruta (la pantalla se mantiene encendida), marca setales con especie, cantidad y nota, y si te pierdes te da distancia y rumbo al inicio, el rastro de vuelta y tus coordenadas para el 112. Rutas y setales se guardan en el móvil y se exportan a GPX. Puedes guardar las teselas de una zona para verlas sin red. | Sí (posición, ruta y setales siempre; el fondo de mapa si lo guardaste antes) |
| **Historial** | Reconocimientos en el móvil, segundas opiniones y resultados de la clave. | Sí |

### Reglas de seguridad

**Reconocimiento en el móvil.** Antes de verificar rasgos, el semáforo nunca pasa de ámbar; es rojo si la especie más parecida es tóxica o mortal, si el parecido es menor del 35 % o si una especie mortal supera el 10 %. Tras la verificación (modo estricto: anillo y base ya comprobados), solo llega a verde si el candidato es comestible, has respondido al menos tres rasgos sin contradicciones y **ninguna especie tóxica o mortal de la guía encaja ya** con lo que has visto.

**Segunda opinión con Claude.** El servidor endurece el semáforo que propone el modelo; nunca lo relaja:

- **Rojo** si el candidato principal es tóxico, mortal, no comestible o desconocido, si hay un candidato mortal, si la confianza es menor del 60 % o si las fotos son insuficientes.
- **Ámbar** si es comestible con precaución, la confianza no llega al 85 %, hay un candidato tóxico o las fotos son mejorables.
- **Verde** solo si todo lo anterior se cumple y el modelo también lo propone.

## Puesta en marcha

Requisitos: Node.js 20 o superior. Para la segunda opinión con Claude, una clave de API de Anthropic (https://platform.claude.com); para el reconocimiento en el móvil, entrenar el modelo una vez (siguiente apartado).

```bash
npm install
cp .env.example .env     # opcional: ANTHROPIC_API_KEY para la segunda opinión
npm start
```

Abre http://localhost:3000. Sin clave de API todo funciona salvo el botón de segunda opinión. `DEMO=1 npm start` hace que esa segunda opinión devuelva un ejemplo.

### Entrenar el modelo de reconocimiento (una vez)

El modelo no viene incluido: se entrena en tu Mac con fotos reales de las 88 especies. Está explicado paso a paso en [entrenar/README.md](entrenar/README.md): un script descarga las fotos (GBIF/iNaturalist) y otro entrena un MobileNet y lo exporta a `public/modelo/`. La app lo detecta al arrancar con red, lo guarda en el móvil y desde entonces reconoce sin conexión. Para comprobar la cadena completa sin entrenar, `npm run modelo-prueba` crea un modelo de ejemplo con resultados aleatorios (claramente marcado como tal en la app); `npm run modelo-prueba -- --borrar` lo quita.

### En el móvil, en casa

1. Móvil y ordenador en la misma wifi.
2. IP del ordenador (macOS): `ipconfig getifaddr en0`.
3. En el móvil abre `http://IP:3000`.

Por `http://` funciona todo menos el GPS del mapa y la instalación como app: los navegadores solo dan ubicación a páginas servidas por HTTPS. Para probar el mapa en el ordenador sin GPS, abre `http://localhost:3000/?simular=1` (simula un paseo).

### HTTPS en el móvil (GPS e instalación)

Dos opciones:

- **Túnel** (lo más rápido): `cloudflared tunnel --url http://localhost:3000` te da una dirección `https://…trycloudflare.com` que abres en el móvil. Instala la app desde ahí; una vez instalada funciona sin red.
- **Certificado propio** (ya generado en `certs/` para la IP del Mac): arranca con `PORT=3443 TLS_KEY=certs/clave.pem TLS_CERT=certs/certificado.pem npm start` y abre `https://IP-del-mac:3443` en el móvil. El navegador avisará de que el certificado no es de confianza: acepta y entra. Con eso el GPS funciona; la instalación como app y el uso sin red necesitan un certificado de confianza (túnel u hosting). Si cambia la IP del Mac, regenera el certificado:
  `openssl req -x509 -newkey rsa:2048 -nodes -keyout certs/clave.pem -out certs/certificado.pem -days 365 -subj "/CN=Micelio local" -addext "subjectAltName=IP:TU.IP,DNS:localhost"`
- **Publicar la app como sitio estático** (la opción definitiva): `npm run dist` deja en `dist/` todo lo que necesita el móvil (interfaz, guía, clave, mapa y modelo). Súbelo a GitHub Pages, Netlify o Cloudflare Pages: HTTPS de confianza gratis, instalación en la pantalla de inicio y funcionamiento sin red. Solo la segunda opinión con Claude necesita el servidor Node; si lo publicas en otro dominio, pon su dirección en `dist/config.js` (`apiBase`) y arráncalo con `ORIGENES_PERMITIDOS=https://tu-sitio` para autorizar el acceso.

### En el campo

Una vez abierta la app con red, el navegador guarda la interfaz, la guía, la clave y el modelo de reconocimiento: todo sigue funcionando sin cobertura. Solo la segunda opinión con Claude necesita que el servidor esté en internet:

- Túnel temporal desde tu ordenador: `cloudflared tunnel --url http://localhost:3000` o ngrok.
- O despliega la carpeta en Render, Railway, Fly.io o similar con la variable `ANTHROPIC_API_KEY`.

Con HTTPS el móvil ofrece **instalar la app** en la pantalla de inicio (icono propio, pantalla completa, funciona sin red). Si el servidor es público, define `APP_TOKEN` en `.env`: la app pedirá esa clave la primera vez.

## Configuración (.env)

| Variable | Descripción |
| --- | --- |
| `ANTHROPIC_API_KEY` | Clave de API (obligatoria salvo en modo demo). |
| `CLAUDE_MODEL` | Modelo. Por defecto `claude-opus-5-5`. |
| `PORT` | Puerto. Por defecto 3000. |
| `APP_TOKEN` | Clave de acceso que la app debe enviar. Opcional. |
| `DEMO` | Con `1`, la identificación por fotos devuelve un resultado de ejemplo. |

## Datos de especies

Las fichas viven en `datos/parte*.json` (editables a mano). `npm run datos` valida los enumerados, los enlaces entre fichas y los campos obligatorios, y genera `public/data/especies.json`, que es lo que carga la app. `npm start` lo ejecuta automáticamente.

Cada especie tiene: nombres, grupo, comestibilidad (`comestible`, `comestible_con_precaucion`, `no_comestible`, `toxica`, `mortal`), rasgos codificados para la clave, descripción, lista de comprobaciones, confusiones (con enlace a otras fichas) y precauciones.

Para añadir una especie: copia una entrada parecida, rellena los rasgos con los valores que admite `public/js/clave-motor.js` y ejecuta `npm test`.

## Tests

```bash
npm test
```

Reconstruye los datos y ejecuta las pruebas de la clave contra la base de datos real (níscalo, oronja verde, rúsulas, boletos, rebozuelos, clitocibes blancos, cortinarios…).

## Estructura

```
server.js                 Servidor Express + Claude + reglas de seguridad + enlace a fichas
datos/parte*.json         Fichas de especies (fuente)
scripts/construir-datos   Valida y genera public/data/especies.json
public/index.html         Interfaz (4 pestañas: Fotos, Clave, Guía, Historial)
public/styles.css         Estilos (claro y oscuro, legible al sol)
public/js/main.js         Arranque, red, service worker
public/js/ui.js           Navegación, toasts, iconos
public/js/datos.js        Carga y búsqueda de especies
public/js/clave-motor.js  Caracteres, puntuación y alertas de la clave (sin DOM, testeable)
public/js/clave.js        Asistente de la clave
public/js/guia.js         Listado, buenas prácticas, emergencias
public/js/ficha.js        Ficha de especie
public/js/fotos.js        Fotos, reconocimiento en el móvil, verificación de rasgos
public/js/vision.js       Carga del modelo TensorFlow.js (guardado en IndexedDB) e inferencia
public/js/ia.js           Segunda opinión con Claude (envío con progreso)
public/js/mapa.js         Mapa de campo: ruta, setales, volver al inicio, teselas sin red
public/js/geo.js          Distancias, rumbos, GPX y base de datos local de rutas y setales
public/js/historial.js    Historial
public/js/almacen.js      Historial en localStorage
public/vendor/tf.min.js   TensorFlow.js (copiado desde node_modules en npm start)
public/vendor/leaflet/    Leaflet (mapa)
public/modelo/            Modelo entrenado (model.json, pesos, meta.json); no se incluye en git
public/sw.js              Service worker: toda la app disponible sin red
entrenar/                 Scripts de descarga de fotos y entrenamiento del modelo
test/                     Pruebas (node --test)
```

## Mapa sin conexión

El fondo de mapa viene de OpenTopoMap y OpenStreetMap, servicios gratuitos mantenidos por voluntarios. La app guarda en el móvil las teselas que ves y, con el botón "Guardar esta zona", las de la zona encuadrada (hasta 600 por pulsación, zooms 12-16). Es un uso razonable de esos servicios; para descargas masivas de comarcas enteras usa un proveedor con clave de API (MapTiler, Thunderforest…) cambiando la URL en `public/js/mapa.js`.

## Coste orientativo

El reconocimiento en el móvil, la clave y la guía no cuestan nada. Cada segunda opinión con Claude envía de 1 a 4 imágenes y ronda los 0,05-0,10 € con Claude Opus 5.5.

## Teléfonos de emergencia (España)

- Emergencias: 112
- Instituto Nacional de Toxicología: 91 562 04 20
