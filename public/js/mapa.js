// Mapa de campo: grabación de la ruta, setales marcados, ayuda para volver y mapa sin conexión.
import { $, $$, esc, registrarVista, toast, fechaCorta } from "./ui.js";
import { especies, especie } from "./datos.js";
import * as geo from "./geo.js";

const CAPAS = {
  "Topográfico": { url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", opciones: { maxZoom: 17, subdomains: "abc", attribution: "© OpenStreetMap, SRTM · OpenTopoMap (CC-BY-SA)" } },
  "Callejero": { url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png", opciones: { maxZoom: 19, attribution: "© OpenStreetMap" } },
};
const CANTIDADES = { pocas: ["Pocas", "#9e9e9e"], bastantes: ["Bastantes", "#2f5d3a"], muchas: ["Muchas", "#d97a00"] };
const PRECISION_MAXIMA = 60; // m: posiciones peores se ignoran para la ruta
const MIN_DIST = 5; // m entre puntos guardados
const MAX_TESELAS = 600; // por cada "guardar zona"

const st = {
  mapa: null, capaBase: null, capas: {}, trazo: null, marcadorPos: null, circuloPrec: null, capaSetales: null, capaRutaVista: null, trazoVuelta: null,
  grabando: false, ruta: null, watchId: null, wakeLock: null, ultimaPos: null, rumboDispositivo: null, simulador: null, guardadoPendiente: null,
};

// ---------------------------------------------------------------------------
// Carga de Leaflet (solo cuando se abre el mapa; queda en caché para el campo)
// ---------------------------------------------------------------------------

let cargaL = null;
function cargarLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (!cargaL) cargaL = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "vendor/leaflet/leaflet.js";
    s.onload = () => resolve(window.L);
    s.onerror = () => reject(new Error("No se ha podido cargar el mapa"));
    document.head.appendChild(s);
  });
  return cargaL;
}

// ---------------------------------------------------------------------------
// Vista
// ---------------------------------------------------------------------------

function plantilla() {
  return `
    <div class="mapa-cabecera">
      <span id="gps-estado" class="pill-gps">GPS…</span>
      <div class="mapa-botones-mini">
        <button id="btn-centrar" title="Centrar en mi posición">◎</button>
        <button id="btn-capa" title="Cambiar mapa">⛰</button>
      </div>
    </div>
    <div id="mapa" class="mapa"></div>
    <div id="aviso-gps" class="tarjeta aviso-red oculto"></div>
    <div class="mapa-panel">
      <div class="mapa-stats" id="mapa-stats"></div>
      <div class="fila-botones">
        <button class="principal" id="btn-grabar">Grabar ruta</button>
        <button class="secundario" id="btn-setal">Marcar setal aquí</button>
      </div>
      <button class="secundario btn-volver" id="btn-volver">¿Perdido? Volver al inicio</button>
      <div id="panel-volver" class="tarjeta panel-volver oculto"></div>
    </div>
    <details class="contexto"><summary>Rutas guardadas</summary><div id="lista-rutas"></div></details>
    <details class="contexto"><summary>Setales guardados</summary><div id="lista-setales"></div></details>
    <details class="contexto"><summary>Mapa sin conexión</summary>
      <p class="sub">Cuando tengas red, encuadra la zona a la que vas a ir y guárdala: las teselas del mapa quedarán en el móvil. Tu posición, la ruta y los setales funcionan sin red aunque no haya mapa de fondo.</p>
      <button class="secundario" id="btn-guardar-zona">Guardar esta zona para usarla sin red</button>
      <p id="zona-progreso" class="sub"></p>
    </details>
    <p class="nota-pie">Todo se guarda solo en tu móvil. Para la ruta, mantén la app abierta: la pantalla se mantiene encendida mientras grabas.</p>`;
}

async function render() {
  const cont = $("#vista-mapa");
  if (!cont.dataset.montado) {
    cont.innerHTML = plantilla();
    cont.dataset.montado = "1";
    try { await cargarLeaflet(); } catch (e) { cont.innerHTML = `<p class="vacio">${esc(e.message)}</p>`; return; }
    crearMapa();
    conectarBotones();
    await recuperarRutaEnCurso();
    await pintarSetales();
    await pintarListas();
    iniciarGPS();
  }
  setTimeout(() => st.mapa?.invalidateSize(), 50);
  pintarStats();
}

