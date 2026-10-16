// Segunda opinión con Claude (necesita red): envía las fotos al servidor y muestra el resultado.
import { $, esc, lista, ETIQUETA, NIVEL, navegar, registrarVista, toast, API_BASE } from "./ui.js";
import { historial } from "./almacen.js";
import { especie, porNombreCientifico } from "./datos.js";
import { obtenerFotos, registrarSegundaOpinion, miniatura } from "./fotos.js";

const CONSEJOS = [
  "Desentierra la base del pie con cuidado: la volva de las amanitas queda bajo tierra.",
  "No mezcles especies en la misma cesta. Una tóxica contamina el resto.",
  "Usa cesta de mimbre, no bolsas de plástico.",
  "La primera vez que comas una especie, toma poca cantidad y guarda un ejemplar crudo.",
  "Los síntomas de las amanitas mortales tardan entre 6 y 24 horas en aparecer.",
];
const CLAVE_TOKEN = "setas.token";
const estado = { requiereToken: false, xhr: null };

function obtenerToken() {
  if (!estado.requiereToken) return null;
  let token = null;
  try { token = localStorage.getItem(CLAVE_TOKEN); } catch {}
  if (!token) {
    token = prompt("Introduce la clave de acceso de la app:") || "";
    try { localStorage.setItem(CLAVE_TOKEN, token); } catch {}
  }
  return token;
}

