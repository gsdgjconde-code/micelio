// Reconocimiento de imágenes en el propio dispositivo con TensorFlow.js.
// El modelo se descarga una vez (cuando hay red) y se guarda en IndexedDB,
// así que después funciona sin conexión.

const RUTA_MODELO = "modelo/model.json";
const RUTA_META = "modelo/meta.json";
const CLAVE_IDB = "indexeddb://setas-modelo";
const CLAVE_META = "setas.modelo.meta";

let modelo = null;
let meta = null;
let estadoActual = { estado: "cargando" };
const oyentes = new Set();

export function alCambiar(fn) { oyentes.add(fn); fn(estadoActual); }
export const estado = () => estadoActual;
export const metaModelo = () => meta;
function emitir(e) { estadoActual = e; for (const fn of oyentes) fn(e); }

let cargaTf = null;
function cargarTf() {
  if (window.tf) return Promise.resolve(window.tf);
  if (!cargaTf) {
    cargaTf = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "vendor/tf.min.js";
      s.onload = () => resolve(window.tf);
      s.onerror = () => reject(new Error("No se ha podido cargar TensorFlow.js"));
      document.head.appendChild(s);
    });
  }
  return cargaTf;
}

function leerMetaGuardada() {
  try { return JSON.parse(localStorage.getItem(CLAVE_META) || "null"); } catch { return null; }
}

async function cargarDesde(tf, ruta, opciones) {
  const formato = meta?.formato || "layers";
  return formato === "graph" ? tf.loadGraphModel(ruta, opciones) : tf.loadLayersModel(ruta, opciones);
}

export async function iniciar() {
  try {
    const tf = await cargarTf();
    meta = leerMetaGuardada();

    // 1) Modelo ya guardado en el dispositivo
    if (meta) {
      try { modelo = await cargarDesde(tf, CLAVE_IDB); } catch { modelo = null; }
    }

    // 2) Con red: comprueba si el servidor tiene un modelo nuevo
    if (navigator.onLine) {
      let remota = null;
      try { const r = await fetch(RUTA_META, { cache: "no-store" }); remota = r.ok ? await r.json() : null; } catch {}
      if (remota && (!modelo || remota.version !== meta?.version)) {
        emitir({ estado: "descargando", progreso: 0 });
        meta = remota;
        const nuevo = await cargarDesde(tf, RUTA_MODELO, { onProgress: (p) => emitir({ estado: "descargando", progreso: p }) });
        try { await nuevo.save(CLAVE_IDB); } catch {}
        try { localStorage.setItem(CLAVE_META, JSON.stringify(remota)); } catch {}
        if (modelo) modelo.dispose?.();
        modelo = nuevo;
      }
    }

    if (!modelo || !meta) { emitir({ estado: "no_instalado" }); return; }

    // Primera inferencia en vacío para que la siguiente sea rápida
    const t = meta.entrada?.tamano || 224;
    tf.tidy(() => { const y = modelo.predict(tf.zeros([1, t, t, 3])); return y; });
    emitir({ estado: "listo", meta });
  } catch (e) {
    console.error(e);
    emitir({ estado: "error", error: e.message });
  }
}

function recortarCentro(img, t) {
  const w = img.width, h = img.height;
  const lado = Math.min(w, h);
  const sx = (w - lado) / 2, sy = (h - lado) / 2;
  const c = document.createElement("canvas");
  c.width = t; c.height = t;
  c.getContext("2d").drawImage(img, sx, sy, lado, lado, 0, 0, t, t);
  return c;
}

function cargarImagen(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/**
 * Reconoce las fotos (dataURLs) y devuelve los candidatos ordenados: [{ id, p }].
 * Promedia las probabilidades de todas las fotos y de su reflejo horizontal.
 */
export async function reconocer(urls) {
  if (!modelo || !meta) throw new Error("El modelo de reconocimiento no está instalado.");
  const tf = window.tf;
  const t = meta.entrada?.tamano || 224;
  const rango = meta.entrada?.rango || "0-255";
  const etiquetas = meta.etiquetas;
  const sumas = new Float32Array(etiquetas.length);

  for (const url of urls) {
    const img = await cargarImagen(url);
    const canvas = recortarCentro(img, t);
    const probs = tf.tidy(() => {
      let x = tf.browser.fromPixels(canvas).toFloat().expandDims(0);
      if (rango === "0-1") x = x.div(255);
      else if (rango === "-1-1") x = x.div(127.5).sub(1);
      const y1 = modelo.predict(x);
      const y2 = modelo.predict(tf.reverse(x, 2));
      return tf.add(y1, y2).div(2).squeeze();
    });
    const arr = await probs.data();
    probs.dispose();
    for (let i = 0; i < sumas.length; i++) sumas[i] += arr[i] / urls.length;
  }

  return Array.from(sumas)
    .map((p, i) => ({ id: etiquetas[i], p }))
    .sort((a, b) => b.p - a.p)
    .slice(0, 5);
}
