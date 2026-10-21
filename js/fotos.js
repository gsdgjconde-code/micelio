// Identificación por fotos EN EL MÓVIL (sin red): captura, reconocimiento con el
// modelo local, cruce con la guía y verificación de rasgos en mano.
import { $, $$, esc, lista, ETIQUETA, NIVEL, ICONOS, navegar, registrarVista, toast } from "./ui.js";
import { historial } from "./almacen.js";
import { especie, especies } from "./datos.js";
import * as vision from "./vision.js";
import { CARACTERES, puntuar, compatibles, alertas, preguntasDiscriminantes } from "./clave-motor.js";
import { filaEspecie } from "./ficha.js";

export const SLOTS = [
  { id: "sombrero", titulo: "Sombrero", ayuda: "Desde arriba, con luz natural" },
  { id: "laminas", titulo: "Parte de abajo", ayuda: "Láminas, poros o púas" },
  { id: "pie", titulo: "Pie y base", ayuda: "Entero, con la base desenterrada" },
  { id: "extra", titulo: "Corte o hábitat", ayuda: "Carne al corte, árboles" },
];

const LADO_MAXIMO = 1600;
const CARACTERES_VERIFICACION = ["himenio", "color_himenio", "anillo", "volva", "latex"];

const estado = { fotos: {}, slotActivo: null, resultado: null, respuestas: {}, segundaOpinion: null };

export function registrarSegundaOpinion(fn) { estado.segundaOpinion = fn; }
export function obtenerFotos() {
  return SLOTS.filter((s) => estado.fotos[s.id]).map((s) => ({ etiqueta: s.titulo, media_type: estado.fotos[s.id].media_type, data: estado.fotos[s.id].data, url: estado.fotos[s.id].url }));
}
export function limpiarFotos() { estado.fotos = {}; pintarSlots(); }

// ---------------------------------------------------------------------------
// Captura
// ---------------------------------------------------------------------------

function pintarSlots() {
  const cont = $("#slots");
  cont.innerHTML = "";
  for (const s of SLOTS) {
    const foto = estado.fotos[s.id];
    const b = document.createElement("button");
    b.type = "button";
    b.className = "slot" + (foto ? " con-foto" : "");
    b.innerHTML = foto
      ? `<img src="${foto.url}" alt="${s.titulo}"><span class="slot-titulo">${s.titulo}</span><span class="quitar" aria-label="Quitar foto">×</span>`
      : `<span class="icono-camara">${ICONOS.camara}</span><span class="slot-titulo">${s.titulo}</span><span class="slot-ayuda">${s.ayuda}</span>`;
    b.addEventListener("click", (e) => {
      if (e.target.classList.contains("quitar")) { e.stopPropagation(); delete estado.fotos[s.id]; pintarSlots(); return; }
      estado.slotActivo = s.id;
      const input = $("#input-foto");
      input.value = "";
      input.click();
    });
    cont.appendChild(b);
  }
  actualizarBoton();
}

function actualizarBoton() {
  const hayFotos = Object.keys(estado.fotos).length > 0;
  const listo = vision.estado().estado === "listo";
  $("#btn-identificar").disabled = !hayFotos || !listo;
}

async function cargarImagen(archivo) {
  if ("createImageBitmap" in window) {
    try { return await createImageBitmap(archivo, { imageOrientation: "from-image" }); } catch {}
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(archivo);
  });
}

async function redimensionar(archivo) {
  const img = await cargarImagen(archivo);
  const escala = Math.min(1, LADO_MAXIMO / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * escala);
  canvas.height = Math.round(img.height * escala);
  canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
  if (img.close) img.close();
  const url = canvas.toDataURL("image/jpeg", 0.85);
  return { data: url.split(",")[1], media_type: "image/jpeg", url };
}

export function miniatura(url, lado = 160) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      const e = lado / Math.max(img.width, img.height);
      c.width = Math.round(img.width * e); c.height = Math.round(img.height * e);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL("image/jpeg", 0.7));
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function mostrarError(msg) { const el = $("#error-captura"); el.textContent = msg; el.classList.remove("oculto"); }
function ocultarError() { $("#error-captura").classList.add("oculto"); }

// ---------------------------------------------------------------------------
// Estado del modelo
// ---------------------------------------------------------------------------