function crearMapa() {
  const L = window.L;
  st.mapa = L.map("mapa", { zoomControl: true, attributionControl: true }).setView([40.4, -3.7], 6);
  for (const [nombre, c] of Object.entries(CAPAS)) st.capas[nombre] = L.tileLayer(c.url, c.opciones);
  st.capaBase = "Topográfico";
  st.capas[st.capaBase].addTo(st.mapa);
  st.trazo = L.polyline([], { color: "#1565c0", weight: 4, opacity: 0.85 }).addTo(st.mapa);
  st.trazoVuelta = L.polyline([], { color: "#c62828", weight: 5, dashArray: "6 8", opacity: 0.9 });
  st.capaSetales = L.layerGroup().addTo(st.mapa);
  st.capaRutaVista = L.polyline([], { color: "#6d6d6d", weight: 3, dashArray: "4 6" }).addTo(st.mapa);
  st.mapa.on("click", () => {});
  // Posición anterior conocida
  try {
    const u = JSON.parse(localStorage.getItem("micelio.ultima_pos") || "null");
    if (u) st.mapa.setView([u.lat, u.lon], 14);
  } catch {}
}

function conectarBotones() {
  $("#btn-grabar").addEventListener("click", () => (st.grabando ? detenerGrabacion() : iniciarGrabacion()));
  $("#btn-setal").addEventListener("click", abrirDialogoSetal);
  $("#btn-volver").addEventListener("click", alternarPanelVolver);
  $("#btn-centrar").addEventListener("click", () => { if (st.ultimaPos) st.mapa.setView([st.ultimaPos.lat, st.ultimaPos.lon], Math.max(st.mapa.getZoom(), 15)); else toast("Todavía no hay posición GPS."); });
  $("#btn-capa").addEventListener("click", () => {
    const nombres = Object.keys(CAPAS);
    const siguiente = nombres[(nombres.indexOf(st.capaBase) + 1) % nombres.length];
    st.mapa.removeLayer(st.capas[st.capaBase]);
    st.capaBase = siguiente;
    st.capas[siguiente].addTo(st.mapa);
    toast(`Mapa: ${siguiente}`);
  });
  $("#btn-guardar-zona").addEventListener("click", guardarZona);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && st.grabando) pedirWakeLock(); });
}

// ---------------------------------------------------------------------------
// GPS
// ---------------------------------------------------------------------------

function estadoGps(texto, clase = "") {
  const p = $("#gps-estado");
  if (p) { p.textContent = texto; p.className = `pill-gps ${clase}`; }
}

function iniciarGPS() {
  const simular = new URLSearchParams(location.search).get("simular");
  if (simular) { iniciarSimulador(); return; }
  if (!("geolocation" in navigator)) { avisoGps("Este navegador no tiene GPS."); return; }
  if (!window.isSecureContext) {
    avisoGps("El GPS solo funciona si la app se abre por HTTPS (o en localhost). Instálala desde una dirección https: el README explica cómo.");
    return;
  }
  st.watchId = navigator.geolocation.watchPosition(onPosicion, (err) => {
    estadoGps("Sin GPS", "off");
    if (err.code === 1) avisoGps("Has denegado el permiso de ubicación. Actívalo en los ajustes del navegador para este sitio.");
    else if (err.code === 2) avisoGps("No se consigue posición. Al aire libre, con el GPS activado, tarda menos de un minuto.");
  }, { enableHighAccuracy: true, maximumAge: 3000, timeout: 30000 });
  estadoGps("Buscando GPS…");
  if ("ondeviceorientationabsolute" in window) window.addEventListener("deviceorientationabsolute", onOrientacion);
  else window.addEventListener("deviceorientation", onOrientacion);
}

function onOrientacion(e) {
  if (typeof e.webkitCompassHeading === "number") st.rumboDispositivo = e.webkitCompassHeading;
  else if (e.absolute && typeof e.alpha === "number") st.rumboDispositivo = (360 - e.alpha) % 360;
}

