// Guía: listado de especies con búsqueda y filtros, buenas prácticas y emergencias.
import { $, $$, esc, registrarVista } from "./ui.js";
import { buscar, GRUPOS_ORDEN, versionGuia, especies } from "./datos.js";
import { filaEspecie } from "./ficha.js";

const estado = { sub: "especies", filtro: "todas", texto: "" };

const PRACTICAS = [
  ["Permisos y límites", "En muchos montes hace falta permiso (cotos micológicos de Castilla y León, Cataluña, Aragón, Navarra…). Suele haber un máximo por persona y día para uso propio. Infórmate antes de salir."],
  ["Cesta, nunca bolsa", "Usa una cesta de mimbre: las setas respiran y las esporas se dispersan. En bolsa de plástico fermentan y se estropean."],
  ["Cómo cogerlas", "Gira suavemente o corta con navaja por la base. Para identificarla necesitas la base entera: desentiérrala con cuidado y tapa el agujero."],
  ["No rastrilles", "Rastrillar o remover la hojarasca destruye el micelio y está prohibido. No arranques tampoco ejemplares que no vayas a coger."],
  ["Ejemplares adecuados", "Deja los muy jóvenes (difíciles de identificar), los viejos, los podridos y los agusanados. Deja también algunos maduros para que esporen."],
  ["No mezcles", "Separa las especies en la cesta. Un ejemplar tóxico contamina el resto. Si tienes dudas con uno, guárdalo aparte y entero."],
  ["Identifica en casa, una a una", "Repasa cada seta de la cesta antes de cocinar. Descarta cualquier duda: una sola amanita puede matar a toda la familia."],
  ["Cocina siempre", "La mayoría de setas silvestres son indigestas o tóxicas crudas. Cocina bien, no abuses de la cantidad y guarda un ejemplar crudo en la nevera 48 h por si hay problemas."],
  ["Primera vez, poca cantidad", "Cada persona tolera las setas de forma distinta. La primera vez que comas una especie, come poco y no la mezcles con otras ni con alcohol."],
  ["Respeta el entorno", "Propiedad privada, zonas protegidas y vedados: respétalos. No hagas ruido, no dejes basura y cierra las cancelas."],
];

const SINDROMES = [
  ["Faloidiano", "6-24 h", "Amanita phalloides, verna, virosa; Lepiota brunneoincarnata; Galerina marginata", "Vómitos y diarrea intensos, mejoría engañosa y después fallo hepático. MORTAL sin tratamiento precoz."],
  ["Orellánico", "2-17 días", "Cortinarius orellanus y rubellus", "Sed, dolor lumbar, menos orina: insuficiencia renal."],
  ["Giromítrico", "6-12 h", "Gyromitra esculenta", "Vómitos, mareo, daño hepático y neurológico."],
  ["Muscarínico", "15 min - 2 h", "Inocybe erubescens, Clitocybe rivulosa", "Sudor, lagrimeo, salivación, pulso lento, visión borrosa."],
  ["Panterínico", "30 min - 3 h", "Amanita muscaria, pantherina, gemmata", "Confusión, agitación, alucinaciones, somnolencia."],
  ["Gastrointestinal", "30 min - 4 h", "Entoloma sinuatum, Tricholoma pardinum, Rubroboletus satanas, Omphalotus, Agaricus xanthodermus…", "Vómitos y diarrea. Peligroso por la deshidratación."],
  ["Coprínico", "Al beber alcohol", "Coprinopsis atramentaria", "Enrojecimiento, calor, palpitaciones."],
  ["Rabdomiolisis", "24-72 h", "Tricholoma equestre (comidas repetidas)", "Debilidad y dolor muscular, orina oscura."],
  ["Paxílico", "1-2 h (acumulativo)", "Paxillus involutus", "Destrucción de glóbulos rojos, fallo renal."],
];

export function render() {
  const cont = $("#vista-guia");
  cont.innerHTML = `
    <h2>Guía</h2>
    <div class="subtabs">
      <button data-sub="especies" class="${estado.sub === "especies" ? "activa" : ""}">Especies</button>
      <button data-sub="practicas" class="${estado.sub === "practicas" ? "activa" : ""}">Buenas prácticas</button>
      <button data-sub="emergencias" class="${estado.sub === "emergencias" ? "activa" : ""}">Emergencias</button>
    </div>
    <div id="guia-contenido"></div>`;
  for (const b of $$(".subtabs button", cont)) b.addEventListener("click", () => { estado.sub = b.dataset.sub; render(); });
  const c = $("#guia-contenido");
  if (estado.sub === "especies") pintarEspecies(c);
  else if (estado.sub === "practicas") pintarPracticas(c);
  else pintarEmergencias(c);
}