function enviar(payload, { onProgreso } = {}) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    estado.xhr = xhr;
    xhr.open("POST", `${API_BASE}/api/identificar`);
    xhr.setRequestHeader("Content-Type", "application/json");
    const token = obtenerToken();
    if (token) xhr.setRequestHeader("x-app-token", token);
    xhr.timeout = 240000;
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgreso?.(e.loaded / e.total); };
    xhr.onload = () => {
      let cuerpo = {};
      try { cuerpo = JSON.parse(xhr.responseText); } catch {}
      if (xhr.status >= 200 && xhr.status < 300) return resolve(cuerpo);
      if (xhr.status === 401) { try { localStorage.removeItem(CLAVE_TOKEN); } catch {} }
      reject(new Error(cuerpo.error || `Error ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error("No se ha podido conectar con el servidor."));
    xhr.ontimeout = () => reject(new Error("La conexión es demasiado lenta y se ha agotado el tiempo."));
    xhr.onabort = () => reject(Object.assign(new Error("Cancelado"), { cancelado: true }));
    xhr.send(JSON.stringify(payload));
  });
}

function leerContexto() {
  return { habitat: $("#ctx-habitat").value, arboles: $("#ctx-arboles").value, sustrato: $("#ctx-sustrato").value, olor: $("#ctx-olor").value, zona: $("#ctx-zona").value, notas: $("#ctx-notas").value };
}

let temporizador = null;
async function segundaOpinion() {
  const fotos = obtenerFotos();
  if (fotos.length === 0) { toast("No hay fotos que enviar."); return; }
  if (!navigator.onLine) { toast("Sin red: la segunda opinión necesita conexión."); return; }
  navegar("cargando");
  $("#cargando-titulo").textContent = "Subiendo fotos…";
  $("#progreso-barra").style.width = "0%";
  let i = Math.floor(Math.random() * CONSEJOS.length);
  const consejo = () => { $("#consejo").textContent = CONSEJOS[i++ % CONSEJOS.length]; };
  consejo();
  temporizador = setInterval(consejo, 6000);
  try {
    const cuerpo = await enviar({ fotos: fotos.map(({ etiqueta, media_type, data }) => ({ etiqueta, media_type, data })), contexto: leerContexto() }, {
      onProgreso: (p) => {
        $("#progreso-barra").style.width = `${Math.round(p * 100)}%`;
        if (p >= 1) { $("#cargando-titulo").textContent = "Analizando las fotos…"; $("#cargando-sub").textContent = "Suele tardar entre 20 y 60 segundos."; }
      },
    });
    const mini = await miniatura(fotos[0].url);
    const r = cuerpo.resultado;
    const top = r.candidatos[0];
    historial.agregar({ origen: "ia", semaforo: r.semaforo, titulo: top ? top.nombre_comun : "Sin identificar", subtitulo: top ? `${top.nombre_cientifico} · ${top.confianza} %` : r.veredicto, miniatura: mini, datos: cuerpo });
    navegar("resultado-ia", { cuerpo }, { reemplazar: true });
  } catch (err) {
    history.back();
    toast(err.cancelado ? "Cancelado" : err.message);
  } finally {
    clearInterval(temporizador);
  }
}

function enlaceFicha(nombre, fichaId) {
  const e = fichaId ? especie(fichaId) : porNombreCientifico(nombre);
  return e ? `<button class="enlace" data-ir="ficha" data-params='${JSON.stringify({ id: e.id })}'>Ver ficha en la guía →</button>` : "";
}

export function renderResultado({ cuerpo } = {}) {
  const cont = $("#vista-resultado-ia");
  if (!cuerpo?.resultado) { cont.innerHTML = `<p class="vacio">Sin resultado.</p>`; return; }
  const { resultado: r, demo, modelo } = cuerpo;
  const top = r.candidatos[0];
  const otros = r.candidatos.slice(1);
  const partes = [];
  partes.push(`
    <div class="semaforo ${r.semaforo}">
      <div class="luces" aria-hidden="true"><span class="luz rojo ${r.semaforo === "rojo" ? "on" : ""}"></span><span class="luz ambar ${r.semaforo === "ambar" ? "on" : ""}"></span><span class="luz verde ${r.semaforo === "verde" ? "on" : ""}"></span></div>
      <div class="veredicto"><span class="nivel">${NIVEL[r.semaforo]} · opinión de la IA</span><strong>${esc(r.veredicto)}</strong></div>
    </div>`);
  if (top) {
    partes.push(`
      <article class="tarjeta">
        <h2>${esc(top.nombre_comun)}</h2>
        <p class="cientifico">${esc(top.nombre_cientifico)}</p>
        <div class="fila"><span class="chip ${top.comestibilidad}">${ETIQUETA[top.comestibilidad]}</span><span class="confianza">Confianza ${top.confianza} %</span></div>
        <div class="barra"><span style="width:${top.confianza}%"></span></div>
        <p>${esc(top.descripcion)}</p>
        ${top.rasgos_coincidentes?.length ? `<h3>Coincide en</h3>${lista(top.rasgos_coincidentes)}` : ""}
        ${top.rasgos_a_verificar?.length ? `<h3>Comprueba en el campo</h3><ul class="checklist">${top.rasgos_a_verificar.map((c) => `<li><span class="marca"></span><span>${esc(c)}</span></li>`).join("")}</ul>` : ""}
        ${enlaceFicha(top.nombre_cientifico, top.ficha_id)}
      </article>`);
  } else {
    partes.push(`<article class="tarjeta"><h2>No se ha reconocido ninguna seta</h2><p>${esc(r.recomendacion)}</p></article>`);
  }
  partes.push(`<article class="tarjeta"><h3>Por qué este semáforo</h3>${lista(r.motivos)}</article>`);
  if (r.parecidas_peligrosas?.length) {
    partes.push(`<article class="tarjeta peligro"><h3>⚠️ Se confunde con</h3>${r.parecidas_peligrosas.map((p) => `<div class="parecida"><strong>${esc(p.nombre_comun)}</strong> <em>${esc(p.nombre_cientifico)}</em> <span class="chip ${p.peligro}">${ETIQUETA[p.peligro]}</span><p>${esc(p.como_distinguir)}</p>${enlaceFicha(p.nombre_cientifico, p.ficha_id)}</div>`).join("")}</article>`);
  }
  if (otros.length) {
    partes.push(`<article class="tarjeta"><h3>Otras posibilidades</h3>${otros.map((c) => `<div class="otro"><strong>${esc(c.nombre_comun)}</strong> <em>${esc(c.nombre_cientifico)}</em> <span class="chip ${c.comestibilidad}">${ETIQUETA[c.comestibilidad]}</span><span class="confianza">${c.confianza} %</span>${enlaceFicha(c.nombre_cientifico, c.ficha_id)}</div>`).join("")}</article>`);
  }
  if (r.fotos_que_faltan?.length) partes.push(`<article class="tarjeta"><h3>Fotos que ayudarían</h3>${lista(r.fotos_que_faltan)}</article>`);
  if (top && r.recomendacion) partes.push(`<article class="tarjeta"><h3>Qué hacer ahora</h3><p>${esc(r.recomendacion)}</p></article>`);
  if (r.normativa) partes.push(`<article class="tarjeta"><h3>Normativa</h3><p>${esc(r.normativa)}</p></article>`);
  partes.push(`<p class="aviso-final">Orientación generada por IA${demo ? " (modo demo)" : modelo ? ` con ${esc(modelo)}` : ""}. No sustituye a una persona experta. Ante cualquier duda, no la comas.</p><button class="principal" data-ir="captura">Nueva identificación</button>`);
  cont.innerHTML = partes.join("");
}

export function montar({ requiereToken, disponible = true }) {
  estado.requiereToken = requiereToken;
  // Sin servidor de IA (por ejemplo, la app publicada como sitio estático) el botón no aparece
  if (disponible) registrarSegundaOpinion(segundaOpinion);
  $("#btn-cancelar").addEventListener("click", () => estado.xhr?.abort());
  registrarVista("resultado-ia", renderResultado);
}