function avisoGps(msg) {
  const el = $("#aviso-gps");
  if (!el) return;
  el.innerHTML = `<strong>Ubicación</strong><p style="margin:4px 0 0">${esc(msg)}</p>`;
  el.classList.remove("oculto");
}

function onPosicion(pos) {
  const c = pos.coords;
  const p = { lat: c.latitude, lon: c.longitude, alt: c.altitude, acc: c.accuracy, t: pos.timestamp || Date.now() };
  st.ultimaPos = p;
  $("#aviso-gps")?.classList.add("oculto");
  estadoGps(`GPS ±${Math.round(p.acc)} m`, p.acc <= 25 ? "ok" : p.acc <= PRECISION_MAXIMA ? "regular" : "mala");
  try { localStorage.setItem("micelio.ultima_pos", JSON.stringify({ lat: p.lat, lon: p.lon })); } catch {}
  pintarPosicion(p);
  if (st.grabando) registrarPunto(p);
  if (!$("#panel-volver").classList.contains("oculto")) pintarPanelVolver();
}

function pintarPosicion(p) {
  const L = window.L;
  const ll = [p.lat, p.lon];
  if (!st.marcadorPos) {
    st.circuloPrec = L.circle(ll, { radius: p.acc, color: "#1565c0", weight: 1, fillOpacity: 0.08 }).addTo(st.mapa);
    st.marcadorPos = L.circleMarker(ll, { radius: 8, color: "#fff", weight: 2, fillColor: "#1565c0", fillOpacity: 1 }).addTo(st.mapa);
    st.mapa.setView(ll, 16);
  } else {
    st.marcadorPos.setLatLng(ll);
    st.circuloPrec.setLatLng(ll).setRadius(p.acc);
    if (st.grabando) st.mapa.panTo(ll, { animate: true });
  }
}

// ---------------------------------------------------------------------------
// Grabación de ruta
// ---------------------------------------------------------------------------

async function iniciarGrabacion() {
  st.ruta = { id: geo.nuevoId(), nombre: `Ruta ${new Date().toLocaleDateString("es-ES")} ${new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}`, inicio: Date.now(), fin: null, puntos: [], setales: [] };
  st.grabando = true;
  st.trazo.setLatLngs([]);
  if (st.ultimaPos) registrarPunto(st.ultimaPos);
  $("#btn-grabar").textContent = "Detener y guardar";
  $("#btn-grabar").classList.add("grabando");
  pedirWakeLock();
  await geo.estado.escribir("rutaEnCurso", st.ruta);
  pintarStats();
  toast("Grabando la ruta. Mantén la app abierta.");
}

function registrarPunto(p) {
  if (p.acc > PRECISION_MAXIMA) return;
  const ult = st.ruta.puntos[st.ruta.puntos.length - 1];
  if (ult && geo.distancia(ult, p) < MIN_DIST && p.t - ult.t < 30000) return;
  st.ruta.puntos.push({ lat: p.lat, lon: p.lon, alt: p.alt, t: p.t });
  st.trazo.addLatLng([p.lat, p.lon]);
  pintarStats();
  clearTimeout(st.guardadoPendiente);
  st.guardadoPendiente = setTimeout(() => geo.estado.escribir("rutaEnCurso", st.ruta).catch(() => {}), 4000);
}

async function detenerGrabacion() {
  st.grabando = false;
  st.ruta.fin = Date.now();
  st.ruta.distancia = geo.longitudRuta(st.ruta.puntos);
  $("#btn-grabar").textContent = "Grabar ruta";
  $("#btn-grabar").classList.remove("grabando");
  soltarWakeLock();
  const ruta = st.ruta;
  st.ruta = null;
  await geo.estado.borrar("rutaEnCurso");
  pintarStats();
  if (ruta.puntos.length < 2) { toast("Ruta demasiado corta: no se ha guardado."); return; }
  const nombre = await pedirNombre(ruta.nombre, ruta);
  ruta.nombre = nombre || ruta.nombre;
  await geo.rutas.guardar(ruta);
  toast(`Ruta guardada: ${geo.formatoDistancia(ruta.distancia)}.`);
  pintarListas();
}

