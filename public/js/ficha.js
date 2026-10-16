// Ficha de especie y fila resumen reutilizable en listas.
import { $, esc, lista, ETIQUETA, ICONOS, mesesHtml, navegar, registrarVista } from "./ui.js";
import { especie } from "./datos.js";

const VEREDICTO_ESPECIE = {
  comestible: "Comestible. Confírmala siempre antes de comerla.",
  comestible_con_precaucion: "Comestible solo con precauciones. Lee la ficha.",
  no_comestible: "No se come.",
  toxica: "Tóxica. No la cojas.",
  mortal: "MORTAL. No la toques ni la mezcles con otras.",
};

const ARBOL = { pino: "pino", abeto: "abeto", haya: "haya", roble: "roble", encina: "encina / alcornoque", castano: "castaño", chopo: "chopo", abedul: "abedul", avellano: "avellano", olivo: "olivo", eucalipto: "eucalipto", ninguno: "sin árboles", cualquiera: "varios" };
const SUSTRATO = { suelo: "suelo", prado: "prado", madera: "madera", estiercol: "estiércol", arena: "arena" };

export function filaEspecie(e, { pct = null, extra = "", accion = "ficha" } = {}) {
  return `
    <button type="button" class="fila-especie" data-ir="${accion}" data-params='${JSON.stringify({ id: e.id }).replace(/'/g, "&#39;")}'>
      <span class="franja ${e.semaforo}"></span>
      <span class="texto">
        <strong>${esc(e.comunes[0])}</strong>
        <em>${esc(e.cientifico)}</em>
        ${extra}
      </span>
      <span class="meta">
        <span class="chip ${e.comestibilidad}">${ETIQUETA[e.comestibilidad]}</span>
        ${pct !== null ? `<span class="pct">${pct} %</span>` : ""}
      </span>
    </button>`;
}

export function render({ id, volverA } = {}) {
  const e = especie(id);
  const cont = $("#vista-ficha");
  if (!e) { cont.innerHTML = `<p class="vacio">Especie no encontrada.</p>`; return; }
  const r = e.rasgos;
  const confusiones = (e.confusiones || []).map((c) => {
    const otra = c.id ? especie(c.id) : null;
    const nombre = otra ? `${otra.comunes[0]} <em>${esc(otra.cientifico)}</em>` : `${esc(c.nombre || "")} <em>${esc(c.cientifico || "")}</em>`;
    const chip = otra ? `<span class="chip ${otra.comestibilidad}">${ETIQUETA[otra.comestibilidad]}</span>` : "";
    const boton = otra ? `<button class="enlace" data-ir="ficha" data-params='${JSON.stringify({ id: otra.id })}'>Ver ficha →</button>` : "";
    return `<div class="confusion"><div class="cab"><strong>${nombre}</strong>${chip}</div><p>${esc(c.como_distinguir)}</p>${boton}</div>`;
  }).join("");

  cont.innerHTML = `
    <button class="btn-atras" id="ficha-atras">${ICONOS.atras} Atrás</button>
    <div class="ficha-cabecera ${e.semaforo}">
      <h2>${esc(e.comunes[0])}</h2>
      <p class="cientifico">${esc(e.cientifico)}</p>
      <span class="chip">${ETIQUETA[e.comestibilidad]}</span>
      <p class="veredicto-especie">${VEREDICTO_ESPECIE[e.comestibilidad]}</p>
    </div>

    <article class="tarjeta">
      <p>${esc(e.resumen)}</p>
      ${e.comunes.length > 1 ? `<p class="sub">También: ${esc(e.comunes.slice(1).join(", "))}</p>` : ""}
      <div class="etiquetas"><span class="chip suave">${esc(e.grupo)}</span>${(r.sustrato || []).map((s) => `<span class="chip suave">${SUSTRATO[s] || s}</span>`).join("")}${(r.arboles || []).map((a) => `<span class="chip suave">${ARBOL[a] || a}</span>`).join("")}</div>
      <h3>Época</h3>
      ${mesesHtml(r.meses || [])}
    </article>

    <article class="tarjeta">
      <h3>Cómo reconocerla</h3>
      <dl class="dl">
        <dt>Sombrero</dt><dd>${esc(e.descripcion.sombrero)}</dd>
        <dt>Debajo</dt><dd>${esc(e.descripcion.himenio)}</dd>
        <dt>Pie</dt><dd>${esc(e.descripcion.pie)}</dd>
        <dt>Carne</dt><dd>${esc(e.descripcion.carne)}</dd>
        <dt>Dónde</dt><dd>${esc(e.descripcion.habitat)}</dd>
      </dl>
    </article>

    ${e.confirmar?.length ? `<article class="tarjeta"><h3>Comprueba en el campo</h3><ul class="checklist">${e.confirmar.map((c) => `<li><span class="marca"></span><span>${esc(c)}</span></li>`).join("")}</ul></article>` : ""}

    ${confusiones ? `<article class="tarjeta ${["comestible", "comestible_con_precaucion"].includes(e.comestibilidad) ? "peligro" : ""}"><h3>Se confunde con</h3>${confusiones}</article>` : ""}

    <article class="tarjeta"><h3>Precauciones</h3><p>${esc(e.precauciones)}</p>${e.normativa ? `<h3>Normativa</h3><p>${esc(e.normativa)}</p>` : ""}</article>

    <p class="aviso-final">Información orientativa. Ante cualquier duda, no la comas.</p>`;
  $("#ficha-atras").addEventListener("click", () => (volverA ? navegar(volverA.vista, volverA.params || {}) : history.back()));
}

registrarVista("ficha", render);