function pintarEspecies(c) {
  c.innerHTML = `
    <input type="search" class="buscador" id="guia-buscar" placeholder="Buscar por nombre…" value="${esc(estado.texto)}" autocomplete="off">
    <div class="filtros">
      ${[["todas", "Todas"], ["comestibles", "Comestibles"], ["precaucion", "Con precaución"], ["peligrosas", "Tóxicas y mortales"]].map(([v, t]) => `<button data-f="${v}" class="${estado.filtro === v ? "activa" : ""}">${t}</button>`).join("")}
    </div>
    <div id="guia-lista"></div>
    <p class="nota-pie">${especies().length} especies · guía ${esc(versionGuia())} · disponible sin conexión</p>`;
  $("#guia-buscar").addEventListener("input", (e) => { estado.texto = e.target.value; pintarLista(); });
  for (const b of $$(".filtros button", c)) b.addEventListener("click", () => { estado.filtro = b.dataset.f; pintarEspecies(c); });
  pintarLista();
}

function pintarLista() {
  const lista = buscar(estado.texto, estado.filtro);
  const cont = $("#guia-lista");
  if (lista.length === 0) { cont.innerHTML = `<p class="vacio">Sin resultados.</p>`; return; }
  const grupos = new Map();
  for (const e of lista) { if (!grupos.has(e.grupo)) grupos.set(e.grupo, []); grupos.get(e.grupo).push(e); }
  const orden = [...grupos.keys()].sort((a, b) => GRUPOS_ORDEN.indexOf(a) - GRUPOS_ORDEN.indexOf(b));
  cont.innerHTML = orden.map((g) => `<div class="grupo-titulo">${esc(g)}</div><div class="lista-especies">${grupos.get(g).sort((a, b) => a.comunes[0].localeCompare(b.comunes[0], "es")).map((e) => filaEspecie(e)).join("")}</div>`).join("");
}

function pintarPracticas(c) {
  c.innerHTML = PRACTICAS.map(([t, d]) => `<article class="tarjeta"><h4>${esc(t)}</h4><p style="margin:0">${esc(d)}</p></article>`).join("") +
    `<article class="tarjeta"><h4>Normativa</h4><p>La recolección de setas la regula cada comunidad autónoma y, dentro de ella, cada monte. Lo habitual: permiso en cotos y montes regulados, límite de kilos por persona y día para consumo propio, prohibición de rastrillar y de recoger de noche, y obligación de usar cesta. Consulta la web de tu comunidad o del ayuntamiento antes de salir.</p></article>`;
}

function pintarEmergencias(c) {
  c.innerHTML = `
    <article class="tarjeta peligro">
      <h4>Si alguien ha comido una seta sospechosa</h4>
      <a class="telefono" href="tel:112">112</a>
      <a class="telefono" href="tel:+34915620420">91 562 04 20</a>
      <p class="sub">Instituto Nacional de Toxicología (24 h)</p>
      <ol>
        <li>No esperes a los síntomas si sospechas de una amanita, lepiota o galerina: cuanto antes se trate, mejor.</li>
        <li>Guarda restos de la seta, de la comida o del vómito, y las fotos que tengas: ayudan a identificarla.</li>
        <li>No provoques el vómito ni des leche o alcohol.</li>
        <li>Avisa a todas las personas que comieron lo mismo.</li>
        <li>Síntomas que aparecen más de 6 horas después de comer son señal de gravedad.</li>
      </ol>
    </article>
    <article class="tarjeta">
      <h4>Síndromes y tiempo de aparición</h4>
      <table class="tabla">
        <tr><th>Síndrome</th><th>Aparece</th><th>Setas y síntomas</th></tr>
        ${SINDROMES.map(([s, t, setas, sint]) => `<tr><td><strong>${esc(s)}</strong></td><td>${esc(t)}</td><td><em>${esc(setas)}</em><br>${esc(sint)}</td></tr>`).join("")}
      </table>
    </article>`;
}

registrarVista("guia", render);
