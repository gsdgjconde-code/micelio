// Clave de campo: asistente paso a paso que funciona sin conexión.
import { $, $$, esc, ICONOS, registrarVista, navegar, toast } from "./ui.js";
import { especies } from "./datos.js";
import { CARACTERES, caracteresAplicables, puntuar, compatibles, alertas } from "./clave-motor.js";
import { historial } from "./almacen.js";

const estado = { modo: "intro", respuestas: {}, paso: 0 };

const PASOS_PREVIOS = [
  "Desentierra la base del pie entera, sin arrancar: la volva de las amanitas queda bajo tierra.",
  "Dale la vuelta y mira qué hay debajo del sombrero.",
  "Corta la seta a lo largo: observa si cambia de color o suelta líquido.",
  "Huele la carne recién cortada.",
  "Fíjate en los árboles que hay alrededor y en si crece en madera o en el suelo.",
];

function reiniciar() {
  estado.respuestas = { mes: new Date().getMonth() + 1 };
  estado.paso = 0;
}

function pasos() { return caracteresAplicables(estado.respuestas); }

function numCompatibles() { return compatibles(puntuar(especies(), sinMesSolo(estado.respuestas))).length; }

// Si solo se ha respondido el mes (rellenado automáticamente) no se cuenta como respuesta real
function sinMesSolo(r) {
  const claves = Object.keys(r).filter((k) => k !== "mes");
  return claves.length === 0 ? {} : r;
}

export function render(params = {}) {
  if (params.respuestas) { estado.respuestas = { ...params.respuestas }; estado.modo = "resultados"; }
  if (params.reiniciar || (estado.modo === "intro" && Object.keys(estado.respuestas).length === 0)) { reiniciar(); estado.modo = "intro"; }
  pintar();
}

function pintar() {
  const cont = $("#vista-clave");
  if (estado.modo === "intro") return pintarIntro(cont);
  if (estado.modo === "resultados") return pintarResultados(cont);
  return pintarPregunta(cont);
}

function pintarIntro(cont) {
  cont.innerHTML = `
    <h2>Clave de campo</h2>
    <p class="sub">Funciona sin conexión. Responde solo lo que veas con claridad y salta el resto.</p>
    <article class="tarjeta">
      <h3>Antes de empezar</h3>
      <ol class="lista-pasos">${PASOS_PREVIOS.map((p, i) => `<li><span class="num">${i + 1}</span><span>${esc(p)}</span></li>`).join("")}</ol>
    </article>
    <button class="principal" id="clave-empezar">Empezar</button>
    <p class="nota-pie">La clave compara tus respuestas con ${especies().length} especies de la guía y te avisa de las confusiones peligrosas.</p>`;
  $("#clave-empezar").addEventListener("click", () => { reiniciar(); estado.modo = "pregunta"; pintar(); });
}

function pintarPregunta(cont) {
  const lista = pasos();
  if (estado.paso >= lista.length) { estado.modo = "resultados"; return pintar(); }
  const c = lista[estado.paso];
  const actual = estado.respuestas[c.id];
  const n = numCompatibles();
  const respondidas = Object.keys(sinMesSolo(estado.respuestas)).length;
  cont.innerHTML = `
    <div class="clave-progreso">
      <span>Paso ${estado.paso + 1} de ${lista.length}</span>
      <span class="contador">${respondidas ? `${n} especie${n === 1 ? "" : "s"} compatible${n === 1 ? "" : "s"}` : ""}</span>
    </div>
    <div class="clave-pregunta">${esc(c.pregunta)}</div>
    <p class="clave-ayuda">${esc(c.ayuda)}</p>
    <div class="opciones">
      ${c.opciones.map((o) => `<button type="button" class="opcion ${actual === o.v ? "elegida" : ""}" data-v="${esc(String(o.v))}"><strong>${esc(o.t)}</strong>${o.d ? `<small>${esc(o.d)}</small>` : ""}</button>`).join("")}
    </div>
    <div class="clave-barra">
      <div class="fila-botones">
        <button class="secundario" id="clave-atras" ${estado.paso === 0 ? "disabled" : ""}>Atrás</button>
        <button class="secundario" id="clave-saltar">No lo sé</button>
      </div>
      ${respondidas ? `<button class="principal" id="clave-ver" style="margin-top:10px">Ver resultados</button>` : ""}
    </div>`;

  for (const b of $$(".opcion", cont)) {
    b.addEventListener("click", () => {
      const o = c.opciones.find((x) => String(x.v) === b.dataset.v);
      estado.respuestas[c.id] = o.v;
      estado.paso++;
      pintar();
    });
  }
  $("#clave-atras").addEventListener("click", () => { estado.paso = Math.max(0, estado.paso - 1); pintar(); });
  $("#clave-saltar").addEventListener("click", () => { delete estado.respuestas[c.id]; estado.paso++; pintar(); });
  $("#clave-ver")?.addEventListener("click", () => { estado.modo = "resultados"; pintar(); });
}