function pedirNombre(valor, ruta) {
  return new Promise((resolve) => {
    const m = document.createElement("div");
    m.className = "modal";
    m.innerHTML = `
      <div class="modal-caja">
        <h2>Guardar ruta</h2>
        <p class="sub">${geo.formatoDistancia(ruta.distancia)} · ${geo.formatoDuracion(ruta.fin - ruta.inicio)} · ${ruta.setales.length} setales</p>
        <div class="campos"><label>Nombre <input id="ruta-nombre" value="${esc(valor)}" maxlength="80"></label></div>
        <button class="principal" id="ruta-ok">Guardar</button>
      </div>`;
    document.body.appendChild(m);
    const fin = () => { const v = $("#ruta-nombre", m).value.trim(); m.remove(); resolve(v); };
    $("#ruta-ok", m).addEventListener("click", fin);
    $("#ruta-nombre", m).addEventListener("keydown", (e) => { if (e.key === "Enter") fin(); });
    setTimeout(() => $("#ruta-nombre", m).select(), 50);
  });
}

async function recuperarRutaEnCurso() {
  const r = await geo.estado.leer("rutaEnCurso").catch(() => null);
  if (!r || !r.puntos?.length) return;
  if (confirm(`Hay una ruta a medias (${r.puntos.length} puntos, ${geo.formatoDistancia(geo.longitudRuta(r.puntos))}). ¿Seguir grabándola?`)) {
    st.ruta = r; st.grabando = true;
    st.trazo.setLatLngs(r.puntos.map((p) => [p.lat, p.lon]));
    $("#btn-grabar").textContent = "Detener y guardar";
    $("#btn-grabar").classList.add("grabando");
    pedirWakeLock();
    st.mapa.fitBounds(st.trazo.getBounds(), { padding: [20, 20] });
  } else {
    r.fin = Date.now(); r.distancia = geo.longitudRuta(r.puntos);
    await geo.rutas.guardar(r);
    await geo.estado.borrar("rutaEnCurso");
    toast("La ruta a medias se ha guardado tal cual.");
  }
}

async function pedirWakeLock() {
  try { if ("wakeLock" in navigator) st.wakeLock = await navigator.wakeLock.request("screen"); } catch {}
}
function soltarWakeLock() { try { st.wakeLock?.release(); } catch {} st.wakeLock = null; }

function pintarStats() {
  const el = $("#mapa-stats");
  if (!el) return;
  if (!st.grabando || !st.ruta) { el.innerHTML = `<span>Sin grabar</span>`; return; }
  const d = geo.longitudRuta(st.ruta.puntos);
  el.innerHTML = `<span class="punto-rec"></span><strong>${geo.formatoDistancia(d)}</strong> · ${geo.formatoDuracion(Date.now() - st.ruta.inicio)} · ${st.ruta.puntos.length} puntos · ${st.ruta.setales.length} setales`;
}
setInterval(() => { if (st.grabando) pintarStats(); }, 15000);

// ---------------------------------------------------------------------------
// Setales
// ---------------------------------------------------------------------------

