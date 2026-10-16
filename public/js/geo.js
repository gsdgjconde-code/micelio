// Geografía y almacenamiento del mapa: distancias, rumbos, GPX y base de datos local
// (IndexedDB) de rutas y setales. Sin DOM: las funciones de cálculo se prueban en Node.

const R = 6371000;
const rad = (g) => (g * Math.PI) / 180;
const grad = (r) => (r * 180) / Math.PI;

/** Distancia en metros entre dos puntos { lat, lon } (haversine). */
export function distancia(a, b) {
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Rumbo inicial en grados (0 = norte, 90 = este) para ir de a hasta b. */
export function rumbo(a, b) {
  const dLon = rad(b.lon - a.lon);
  const y = Math.sin(dLon) * Math.cos(rad(b.lat));
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(dLon);
  return (grad(Math.atan2(y, x)) + 360) % 360;
}

export function puntoCardinal(g) {
  const n = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"];
  return n[Math.round((((g % 360) + 360) % 360) / 45) % 8];
}

export function longitudRuta(puntos) {
  let total = 0;
  for (let i = 1; i < puntos.length; i++) total += distancia(puntos[i - 1], puntos[i]);
  return total;
}

export function formatoDistancia(m) {
  if (!Number.isFinite(m)) return "–";
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(m < 10000 ? 1 : 0).replace(".", ",")} km`;
}

export function formatoDuracion(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h ? `${h} h ${String(m).padStart(2, "0")} min` : `${m} min`;
}

export function formatoCoordenadas(p) {
  return `${p.lat.toFixed(5)}, ${p.lon.toFixed(5)}`;
}

const escXml = (s) => String(s ?? "").replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]));

/** Genera un archivo GPX con la ruta (trk) y los setales (wpt). */
export function aGPX({ nombre, puntos = [], setales = [] }) {
  const wpts = setales.map((s) => `  <wpt lat="${s.lat}" lon="${s.lon}"><name>${escXml(s.nombre)}</name><desc>${escXml(s.descripcion || "")}</desc>${s.fecha ? `<time>${s.fecha}</time>` : ""}</wpt>`).join("\n");
  const trkpts = puntos.map((p) => `      <trkpt lat="${p.lat}" lon="${p.lon}">${p.alt != null ? `<ele>${p.alt}</ele>` : ""}${p.t ? `<time>${new Date(p.t).toISOString()}</time>` : ""}</trkpt>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Micelio" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>${escXml(nombre)}</name></metadata>
${wpts}
  <trk><name>${escXml(nombre)}</name><trkseg>
${trkpts}
  </trkseg></trk>
</gpx>
`;
}

// ---------------------------------------------------------------------------
// IndexedDB: rutas, setales y ruta en curso
// ---------------------------------------------------------------------------

const DB = "micelio-mapa";
const VERSION = 1;

function abrir() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const nombre of ["rutas", "setales", "estado"]) {
        if (!db.objectStoreNames.contains(nombre)) db.createObjectStore(nombre, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(store, modo, fn) {
  return abrir().then((db) => new Promise((resolve, reject) => {
    const t = db.transaction(store, modo);
    const req = fn(t.objectStore(store));
    t.oncomplete = () => resolve(req?.result);
    t.onerror = () => reject(t.error);
  }));
}

const tabla = (store) => ({
  guardar: (obj) => tx(store, "readwrite", (s) => s.put(obj)).then(() => obj),
  listar: () => tx(store, "readonly", (s) => s.getAll()).then((r) => r || []),
  obtener: (id) => tx(store, "readonly", (s) => s.get(id)),
  eliminar: (id) => tx(store, "readwrite", (s) => s.delete(id)),
});

export const rutas = tabla("rutas");
export const setales = tabla("setales");
export const estado = {
  leer: (clave) => tx("estado", "readonly", (s) => s.get(clave)).then((r) => r?.valor),
  escribir: (clave, valor) => tx("estado", "readwrite", (s) => s.put({ id: clave, valor })),
  borrar: (clave) => tx("estado", "readwrite", (s) => s.delete(clave)),
};

export const nuevoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
