// Utilidades de interfaz: selección, escape, navegación entre vistas, toasts e iconos.

export const $ = (sel, raiz = document) => raiz.querySelector(sel);
export const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];

export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export function lista(items, clase = "") {
  if (!items || items.length === 0) return "";
  return `<ul class="${clase}">${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`;
}

export const ETIQUETA = {
  comestible: "Comestible",
  comestible_con_precaucion: "Comestible con precaución",
  no_comestible: "No comestible",
  toxica: "Tóxica",
  mortal: "Mortal",
  desconocida: "Desconocida",
};

export const NIVEL = { rojo: "Rojo", ambar: "Ámbar", verde: "Verde" };

export const ICONOS = {
  camara: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.5"/></svg>',
  clave: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4v16"/><path d="M6 8h7a3 3 0 0 1 3 3v0a3 3 0 0 1-3 3H6"/><circle cx="19" cy="11" r="2"/><circle cx="6" cy="20" r="1.5"/><circle cx="6" cy="4" r="1.5"/></svg>',
  guia: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19a2 2 0 0 1 2-2h13"/><path d="M9 7h6"/></svg>',
  historial: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  atras: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>',
  mapa: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14"/><path d="M15 6v14"/></svg>',
  seta: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11a9 7 0 0 1 18 0H3z"/><path d="M9 11v7a3 3 0 0 0 6 0v-7"/></svg>',
};

// ---------------------------------------------------------------------------
// Navegación entre vistas con soporte del botón "atrás" del móvil
// ---------------------------------------------------------------------------

const alMostrar = new Map();
export function registrarVista(nombre, fn) { alMostrar.set(nombre, fn); }

export function navegar(nombre, params = {}, { sinHistorial = false, reemplazar = false } = {}) {
  const seccion = $(`#vista-${nombre}`);
  if (!seccion) return;
  for (const v of $$(".vista")) v.classList.add("oculto");
  seccion.classList.remove("oculto");
  const tab = seccion.dataset.tab;
  for (const b of $$(".tabs button")) b.classList.toggle("activa", b.dataset.tab === tab);
  alMostrar.get(nombre)?.(params);
  if (!sinHistorial) {
    const estado = { vista: nombre, params };
    if (reemplazar || !history.state) history.replaceState(estado, "");
    else history.pushState(estado, "");
  }
  window.scrollTo(0, 0);
}

window.addEventListener("popstate", (e) => {
  const s = e.state;
  if (s?.vista) navegar(s.vista, s.params || {}, { sinHistorial: true });
});

// Cualquier elemento con data-ir="vista" navega al pulsarlo
document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-ir]");
  if (!el) return;
  e.preventDefault();
  let params = {};
  try { params = el.dataset.params ? JSON.parse(el.dataset.params) : {}; } catch {}
  navegar(el.dataset.ir, params);
});

let temporizadorToast = null;
export function toast(msg, ms = 3200) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.remove("oculto");
  clearTimeout(temporizadorToast);
  temporizadorToast = setTimeout(() => t.classList.add("oculto"), ms);
}

export function mesesHtml(meses) {
  const n = ["E", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
  return `<div class="meses">${n.map((m, i) => `<span class="${meses.includes(i + 1) ? "on" : ""}">${m}</span>`).join("")}</div>`;
}

export function fechaCorta(iso) {
  try { return new Date(iso).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" }); } catch { return ""; }
}

/** Dirección base del servidor de la IA (vacía = mismo origen). Se define en config.js. */
export const API_BASE = (window.MICELIO?.apiBase || "").replace(/\/$/, "");