function pintarEstadoModelo(e) {
  const cont = $("#estado-modelo");
  if (!cont) return;
  const m = e.meta;
  const textos = {
    cargando: ["Preparando el reconocimiento…", ""],
    descargando: ["Descargando el modelo de reconocimiento", `${Math.round((e.progreso || 0) * 100)} %. Solo hace falta una vez; después funciona sin red.`],
    listo: [m?.prueba ? "Modelo de PRUEBA cargado" : "Reconocimiento sin conexión: listo", m?.prueba ? "Es un modelo de ejemplo con resultados aleatorios. Entrena el modelo real (carpeta entrenar/)." : `${m?.etiquetas?.length ?? 0} especies · modelo ${esc(m?.version || "")}${m?.metricas?.top1 ? ` · acierto en pruebas ${Math.round(m.metricas.top1 * 100)} % (top 3: ${Math.round((m.metricas.top3 || 0) * 100)} %)` : ""}`],
    no_instalado: ["Modelo de reconocimiento no instalado", "La app no puede reconocer fotos hasta que se entrene y copie el modelo en public/modelo (ver entrenar/README.md). Mientras tanto usa la clave de campo."],
    error: ["No se ha podido cargar el modelo", e.error || ""],
  };
  const [t, d] = textos[e.estado] || ["", ""];
  cont.className = `tarjeta estado-modelo ${e.estado} ${m?.prueba ? "prueba" : ""}`;
  cont.innerHTML = `<strong>${t}</strong>${d ? `<p>${d}</p>` : ""}${e.estado === "no_instalado" ? `<button class="secundario" data-ir="clave">Abrir la clave de campo</button>` : ""}`;
  actualizarBoton();
}

// ---------------------------------------------------------------------------
// Reconocimiento local
// ---------------------------------------------------------------------------

const ORDEN = { rojo: 0, ambar: 1, verde: 2 };
const VEREDICTO = {
  rojo: "NO LA COJAS",
  ambar: "SIN VERIFICAR: comprueba los rasgos en mano",
  verde: "PROBABLEMENTE COMESTIBLE: confírmala antes de comer",
};

function semaforoPreliminar(candidatos) {
  const top = candidatos[0];
  const motivos = [];
  let nivel = "ambar";
  if (!top) return { nivel: "rojo", motivos: ["No se ha reconocido ninguna especie."] };
  if (["toxica", "mortal", "no_comestible"].includes(top.especie.comestibilidad)) { nivel = "rojo"; motivos.push(`La especie más probable es ${ETIQUETA[top.especie.comestibilidad].toLowerCase()}.`); }
  if (top.p < 0.35) { nivel = "rojo"; motivos.push("El reconocimiento no está seguro (menos del 35 %)."); }
  const mortal = candidatos.find((c) => c.especie.comestibilidad === "mortal" && c.p >= 0.1);
  if (mortal) { nivel = "rojo"; motivos.push(`Podría ser ${mortal.especie.comunes[0]} (${mortal.especie.cientifico}), mortal.`); }
  if (nivel === "ambar") motivos.push("Una foto no basta: verifica los rasgos en mano para afinar el resultado.");
  return { nivel, motivos };
}