function abrirDialogoSetal() {
  const pos = st.ultimaPos || (st.mapa ? { lat: st.mapa.getCenter().lat, lon: st.mapa.getCenter().lng, acc: null } : null);
  if (!pos) { toast("Sin posición: espera al GPS o mueve el mapa al punto."); return; }
  const opciones = especies().slice().sort((a, b) => a.comunes[0].localeCompare(b.comunes[0], "es")).map((e) => `<option value="${esc(e.comunes[0])} (${esc(e.cientifico)})"></option>`).join("");
  const m = document.createElement("div");
  m.className = "modal";
  m.innerHTML = `
    <div class="modal-caja">
      <h2>Marcar setal</h2>
      <p class="sub">${st.ultimaPos ? `Posición GPS (±${Math.round(pos.acc)} m)` : "Centro del mapa (sin GPS)"}: ${geo.formatoCoordenadas(pos)}</p>
      <div class="campos">
        <label>Seta <input id="setal-especie" list="lista-especies-setal" placeholder="Empieza a escribir…" autocomplete="off"><datalist id="lista-especies-setal">${opciones}</datalist></label>
        <label>Cantidad
          <div class="opciones mini" id="setal-cantidad">${Object.entries(CANTIDADES).map(([v, [t]]) => `<button type="button" class="opcion ${v === "bastantes" ? "elegida" : ""}" data-v="${v}"><strong>${t}</strong></button>`).join("")}</div>
        </label>
        <label>Nota <input id="setal-nota" placeholder="Bajo pinos jóvenes, ladera norte…" maxlength="200"></label>
      </div>
      <div class="fila-botones"><button class="secundario" id="setal-cancelar">Cancelar</button><button class="principal" id="setal-guardar">Guardar</button></div>
    </div>`;
  document.body.appendChild(m);
  let cantidad = "bastantes";
  for (const b of $$("#setal-cantidad .opcion", m)) b.addEventListener("click", () => { cantidad = b.dataset.v; for (const x of $$("#setal-cantidad .opcion", m)) x.classList.toggle("elegida", x === b); });
  $("#setal-cancelar", m).addEventListener("click", () => m.remove());
  $("#setal-guardar", m).addEventListener("click", async () => {
    const texto = $("#setal-especie", m).value.trim();
    const esp = especies().find((e) => texto.startsWith(e.comunes[0]) || texto.toLowerCase().includes(e.cientifico.toLowerCase()));
    const s = { id: geo.nuevoId(), lat: pos.lat, lon: pos.lon, acc: pos.acc, fecha: new Date().toISOString(), especieId: esp?.id || null, nombre: esp ? esp.comunes[0] : (texto || "Setal"), cantidad, nota: $("#setal-nota", m).value.trim(), rutaId: st.ruta?.id || null };
    await geo.setales.guardar(s);
    if (st.ruta) { st.ruta.setales.push(s.id); geo.estado.escribir("rutaEnCurso", st.ruta).catch(() => {}); }
    m.remove();
    toast("Setal guardado.");
    pintarSetales(); pintarListas(); pintarStats();
  });
  setTimeout(() => $("#setal-especie", m).focus(), 50);
}

async function pintarSetales() {
  const L = window.L;
  st.capaSetales.clearLayers();
  const lista = await geo.setales.listar().catch(() => []);
  for (const s of lista) {
    const [, color] = CANTIDADES[s.cantidad] || CANTIDADES.bastantes;
    const e = s.especieId ? especie(s.especieId) : null;
    L.circleMarker([s.lat, s.lon], { radius: 9, color: "#fff", weight: 2, fillColor: color, fillOpacity: 0.95 })
      .bindPopup(`<strong>${esc(s.nombre)}</strong>${e ? `<br><em>${esc(e.cientifico)}</em>` : ""}<br>${CANTIDADES[s.cantidad]?.[0] || ""} · ${fechaCorta(s.fecha)}${s.nota ? `<br>${esc(s.nota)}` : ""}`)
      .addTo(st.capaSetales);
  }
}

// ---------------------------------------------------------------------------
// Volver al inicio
// ---------------------------------------------------------------------------

function alternarPanelVolver() {
  const p = $("#panel-volver");
  p.classList.toggle("oculto");
  if (!p.classList.contains("oculto")) pintarPanelVolver();
  else st.mapa.removeLayer(st.trazoVuelta);
}

