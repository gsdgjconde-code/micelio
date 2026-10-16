// Historial: reconocimientos en el móvil, segundas opiniones de la IA y resultados de la clave.
import { $, $$, esc, ICONOS, fechaCorta, navegar, registrarVista, toast } from "./ui.js";
import { historial } from "./almacen.js";

const ORIGEN = { vision: "reconocido en el móvil", ia: "segunda opinión IA", clave: "clave de campo" };

export function render() {
  const cont = $("#vista-historial");
  const h = historial.leer();
  cont.innerHTML = `
    <h2>Historial</h2>
    <p class="sub">Se guarda solo en este dispositivo.</p>
    ${h.length ? `<div id="lista-historial" style="margin-top:12px"></div><button class="secundario" id="btn-borrar-historial">Borrar historial</button>` : `<p class="vacio">Todavía no has identificado ninguna seta.</p>`}`;
  if (!h.length) return;
  $("#lista-historial").innerHTML = h.map((e) => `
    <button type="button" class="entrada" data-id="${e.id}">
      ${e.miniatura ? `<img src="${e.miniatura}" alt="">` : `<span class="sin-foto">${e.origen === "clave" ? ICONOS.clave : ICONOS.seta}</span>`}
      <div class="texto">
        <strong>${esc(e.titulo || e.nombre || "Identificación")}</strong>
        <em>${esc(e.subtitulo || e.cientifico || "")}</em>
        <span class="fecha">${fechaCorta(e.fecha)} · ${ORIGEN[e.origen] || "IA"}</span>
      </div>
      <span class="punto ${e.semaforo || "gris"}"></span>
    </button>`).join("");
  for (const b of $$(".entrada[data-id]", cont)) {
    b.addEventListener("click", () => {
      const e = h.find((x) => x.id === b.dataset.id);
      if (!e) return;
      if (e.origen === "clave") navegar("clave", { respuestas: e.datos.respuestas });
      else if (e.origen === "vision") navegar("resultado-vision", { resultado: e.datos });
      else navegar("resultado-ia", { cuerpo: e.datos?.resultado ? e.datos : { resultado: e.resultado } });
    });
  }
  $("#btn-borrar-historial").addEventListener("click", () => {
    if (confirm("¿Borrar todo el historial de este dispositivo?")) { historial.borrar(); toast("Historial borrado"); render(); }
  });
}

registrarVista("historial", render);
