// Service worker: deja toda la app (interfaz, guía, clave y TensorFlow.js) disponible sin
// conexión. Con red intenta siempre la versión nueva (con un tiempo máximo corto) y, si
// no llega, sirve la copia guardada. Las llamadas a /api van siempre a la red.
const CACHE = "micelio-v7";
const BASE = new URL("./", self.location).pathname; // "/" o "/micelio/"
const TESELAS = "micelio-teselas";
const MAX_TESELAS = 4000;
const HOSTS_TESELAS = ["opentopomap.org", "openstreetmap.org"];
const SHELL = [
  "", "index.html", "styles.css", "manifest.webmanifest",
  "js/main.js", "js/ui.js", "js/datos.js", "js/almacen.js", "js/ficha.js", "js/clave.js",
  "js/clave-motor.js", "js/guia.js", "js/ia.js", "js/fotos.js", "js/vision.js", "js/historial.js",
  "js/mapa.js", "js/geo.js", "config.js",
  "vendor/tf.min.js", "vendor/leaflet/leaflet.js", "vendor/leaflet/leaflet.css",
  "vendor/leaflet/images/marker-icon.png", "vendor/leaflet/images/marker-shadow.png", "vendor/leaflet/images/layers.png",
  "data/especies.json",
  "icons/icon-192.png", "icons/icon-512.png", "icons/icon-180.png",
].map((r) => BASE + r);
const TIEMPO_MAX_MS = 4000;

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== TESELAS).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

function conTiempoMaximo(promesa, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("tiempo agotado")), ms);
    promesa.then((v) => { clearTimeout(t); resolve(v); }, (err) => { clearTimeout(t); reject(err); });
  });
}

// Tesela vacía (PNG gris claro de 1x1) para cuando no hay red ni copia guardada
const TESELA_VACIA = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mPcs2fPfwAHPgMTqoHZSQAAAABJRU5ErkJggg=="), (c) => c.charCodeAt(0));
let puestas = 0;
async function recortarTeselas(cache) {
  const keys = await cache.keys();
  if (keys.length <= MAX_TESELAS) return;
  for (const k of keys.slice(0, keys.length - MAX_TESELAS)) await cache.delete(k);
}
function servirTesela(e) {
  e.respondWith(
    caches.open(TESELAS).then(async (cache) => {
      const guardada = await cache.match(e.request);
      if (guardada) return guardada;
      try {
        const r = await fetch(e.request);
        if (r.ok || r.type === "opaque") {
          cache.put(e.request, r.clone());
          if (++puestas % 50 === 0) recortarTeselas(cache);
        }
        return r;
      } catch {
        return new Response(TESELA_VACIA, { headers: { "Content-Type": "image/png" } });
      }
    }),
  );
}

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  if (HOSTS_TESELAS.some((h) => url.hostname.endsWith(h))) return servirTesela(e);
  if (url.origin !== location.origin || !url.pathname.startsWith(BASE) || url.pathname.startsWith(BASE + "api/")) return;
  const peticion = e.request.mode === "navigate" ? new Request(BASE) : e.request;
  e.respondWith(
    conTiempoMaximo(fetch(e.request), TIEMPO_MAX_MS)
      .then((r) => {
        if (r.ok) caches.open(CACHE).then((c) => c.put(peticion, r.clone()));
        return r;
      })
      .catch(() => caches.match(peticion).then((c) => c || caches.match(BASE))),
  );
});