function semaforoVerificado(candidatos, respuestas) {
  const n = Object.keys(respuestas).length;
  const res = puntuar(candidatos.map((c) => c.especie), respuestas, { estricto: true });
  const porId = Object.fromEntries(res.map((r) => [r.especie.id, r]));
  const combinados = candidatos
    .map((c) => ({ ...c, clave: porId[c.id] }))
    .filter((c) => !c.clave.excluida)
    .map((c) => ({ ...c, final: 0.5 * c.p + 0.5 * (c.clave.maximo ? c.clave.score : 0.5) }))
    .sort((a, b) => b.final - a.final);
  const excluidos = candidatos.filter((c) => porId[c.id].excluida);

  // Con toda la guía: especies peligrosas que siguen encajando con los rasgos
  const resGuia = puntuar(especies(), respuestas, { estricto: true });
  const peligrosasGuia = compatibles(resGuia).map((x) => x.especie).filter((e) => ["toxica", "mortal"].includes(e.comestibilidad));
  const al = alertas(respuestas, resGuia);
  const motivos = [];
  let nivel = "verde";
  const bajar = (h, m) => { if (ORDEN[h] < ORDEN[nivel]) nivel = h; motivos.push(m); };
  const top = combinados[0];

  // Si la foto no ha propuesto nada compatible, recurre a lo que dicen los rasgos por sí solos
  const porRasgos = top ? [] : compatibles(resGuia).slice(0, 5).map((x) => ({ id: x.especie.id, p: 0, especie: x.especie, clave: x, final: x.score * 0.5 }));
  if (!top) {
    if (porRasgos.length === 0) bajar("rojo", "Ni la foto ni los rasgos encajan con ninguna especie de la guía. Puede ser una especie que no está en ella: no la cojas.");
    else {
      bajar("ambar", `La foto no coincide con los rasgos que has indicado. Solo por los rasgos podría ser: ${porRasgos.map((c) => c.especie.comunes[0]).join(", ")}. Abre sus fichas y compara.`);
      if (porRasgos.some((c) => c.especie.comestibilidad === "mortal")) bajar("rojo", "Entre las especies que encajan con los rasgos hay alguna mortal.");
      else if (porRasgos.some((c) => ["toxica", "no_comestible"].includes(c.especie.comestibilidad))) bajar("ambar", "Entre las especies que encajan con los rasgos hay alguna tóxica o no comestible.");
    }
  } else {
    if (["toxica", "mortal", "no_comestible"].includes(top.especie.comestibilidad)) bajar("rojo", `El candidato que mejor encaja es ${ETIQUETA[top.especie.comestibilidad].toLowerCase()}.`);
    if (top.especie.comestibilidad === "comestible_con_precaucion") bajar("ambar", "Es una especie comestible solo con precauciones.");
    const mortales = peligrosasGuia.filter((e) => e.comestibilidad === "mortal");
    const toxicas = peligrosasGuia.filter((e) => e.comestibilidad === "toxica");
    if (mortales.length) bajar("rojo", `Con estos rasgos sigue siendo posible una especie mortal: ${mortales.map((e) => e.comunes[0]).join(", ")}.`);
    else if (toxicas.length) bajar("ambar", `Con estos rasgos sigue siendo posible una especie tóxica: ${toxicas.map((e) => e.comunes[0]).join(", ")}. Responde las preguntas que las distinguen.`);
    if (top.clave.fallos.length) bajar("ambar", "Algún rasgo no coincide del todo con el candidato principal.");
    if (n < 3) bajar("ambar", "Responde al menos tres rasgos para poder subir el semáforo.");
    if (top.final < 0.5) bajar("ambar", "La combinación de foto y rasgos no es concluyente.");
  }
  for (const a of al) { if (a.nivel === "mortal" && !a.especies) bajar("rojo", a.titulo + ": " + a.texto); else if (a.nivel === "toxica" && !a.especies) bajar("ambar", a.titulo + ": " + a.texto); }
  if (nivel === "verde") motivos.push("Foto y rasgos coinciden con una especie comestible y ninguna especie peligrosa de la guía encaja ya con lo que has visto. Aun así, confírmala con una persona experta antes de comerla.");
  const principal = top || porRasgos[0];
  const discriminantes = principal ? preguntasDiscriminantes(principal.especie, [...peligrosasGuia, ...(top ? combinados : porRasgos).slice(1).map((c) => c.especie)], respuestas) : [];
  return { nivel, motivos: [...new Set(motivos)], combinados, excluidos, porRasgos, alertas: al, peligrosasGuia, discriminantes };
}

async function identificarLocal() {
  const fotos = obtenerFotos();
  if (fotos.length === 0) return;
  ocultarError();
  $("#btn-identificar").disabled = true;
  $("#btn-identificar").textContent = "Reconociendo…";
  try {
    const crudos = await vision.reconocer(fotos.map((f) => f.url));
    const candidatos = crudos.map((c) => ({ ...c, especie: especie(c.id) })).filter((c) => c.especie);
    const mini = await miniatura(fotos[0].url);
    const resultado = { candidatos: candidatos.map((c) => ({ id: c.id, p: c.p })), miniatura: mini, prueba: Boolean(vision.metaModelo()?.prueba), fecha: new Date().toISOString() };
    estado.resultado = resultado;
    estado.respuestas = {};
    const top = candidatos[0];
    historial.agregar({
      origen: "vision",
      semaforo: semaforoPreliminar(candidatos).nivel,
      titulo: top ? top.especie.comunes[0] : "Sin reconocer",
      subtitulo: top ? `${top.especie.cientifico} · ${Math.round(top.p * 100)} %` : "",
      miniatura: mini,
      datos: resultado,
    });
    navegar("resultado-vision", { resultado });
  } catch (e) {
    console.error(e);
    mostrarError(e.message || "No se ha podido reconocer la foto.");
  } finally {
    $("#btn-identificar").textContent = "Identificar en el móvil";
    actualizarBoton();
  }
}

// ---------------------------------------------------------------------------
// Resultado + verificación
// ---------------------------------------------------------------------------

function pintarSemaforo(nivel, veredicto) {
  return `
    <div class="semaforo ${nivel}">
      <div class="luces" aria-hidden="true">
        <span class="luz rojo ${nivel === "rojo" ? "on" : ""}"></span>
        <span class="luz ambar ${nivel === "ambar" ? "on" : ""}"></span>
        <span class="luz verde ${nivel === "verde" ? "on" : ""}"></span>
      </div>
      <div class="veredicto"><span class="nivel">${NIVEL[nivel]}</span><strong>${esc(veredicto)}</strong></div>
    </div>`;
}

