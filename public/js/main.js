// Arranque de la app: carga la guía, monta los módulos y gestiona red, aviso y service worker.
import { $, $$, ICONOS, navegar, toast, API_BASE } from "./ui.js";
import { cargarEspecies } from "./datos.js";
import * as fotos from "./fotos.js";
import * as ia from "./ia.js";
import "./clave.js";
import "./guia.js";
import "./ficha.js";
import "./historial.js";
import "./mapa.js";

const CLAVE_AVISO = "setas.aviso_aceptado";

function avisoInicial() {
  let aceptado = false;
  try { aceptado = localStorage.getItem(CLAVE_AVISO) === "1"; } catch {}
  if (aceptado) return;
  $("#modal-aviso").classList.remove("oculto");
  $("#acepto").addEventListener("change", (e) => { $("#btn-aceptar").disabled = !e.target.checked; });
  $("#btn-aceptar").addEventListener("click", () => {
    try { localStorage.setItem(CLAVE_AVISO, "1"); } catch {}
    $("#modal-aviso").classList.add("oculto");
  });
}

function actualizarRed() {
  const on = navigator.onLine;
  const pill = $("#estado-red");
  pill.textContent = on ? "Con red" : "Sin conexión";
  pill.classList.toggle("off", !on);
}

async function estadoServidor() {
  try {
    const r = await fetch(`${API_BASE}/api/estado`, { cache: "no-store" }).then((x) => x.json());
    return { disponible: Boolean(r.ok), requiereToken: Boolean(r.requiereToken), demo: Boolean(r.demo) };
  } catch { return { disponible: false, requiereToken: false, demo: false }; }
}

async function iniciar() {
  for (const el of $$("[data-icono]")) el.innerHTML = ICONOS[el.dataset.icono] || "";
  for (const b of $$(".tabs button")) b.addEventListener("click", () => navegar(b.dataset.vista));

  avisoInicial();
  try { await cargarEspecies(); }
  catch (e) { toast("No se ha podido cargar la guía de especies."); console.error(e); }

  const srv = await estadoServidor();
  fotos.montar();
  ia.montar({ requiereToken: srv.requiereToken, disponible: srv.disponible });
  if (srv.demo) { const p = $("#estado-red"); p.textContent = "Modo demo"; }
  else actualizarRed();
  window.addEventListener("online", actualizarRed);
  window.addEventListener("offline", actualizarRed);

  const inicial = history.state?.vista || "captura";
  navegar(inicial, history.state?.params || {}, { reemplazar: true });

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
}

iniciar();