function pintarPanelVolver() {
  const p = $("#panel-volver");
  const pos = st.ultimaPos;
  const puntos = st.ruta?.puntos || [];
  const inicio = puntos[0];
  if (!pos) { p.innerHTML = `<strong>Sin posición GPS todavía.</strong><p>Si necesitas ayuda, llama al <a href="tel:112">112</a>.</p>`; return; }
  const partes = [`<p class="sub">Tu posición: <strong>${geo.formatoCoordenadas(pos)}</strong> <button class="enlace" id="copiar-pos">copiar</button></p>`];
  if (inicio) {
    const d = geo.distancia(pos, inicio), r = geo.rumbo(pos, inicio);
    const rel = st.rumboDispositivo == null ? r : (r - st.rumboDispositivo + 360) % 360;
    partes.push(`
      <div class="brujula"><div class="flecha" style="transform: rotate(${rel - 90}deg)">➤</div>
        <div><strong>${geo.formatoDistancia(d)}</strong> hasta el inicio en línea recta<br><span class="sub">Rumbo ${Math.round(r)}° (${geo.puntoCardinal(r)})${st.rumboDispositivo == null ? " · la flecha es respecto al norte" : " · la flecha apunta al inicio"}</span></div></div>
      <p>El rastro rojo del mapa es tu camino de vuelta: deshazlo paso a paso.</p>`);
    st.trazoVuelta.setLatLngs(puntos.slice().reverse().map((q) => [q.lat, q.lon])).addTo(st.mapa);
    st.mapa.fitBounds(st.trazoVuelta.getBounds().extend([pos.lat, pos.lon]), { padding: [30, 30] });
  } else {
    partes.push(`<p>No hay ruta grabada en esta salida, así que no hay rastro que seguir. Usa el mapa y tu posición.</p>`);
  }
  partes.push(`<p class="sub">Si no puedes volver: llama al <a href="tel:112"><strong>112</strong></a> y dales esas coordenadas. Ahorra batería: baja el brillo y cierra otras apps.</p>`);
  p.innerHTML = partes.join("");
  $("#copiar-pos")?.addEventListener("click", () => navigator.clipboard?.writeText(geo.formatoCoordenadas(pos)).then(() => toast("Coordenadas copiadas")));
}

// ---------------------------------------------------------------------------
// Listas y GPX
// ---------------------------------------------------------------------------