export function renderResultado({ resultado } = {}) {
  const cont = $("#vista-resultado-vision");
  if (!resultado) { cont.innerHTML = `<p class="vacio">Sin resultado.</p>`; return; }
  estado.resultado = resultado;
  if (resultado.respuestas) estado.respuestas = { ...resultado.respuestas };
  const candidatos = resultado.candidatos.map((c) => ({ ...c, especie: especie(c.id) })).filter((c) => c.especie);
  const r = estado.respuestas;
  const verificado = Object.keys(r).length > 0 ? semaforoVerificado(candidatos, r) : null;
  const pre = semaforoPreliminar(candidatos);
  const nivel = verificado ? verificado.nivel : pre.nivel;
  const motivos = verificado ? verificado.motivos : pre.motivos;
  const ordenados = verificado ? verificado.combinados : candidatos;
  const top = ordenados[0];

  const partes = [];
  if (resultado.prueba) partes.push(`<div class="alerta mortal"><strong>Modelo de prueba</strong><p>Estos resultados son aleatorios: sirven para probar la app, no para identificar setas. Entrena el modelo real (carpeta entrenar/).</p></div>`);
  partes.push(pintarSemaforo(nivel, VEREDICTO[nivel]));

  if (top) {
    const e = top.especie;
    const pct = Math.round(top.p * 100);
    partes.push(`
      <article class="tarjeta">
        ${resultado.miniatura ? `<img class="foto-resultado" src="${resultado.miniatura}" alt="">` : ""}
        <h2>${esc(e.comunes[0])}</h2>
        <p class="cientifico">${esc(e.cientifico)}</p>
        <div class="fila"><span class="chip ${e.comestibilidad}">${ETIQUETA[e.comestibilidad]}</span><span class="confianza">Parecido en la foto ${pct} %${verificado ? ` · con rasgos ${Math.round(top.final * 100)} %` : ""}</span></div>
        <div class="barra"><span style="width:${pct}%"></span></div>
        <p>${esc(e.resumen)}</p>
        ${e.confirmar?.length ? `<h3>Comprueba en el campo</h3><ul class="checklist">${e.confirmar.map((c) => `<li><span class="marca"></span><span>${esc(c)}</span></li>`).join("")}</ul>` : ""}
        <button class="enlace" data-ir="ficha" data-params='${JSON.stringify({ id: e.id })}'>Ver ficha completa →</button>
      </article>`);
  } else {
    partes.push(`<article class="tarjeta"><h2>No se ha reconocido ninguna especie</h2><p>Prueba con fotos más nítidas del sombrero, de la parte de abajo y del pie entero, o usa la clave de campo.</p></article>`);
  }

  partes.push(`<article class="tarjeta"><h3>Por qué este semáforo</h3>${lista(motivos)}</article>`);

  // Verificación de rasgos en mano: preguntas base + las que más separan de las confusiones
  const base = CARACTERES.filter((c) => CARACTERES_VERIFICACION.includes(c.id)).filter((c) => !c.solo_si || Object.entries(c.solo_si).every(([k, vals]) => vals.includes(r[k])));
  const extra = (verificado?.discriminantes || []).filter((d) => !base.includes(d.caracter));
  const respondidasExtra = Object.keys(r).filter((k) => !CARACTERES_VERIFICACION.includes(k)).map((k) => CARACTERES.find((c) => c.id === k)).filter((c) => c && !extra.some((d) => d.caracter.id === c.id));
  const pregunta = (c, nota = "") => `
        <div class="pregunta-mini">
          <strong>${esc(c.pregunta)}</strong>${nota ? `<span class="sub">${nota}</span>` : ""}
          <div class="opciones mini">${c.opciones.map((o) => `<button type="button" class="opcion ${r[c.id] === o.v ? "elegida" : ""}" data-c="${c.id}" data-v="${esc(String(o.v))}"><strong>${esc(o.t)}</strong></button>`).join("")}</div>
        </div>`;
  if (verificado?.alertas?.length) partes.push(verificado.alertas.map((a) => `<div class="alerta ${a.nivel}"><strong>${esc(a.titulo)}</strong><p>${esc(a.texto)}</p></div>`).join(""));
  partes.push(`
    <article class="tarjeta verificacion">
      <h3>Verifica en mano (${Object.keys(r).length} respondidas)</h3>
      <p class="sub">Desentierra la base y dale la vuelta antes de responder. Es lo que distingue una seta comestible de una mortal. Pulsa otra vez para desmarcar.</p>
      ${base.map((c) => pregunta(c)).join("")}
      ${extra.length ? `<h3>Preguntas que más distinguen</h3>` : ""}
      ${extra.map((d) => pregunta(d.caracter, `Separa de: ${esc(d.separa.map((id) => especie(id)?.comunes[0] || id).join(", "))}`)).join("")}
      ${respondidasExtra.map((c) => pregunta(c)).join("")}
    </article>`);

  if (top && top.especie.confusiones?.length) {
    partes.push(`<article class="tarjeta peligro"><h3>⚠️ ${esc(top.especie.comunes[0])} se confunde con</h3>${top.especie.confusiones.map((c) => {
      const otra = c.id ? especie(c.id) : null;
      return `<div class="parecida"><strong>${esc(otra ? otra.comunes[0] : c.nombre || "")}</strong> <em>${esc(otra ? otra.cientifico : c.cientifico || "")}</em> ${otra ? `<span class="chip ${otra.comestibilidad}">${ETIQUETA[otra.comestibilidad]}</span>` : ""}<p>${esc(c.como_distinguir)}</p>${otra ? `<button class="enlace" data-ir="ficha" data-params='${JSON.stringify({ id: otra.id })}'>Ver ficha →</button>` : ""}</div>`;
    }).join("")}</article>`);
  }

  const otros = ordenados.slice(1);
  if (otros.length) {
    partes.push(`<h3>Otras posibilidades según la foto</h3><div class="lista-especies">${otros.map((c) => filaEspecie(c.especie, { pct: Math.round(c.p * 100) })).join("")}</div>`);
  }
  if (verificado?.porRasgos?.length) {
    partes.push(`<h3>Según los rasgos podría ser</h3><div class="lista-especies">${verificado.porRasgos.map((c) => filaEspecie(c.especie, { pct: Math.round(c.clave.score * 100) })).join("")}</div><p class="sub">Porcentaje de coincidencia con los rasgos, no con la foto.</p>`);
  }
  if (verificado?.excluidos?.length) {
    partes.push(`<p class="sub">Descartadas por los rasgos: ${esc(verificado.excluidos.map((c) => c.especie.comunes[0]).join(", "))}.</p>`);
  }

  partes.push(`
    <p class="aviso-final">Reconocimiento hecho en tu móvil, sin red. Orienta, no decide: ante cualquier duda, no la comas.</p>
    <div class="fila-botones">
      ${estado.segundaOpinion && navigator.onLine && Object.keys(estado.fotos).length ? `<button class="secundario" id="btn-segunda">Segunda opinión con IA (usa red)</button>` : ""}
      <button class="principal" id="btn-nueva-foto">Nueva identificación</button>
    </div>`);

  cont.innerHTML = partes.join("");

  for (const b of $$(".verificacion .opcion", cont)) {
    b.addEventListener("click", () => {
      const c = CARACTERES.find((x) => x.id === b.dataset.c);
      const o = c.opciones.find((x) => String(x.v) === b.dataset.v);
      if (estado.respuestas[c.id] === o.v) delete estado.respuestas[c.id]; else estado.respuestas[c.id] = o.v;
      if (c.id === "himenio" && o.v !== "laminas") delete estado.respuestas.latex;
      resultado.respuestas = { ...estado.respuestas };
      renderResultado({ resultado });
      const y = cont.querySelector(".verificacion").getBoundingClientRect().top + window.scrollY - 80;
      window.scrollTo({ top: y });
    });
  }
  $("#btn-nueva-foto").addEventListener("click", () => { limpiarFotos(); estado.respuestas = {}; navegar("captura"); });
  $("#btn-segunda")?.addEventListener("click", () => estado.segundaOpinion?.());
}

// ---------------------------------------------------------------------------
// Montaje
// ---------------------------------------------------------------------------

export function montar() {
  pintarSlots();
  $("#input-foto").addEventListener("change", async (e) => {
    const archivo = e.target.files?.[0];
    if (!archivo || !estado.slotActivo) return;
    try { estado.fotos[estado.slotActivo] = await redimensionar(archivo); ocultarError(); }
    catch (err) { mostrarError("No se ha podido leer la foto. Prueba con otra imagen."); console.error(err); }
    pintarSlots();
  });
  $("#btn-identificar").addEventListener("click", identificarLocal);
  vision.alCambiar(pintarEstadoModelo);
  registrarVista("captura", () => actualizarBoton());
  registrarVista("resultado-vision", renderResultado);
  vision.iniciar();
}