const CORTO = { himenio: "Debajo", color_himenio: "Color debajo", insercion: "Láminas", anillo: "Anillo", volva: "Base", latex: "Látex", viraje: "Al corte", color_sombrero: "Sombrero", tamano: "Tamaño", olor: "Olor", sustrato: "Crece en", arboles: "Árboles", mes: "Mes", esporada: "Esporada" };
function etiquetaRespuesta(id, v) {
  const c = CARACTERES.find((x) => x.id === id);
  const o = c?.opciones.find((x) => x.v === v);
  return `${CORTO[id] || id}: ${o?.t ?? v}`;
}

function pintarResultados(cont) {
  const r = sinMesSolo(estado.respuestas);
  const resultados = puntuar(especies(), r);
  const comp = compatibles(resultados);
  const otras = resultados.filter((x) => !x.excluida && x.maximo > 0 && x.score < 0.6).slice(0, 8);
  const al = alertas(r, resultados);
  const respondidas = Object.keys(r);

  cont.innerHTML = `
    <button class="btn-atras" id="res-atras">${ICONOS.atras} Cambiar respuestas</button>
    <h2>Resultado de la clave</h2>
    <div class="respuestas">${respondidas.map((k) => `<button data-k="${k}">${esc(etiquetaRespuesta(k, r[k]))} ✕</button>`).join("")}</div>
    ${al.map((a) => `<div class="alerta ${a.nivel}"><strong>${esc(a.titulo)}</strong><p>${esc(a.texto)}</p></div>`).join("")}
    ${respondidas.length === 0 ? `<p class="vacio">No has respondido ninguna pregunta.</p>` : ""}
    ${comp.length ? `<h3>Especies compatibles (${comp.length})</h3><div class="lista-especies" id="lista-comp"></div>` : respondidas.length ? `<article class="tarjeta"><p>Ninguna especie de la guía encaja bien con lo que has indicado. Revisa las respuestas o haz fotos para identificarla con la IA cuando tengas red.</p></article>` : ""}
    ${otras.length ? `<details class="contexto"><summary>Otras menos probables (${otras.length})</summary><div class="lista-especies" id="lista-otras" style="margin-top:10px"></div></details>` : ""}
    <p class="aviso-final">La clave orienta; no sustituye a una persona experta. Abre la ficha de cada especie y comprueba los rasgos uno a uno.</p>
    <div class="fila-botones">
      <button class="secundario" id="res-guardar">Guardar en historial</button>
      <button class="secundario" id="res-nueva">Nueva clave</button>
    </div>`;

  const filaHtml = (x) => filaEspecieClave(x);
  if (comp.length) $("#lista-comp").innerHTML = comp.map(filaHtml).join("");
  if (otras.length) $("#lista-otras").innerHTML = otras.map(filaHtml).join("");

  $("#res-atras").addEventListener("click", () => { estado.modo = "pregunta"; estado.paso = 0; pintar(); });
  for (const b of $$(".respuestas button", cont)) {
    b.addEventListener("click", () => { delete estado.respuestas[b.dataset.k]; pintar(); });
  }
  $("#res-nueva").addEventListener("click", () => { reiniciar(); estado.modo = "pregunta"; pintar(); });
  $("#res-guardar").addEventListener("click", () => {
    const top = comp[0]?.especie;
    historial.agregar({
      origen: "clave",
      semaforo: top ? top.semaforo : "gris",
      titulo: top ? top.comunes[0] : "Sin coincidencias",
      subtitulo: top ? `${top.cientifico} · ${comp.length} compatibles` : "Clave de campo",
      datos: { respuestas: r },
    });
    toast("Guardado en el historial");
  });
}

function filaEspecieClave(x) {
  const e = x.especie;
  const pct = Math.round(x.score * 100);
  const fallos = x.fallos.filter((f) => f.suave).map((f) => CARACTERES.find((c) => c.id === f.caracter)?.pregunta);
  const nota = fallos.length ? `<span class="sub" style="font-size:0.8rem">Dudas: ${esc(fallos.map((p) => p.replace(/^¿|\?$/g, "").toLowerCase()).join("; "))}</span>` : "";
  return `
    <button type="button" class="fila-especie" data-ir="ficha" data-params='${JSON.stringify({ id: e.id, volverA: { vista: "clave", params: { respuestas: r_actual() } } })}'>
      <span class="franja ${e.semaforo}"></span>
      <span class="texto"><strong>${esc(e.comunes[0])}</strong><em>${esc(e.cientifico)}</em>${nota}</span>
      <span class="meta"><span class="chip ${e.comestibilidad}">${esc(etiqueta(e.comestibilidad))}</span><span class="pct">${pct} %</span></span>
    </button>`;
}

const r_actual = () => sinMesSolo(estado.respuestas);
const etiqueta = (c) => ({ comestible: "Comestible", comestible_con_precaucion: "Con precaución", no_comestible: "No comestible", toxica: "Tóxica", mortal: "Mortal" }[c] || c);

registrarVista("clave", render);