async function pintarListas() {
  const rutas = (await geo.rutas.listar().catch(() => [])).sort((a, b) => b.inicio - a.inicio);
  const setales = (await geo.setales.listar().catch(() => [])).sort((a, b) => (b.fecha > a.fecha ? 1 : -1));
  const lr = $("#lista-rutas"), ls = $("#lista-setales");
  if (!lr || !ls) return;
  lr.innerHTML = rutas.length ? rutas.map((r) => `
    <div class="fila-item">
      <div class="texto"><strong>${esc(r.nombre)}</strong><span class="sub">${geo.formatoDistancia(r.distancia || geo.longitudRuta(r.puntos))} · ${geo.formatoDuracion((r.fin || r.inicio) - r.inicio)} · ${r.puntos.length} puntos</span></div>
      <div class="acciones-mini"><button data-ver="${r.id}">Ver</button><button data-gpx="${r.id}">GPX</button><button data-borrar-ruta="${r.id}">Borrar</button></div>
    </div>`).join("") : `<p class="vacio">Aún no hay rutas.</p>`;
  ls.innerHTML = setales.length ? setales.map((s) => `
    <div class="fila-item">
      <span class="punto" style="background:${CANTIDADES[s.cantidad]?.[1] || "#999"}"></span>
      <div class="texto"><strong>${esc(s.nombre)}</strong><span class="sub">${CANTIDADES[s.cantidad]?.[0] || ""} · ${fechaCorta(s.fecha)}${s.nota ? ` · ${esc(s.nota)}` : ""}</span></div>
      <div class="acciones-mini"><button data-ir-setal="${s.id}">Ir</button><button data-borrar-setal="${s.id}">Borrar</button></div>
    </div>`).join("") : `<p class="vacio">Aún no hay setales.</p>`;

  for (const b of $$("[data-ver]", lr)) b.addEventListener("click", async () => {
    const r = rutas.find((x) => x.id === b.dataset.ver);
    st.capaRutaVista.setLatLngs(r.puntos.map((p) => [p.lat, p.lon]));
    st.mapa.fitBounds(st.capaRutaVista.getBounds(), { padding: [20, 20] });
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
  for (const b of $$("[data-gpx]", lr)) b.addEventListener("click", async () => {
    const r = rutas.find((x) => x.id === b.dataset.gpx);
    const sus = setales.filter((s) => s.rutaId === r.id).map((s) => ({ ...s, descripcion: `${CANTIDADES[s.cantidad]?.[0] || ""}. ${s.nota || ""}` }));
    descargar(`${r.nombre.replace(/[^\w\-]+/g, "_")}.gpx`, geo.aGPX({ nombre: r.nombre, puntos: r.puntos, setales: sus }), "application/gpx+xml");
  });
  for (const b of $$("[data-borrar-ruta]", lr)) b.addEventListener("click", async () => { if (confirm("¿Borrar esta ruta?")) { await geo.rutas.eliminar(b.dataset.borrarRuta); pintarListas(); } });
  for (const b of $$("[data-ir-setal]", ls)) b.addEventListener("click", () => { const s = setales.find((x) => x.id === b.dataset.irSetal); st.mapa.setView([s.lat, s.lon], 16); window.scrollTo({ top: 0, behavior: "smooth" }); });
  for (const b of $$("[data-borrar-setal]", ls)) b.addEventListener("click", async () => { if (confirm("¿Borrar este setal?")) { await geo.setales.eliminar(b.dataset.borrarSetal); pintarSetales(); pintarListas(); } });
}

function descargar(nombre, contenido, tipo) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([contenido], { type: tipo }));
  a.download = nombre;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// ---------------------------------------------------------------------------
// Mapa sin conexión: prefetch de teselas de la zona visible
// ---------------------------------------------------------------------------

function teselasDe(bounds, z) {
  const n = 2 ** z;
  const x = (lon) => Math.floor(((lon + 180) / 360) * n);
  const y = (lat) => Math.floor(((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) * n);
  const out = [];
  for (let i = x(bounds.getWest()); i <= x(bounds.getEast()); i++) for (let j = y(bounds.getNorth()); j <= y(bounds.getSouth()); j++) out.push({ z, x: i, y: j });
  return out;
}

async function guardarZona() {
  if (!navigator.onLine) { toast("Hace falta red para guardar el mapa."); return; }
  const capa = CAPAS[st.capaBase];
  const bounds = st.mapa.getBounds();
  const z0 = Math.max(st.mapa.getZoom(), 12);
  let teselas = [];
  for (let z = z0; z <= Math.min(z0 + 3, capa.opciones.maxZoom, 16); z++) teselas = teselas.concat(teselasDe(bounds, z));
  if (teselas.length > MAX_TESELAS) { toast(`Zona demasiado grande (${teselas.length} teselas). Acerca el mapa.`); return; }
  const prog = $("#zona-progreso");
  let hechas = 0, fallos = 0;
  const subs = (capa.opciones.subdomains || "a").split("");
  const urlDe = (t, i) => capa.url.replace("{s}", subs[i % subs.length]).replace("{z}", t.z).replace("{x}", t.x).replace("{y}", t.y);
  prog.textContent = `Guardando 0 de ${teselas.length}…`;
  const lotes = [];
  for (let i = 0; i < teselas.length; i += 6) lotes.push(teselas.slice(i, i + 6));
  for (const lote of lotes) {
    await Promise.all(lote.map((t, i) => fetch(urlDe(t, i), { mode: "no-cors" }).then(() => hechas++).catch(() => fallos++)));
    prog.textContent = `Guardando ${hechas + fallos} de ${teselas.length}…`;
  }
  prog.textContent = `Zona guardada: ${hechas} teselas (${st.capaBase})${fallos ? `, ${fallos} fallaron` : ""}.`;
}

// ---------------------------------------------------------------------------
// Simulador (?simular=1) para probar sin GPS: un paseo por un pinar
// ---------------------------------------------------------------------------

function iniciarSimulador() {
  let lat = 40.880, lon = -4.030, t = 0, ang = 0.4;
  estadoGps("GPS simulado", "ok");
  st.simulador = setInterval(() => {
    ang += (Math.random() - 0.5) * 0.6;
    lat += Math.cos(ang) * 0.00012; lon += Math.sin(ang) * 0.00016; t += 3000;
    onPosicion({ coords: { latitude: lat, longitude: lon, altitude: 1200 + Math.random() * 5, accuracy: 8 + Math.random() * 10 }, timestamp: Date.now() });
  }, 1500);
}

registrarVista("mapa", render);
