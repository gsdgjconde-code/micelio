// Motor de la clave de campo. Sin dependencias ni acceso al DOM: se usa en el
// navegador y en los tests de Node. Define los caracteres que se preguntan,
// puntúa cada especie frente a las respuestas y genera alertas de seguridad.

export const CARACTERES = [
  {
    id: "himenio",
    pregunta: "¿Qué tiene debajo del sombrero?",
    ayuda: "Dale la vuelta. Es el rasgo más importante.",
    peso: 4, tipo: "duro",
    opciones: [
      { v: "laminas", t: "Láminas", d: "Hojas finas como las páginas de un libro" },
      { v: "poros", t: "Poros / esponja", d: "Agujeritos, como una esponja" },
      { v: "aguijones", t: "Púas o aguijones", d: "Pinchos blandos que cuelgan" },
      { v: "pliegues", t: "Pliegues gruesos", d: "Venas romas que bajan por el pie" },
      { v: "liso", t: "Liso o arrugado", d: "Sin láminas ni poros" },
      { v: "alveolos", t: "Alvéolos (panal)", d: "El sombrero es como un panal o un cerebro" },
      { v: "interior", t: "Es una bola", d: "Sin sombrero ni pie diferenciados" },
    ],
  },
  {
    id: "color_himenio",
    pregunta: "¿De qué color son las láminas, poros o púas?",
    ayuda: "Mira ejemplares jóvenes y adultos: el color cambia con la edad.",
    peso: 2, tipo: "blando",
    opciones: [
      { v: "blanco", t: "Blanco" }, { v: "crema", t: "Crema" }, { v: "amarillo", t: "Amarillo" },
      { v: "naranja", t: "Naranja" }, { v: "rosa", t: "Rosa" }, { v: "rojo", t: "Rojo" },
      { v: "marron", t: "Marrón" }, { v: "gris", t: "Gris" }, { v: "negro", t: "Negro" },
      { v: "verde", t: "Verde oliva" }, { v: "lila", t: "Lila / violeta" },
    ],
  },
  {
    id: "insercion",
    pregunta: "¿Cómo se unen las láminas al pie?",
    ayuda: "Corta la seta por la mitad y mira el punto de unión.",
    peso: 2, tipo: "blando",
    solo_si: { himenio: ["laminas"] },
    opciones: [
      { v: "libres", t: "No tocan el pie", d: "Queda un hueco entre láminas y pie" },
      { v: "adnatas", t: "Se unen al pie", d: "Llegan al pie sin bajar por él" },
      { v: "decurrentes", t: "Bajan por el pie", d: "Continúan hacia abajo por el pie" },
    ],
  },
  {
    id: "anillo",
    pregunta: "¿Tiene anillo en el pie?",
    ayuda: "Un anillo puede haberse caído: si no lo ves, mira si queda una marca o restos de velo.",
    peso: 3, tipo: "asimetrico",
    opciones: [
      { v: "si", t: "Sí, un anillo", d: "Una faldita membranosa alrededor del pie" },
      { v: "cortina", t: "Restos de telaraña", d: "Filamentos finos entre el borde y el pie" },
      { v: "no", t: "No" },
    ],
  },
  {
    id: "volva",
    pregunta: "¿Cómo es la base del pie?",
    ayuda: "DESENTIERRA la base entera con cuidado. La volva de las amanitas mortales queda bajo tierra.",
    peso: 4, tipo: "asimetrico",
    opciones: [
      { v: "si", t: "Saco o funda", d: "Una membrana que envuelve la base" },
      { v: "bulbo", t: "Bulbo engrosado", d: "Base abultada, a veces con un reborde" },
      { v: "no", t: "Normal", d: "Ni saco ni bulbo" },
    ],
  },
  {
    id: "latex",
    pregunta: "¿Suelta líquido (látex) al cortar las láminas?",
    ayuda: "Rompe una lámina o el sombrero y espera unos segundos.",
    peso: 3, tipo: "asimetrico",
    solo_si: { himenio: ["laminas"] },
    opciones: [
      { v: "no", t: "No" },
      { v: "blanco", t: "Blanco" },
      { v: "naranja", t: "Naranja" },
      { v: "rojo", t: "Rojo vino" },
      { v: "amarillo", t: "Blanco que amarillea" },
    ],
  },
  {
    id: "viraje",
    pregunta: "¿Cambia de color la carne al cortarla o rozarla?",
    ayuda: "Corta el pie y espera un minuto.",
    peso: 2, tipo: "blando",
    opciones: [
      { v: "no", t: "No cambia" }, { v: "azul", t: "Azul" }, { v: "rojo", t: "Rojo / rosa" },
      { v: "amarillo", t: "Amarillo" }, { v: "verde", t: "Verde" }, { v: "negro", t: "Negro" },
    ],
  },
  {
    id: "color_sombrero",
    pregunta: "¿De qué color es el sombrero?",
    ayuda: "El color dominante por arriba.",
    peso: 1, tipo: "blando",
    opciones: [
      { v: "blanco", t: "Blanco" }, { v: "crema", t: "Crema" }, { v: "amarillo", t: "Amarillo" },
      { v: "naranja", t: "Naranja" }, { v: "rojo", t: "Rojo" }, { v: "rosa", t: "Rosa" },
      { v: "marron", t: "Marrón" }, { v: "gris", t: "Gris" }, { v: "negro", t: "Negro" },
      { v: "verde", t: "Verde" }, { v: "violeta", t: "Violeta" },
    ],
  },
  {
    id: "tamano",
    pregunta: "¿Cuánto mide el sombrero?",
    ayuda: "Ejemplares adultos.",
    peso: 1, tipo: "blando",
    opciones: [
      { v: "pequeno", t: "Pequeño", d: "Menos de 4 cm" },
      { v: "mediano", t: "Mediano", d: "Entre 4 y 10 cm" },
      { v: "grande", t: "Grande", d: "Más de 10 cm" },
    ],
  },
  {
    id: "olor",
    pregunta: "¿A qué huele?",
    ayuda: "Huele la carne recién cortada.",
    peso: 1, tipo: "blando",
    opciones: [
      { v: "nada", t: "A seta, nada especial" }, { v: "harina", t: "A harina" }, { v: "anis", t: "A anís" },
      { v: "rabano", t: "A rábano o patata cruda" }, { v: "fruta", t: "A fruta" },
      { v: "dulzon", t: "Dulzón, perfumado" }, { v: "desagradable", t: "Desagradable" }, { v: "otro", t: "Otro" },
    ],
  },
  {
    id: "sustrato",
    pregunta: "¿Dónde crece?",
    ayuda: "Mira si sale de madera, aunque esté enterrada.",
    peso: 2, tipo: "blando",
    opciones: [
      { v: "suelo", t: "Suelo del bosque" }, { v: "prado", t: "Prado o césped" },
      { v: "madera", t: "Madera, tocón o tronco" }, { v: "estiercol", t: "Estiércol" }, { v: "arena", t: "Arena" },
    ],
  },
  {
    id: "arboles",
    pregunta: "¿Qué árboles hay cerca?",
    ayuda: "Muchas setas viven asociadas a un árbol concreto.",
    peso: 1, tipo: "blando",
    opciones: [
      { v: "pino", t: "Pino" }, { v: "abeto", t: "Abeto" }, { v: "haya", t: "Haya" }, { v: "roble", t: "Roble" },
      { v: "encina", t: "Encina / alcornoque" }, { v: "castano", t: "Castaño" }, { v: "chopo", t: "Chopo / álamo" },
      { v: "abedul", t: "Abedul" }, { v: "avellano", t: "Avellano" }, { v: "olivo", t: "Olivo" },
      { v: "eucalipto", t: "Eucalipto" }, { v: "ninguno", t: "Ninguno" },
    ],
  },
  {
    id: "mes",
    pregunta: "¿En qué mes estamos?",
    ayuda: "Se rellena solo con la fecha actual.",
    peso: 1, tipo: "blando",
    opciones: [
      { v: 1, t: "Enero" }, { v: 2, t: "Febrero" }, { v: 3, t: "Marzo" }, { v: 4, t: "Abril" },
      { v: 5, t: "Mayo" }, { v: 6, t: "Junio" }, { v: 7, t: "Julio" }, { v: 8, t: "Agosto" },
      { v: 9, t: "Septiembre" }, { v: 10, t: "Octubre" }, { v: 11, t: "Noviembre" }, { v: 12, t: "Diciembre" },
    ],
  },
  {
    id: "esporada",
    pregunta: "¿De qué color es la esporada?",
    ayuda: "Opcional, para quien la haya hecho: sombrero sobre papel unas horas.",
    peso: 3, tipo: "duro",
    opciones: [
      { v: "blanca", t: "Blanca" }, { v: "crema", t: "Crema" }, { v: "rosa", t: "Rosa" },
      { v: "marron", t: "Marrón" }, { v: "ocre", t: "Ocre" }, { v: "negra", t: "Negra" },
      { v: "verde", t: "Verde oliva" }, { v: "purpura", t: "Púrpura" },
    ],
  },
];

export const ENUMS = Object.fromEntries(CARACTERES.map((c) => [c.id, c.opciones.map((o) => o.v)]));

// Valores "comodín" en los datos de especies
const COMODINES = { arboles: ["cualquiera"] };

function valoresEspecie(especie, id) {
  const r = especie.rasgos || {};
  if (id === "mes") return r.meses || [];
  const v = r[id];
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

// Pares que se consideran "casi compatibles" en caracteres asimétricos.
// Clave: respuesta del usuario -> valores de la especie que no se descartan del todo.
const TOLERANCIAS = {
  anillo: { no: ["si", "cortina"], cortina: ["si"] },      // el anillo puede haberse caído
  volva: { no: ["si", "bulbo"], bulbo: ["si"], si: ["bulbo"] }, // la volva puede quedar enterrada
  latex: { no: ["blanco", "naranja", "rojo", "amarillo"] },   // en seco apenas sale látex
};
// En modo estricto (verificación en mano, con la base ya desenterrada) estas tolerancias
// no se aplican; la del látex sí, porque un ejemplar seco puede no soltar nada.
const TOLERANCIAS_ESTRICTO = { latex: TOLERANCIAS.latex };

// Colores que un ojo no experto confunde con facilidad: cuentan como coincidencia parcial.
const COLOR_VECINOS = {
  blanco: ["crema", "gris"], crema: ["blanco", "amarillo"], amarillo: ["crema", "naranja", "verde"],
  naranja: ["amarillo", "rojo", "marron"], rojo: ["naranja", "rosa", "marron"], rosa: ["rojo", "crema", "lila"],
  marron: ["naranja", "rojo", "gris", "negro"], gris: ["blanco", "negro", "marron", "violeta"], negro: ["gris", "marron"],
  verde: ["amarillo", "gris"], lila: ["rosa", "violeta", "gris"], violeta: ["lila", "gris", "marron"],
};
const CARACTERES_COLOR = ["color_himenio", "color_sombrero"];

/**
 * Puntúa cada especie frente a las respuestas.
 * @param {Array} especies
 * @param {Object} respuestas  { caracterId: valor }  (sin entrada = no se sabe)
 * @param {Object} opciones    { estricto: boolean } estricto = verificación con la seta en la mano
 * @returns {Array<{especie, puntos, maximo, score, excluida, fallos}>}
 */
export function puntuar(especies, respuestas, { estricto = false } = {}) {
  const respondidos = CARACTERES.filter((c) => respuestas[c.id] !== undefined && respuestas[c.id] !== null && respuestas[c.id] !== "");
  const tolerancias = estricto ? TOLERANCIAS_ESTRICTO : TOLERANCIAS;
  return especies
    .map((especie) => {
      let puntos = 0, maximo = 0, excluida = false;
      const fallos = [];
      for (const c of respondidos) {
        if (c.solo_si) {
          const ok = Object.entries(c.solo_si).every(([k, vals]) => vals.includes(respuestas[k]));
          if (!ok) continue;
        }
        const valores = valoresEspecie(especie, c.id);
        if (valores.length === 0) continue; // la especie no tiene dato: no cuenta
        maximo += c.peso;
        const r = respuestas[c.id];
        const coincide = valores.includes(r) || (COMODINES[c.id] && valores.some((v) => COMODINES[c.id].includes(v)));
        if (coincide) { puntos += c.peso; continue; }
        const tolerado = tolerancias[c.id]?.[r]?.some((v) => valores.includes(v));
        if (tolerado) { puntos += c.peso / 2; fallos.push({ caracter: c.id, suave: true }); continue; }
        if (CARACTERES_COLOR.includes(c.id) && (COLOR_VECINOS[r] || []).some((v) => valores.includes(v))) {
          puntos += c.peso / 2; fallos.push({ caracter: c.id, suave: true }); continue;
        }
        fallos.push({ caracter: c.id, suave: false });
        if (c.tipo === "duro" || c.tipo === "asimetrico") excluida = true;
        // Con la seta en la mano, un color claramente distinto bajo el sombrero también descarta
        if (estricto && c.id === "color_himenio") excluida = true;
      }
      const score = maximo === 0 ? 0 : puntos / maximo;
      return { especie, puntos, maximo, score, excluida, fallos };
    })
    .sort((a, b) => (a.excluida === b.excluida ? b.score - a.score : a.excluida ? 1 : -1));
}

export const UMBRAL_COMPATIBLE = 0.6;

export function compatibles(resultados) {
  return resultados.filter((r) => !r.excluida && r.maximo > 0 && r.score >= UMBRAL_COMPATIBLE);
}

/**
 * Alertas de seguridad basadas en combinaciones de rasgos (independientes de la
 * base de datos) y en la presencia de especies peligrosas entre las compatibles.
 */
export function alertas(respuestas, resultados) {
  const out = [];
  const r = respuestas;
  const lam = r.himenio === "laminas";
  const blancas = ["blanco", "crema"].includes(r.color_himenio);

  if (lam && blancas && (r.anillo === "si" || r.volva === "si" || r.volva === "bulbo")) {
    out.push({ nivel: "mortal", titulo: "Rasgos de amanita", texto: "Láminas claras con anillo o base en saco o bulbo: es la combinación de las amanitas mortales. No la cojas si no puedes descartarlas con total seguridad." });
  }
  if (lam && blancas && r.tamano === "pequeno" && (r.sustrato === "prado" || r.anillo === "si")) {
    out.push({ nivel: "mortal", titulo: "Seta pequeña y blanca", texto: "Las lepiotas pequeñas y los clitocibes blancos de césped son mortales y se parecen a especies comestibles. Regla de oro: no se comen setas pequeñas de láminas claras en hierba o jardines." });
  }
  if (lam && r.sustrato === "madera" && r.tamano === "pequeno" && ["marron", "crema", "amarillo"].includes(r.color_himenio)) {
    out.push({ nivel: "mortal", titulo: "Setita marrón sobre madera", texto: "Galerina marginata (mortal) es una seta pequeña color miel sobre madera con láminas marrones. Déjala." });
  }
  if (r.anillo === "cortina") {
    out.push({ nivel: "mortal", titulo: "Cortina (telaraña)", texto: "Los cortinarios tienen cortina en vez de anillo. Algunos destruyen el riñón días después de comerlos. Ningún cortinario es seguro para aficionados." });
  }
  if (r.himenio === "poros" && ["rojo", "naranja"].includes(r.color_himenio)) {
    out.push({ nivel: "toxica", titulo: "Boleto de poros rojos", texto: "Entre los boletos de poros rojos hay especies tóxicas (boleto de Satanás). Si no distingues retículo de punteado en el pie, no los cojas." });
  }
  if (lam && r.color_himenio === "rosa" && r.volva !== "si" && r.anillo !== "si") {
    out.push({ nivel: "toxica", titulo: "Láminas rosas sin anillo", texto: "Entoloma sinuatum (tóxico) tiene láminas rosadas, olor a harina y se confunde con el perretxiko y la pardilla." });
  }
  if (lam && (r.latex === "blanco" || r.latex === "amarillo")) {
    out.push({ nivel: "toxica", titulo: "Látex blanco", texto: "Los lactarios de látex blanco no son los níscalos: varios son tóxicos. Solo se recogen los de látex naranja o rojo vino." });
  }
  if (r.himenio === "alveolos" || (r.himenio === "liso" && [3, 4, 5].includes(r.mes))) {
    out.push({ nivel: "toxica", titulo: "Colmenillas y falsas colmenillas", texto: "Las colmenillas se comen solo bien cocinadas. La falsa colmenilla (Gyromitra), cerebriforme, es mortal. Córtala a lo largo: la colmenilla es hueca por completo." });
  }
  if (r.himenio === "interior") {
    out.push({ nivel: "aviso", titulo: "Corta la bola a lo largo", texto: "Si dentro se ve la silueta de una seta, es un huevo de amanita (puede ser mortal). Si el interior es oscuro, es un escleroderma (tóxico)." });
  }

  const comp = compatibles(resultados);
  const mortales = comp.filter((x) => x.especie.comestibilidad === "mortal");
  const toxicas = comp.filter((x) => x.especie.comestibilidad === "toxica");
  if (mortales.length) {
    out.push({ nivel: "mortal", titulo: "Compatible con especies mortales", texto: `Lo que has indicado encaja con: ${mortales.map((x) => x.especie.cientifico).join(", ")}. No la comas sin que la vea una persona experta.`, especies: mortales.map((x) => x.especie.id) });
  } else if (toxicas.length) {
    out.push({ nivel: "toxica", titulo: "Compatible con especies tóxicas", texto: `Encaja también con: ${toxicas.map((x) => x.especie.cientifico).join(", ")}. Comprueba los rasgos que las distinguen.`, especies: toxicas.map((x) => x.especie.id) });
  }

  // sin duplicados por título
  const vistos = new Set();
  return out.filter((a) => (vistos.has(a.titulo) ? false : (vistos.add(a.titulo), true)));
}

/**
 * Preguntas aún sin responder que mejor separan al candidato principal de un grupo de
 * especies (normalmente sus confusiones peligrosas). Devuelve [{ caracter, separa: [ids] }].
 */
export function preguntasDiscriminantes(candidato, otras, respuestas, maximo = 3) {
  const salida = [];
  for (const c of caracteresAplicables(respuestas)) {
    if (respuestas[c.id] !== undefined || c.id === "mes") continue;
    const mios = valoresEspecie(candidato, c.id);
    if (mios.length === 0 || (COMODINES[c.id] && mios.some((v) => COMODINES[c.id].includes(v)))) continue;
    const separa = otras.filter((o) => {
      const suyos = valoresEspecie(o, c.id);
      if (suyos.length === 0 || (COMODINES[c.id] && suyos.some((v) => COMODINES[c.id].includes(v)))) return false;
      return !suyos.some((v) => mios.includes(v));
    });
    if (separa.length) salida.push({ caracter: c, separa: separa.map((o) => o.id), peso: separa.length * c.peso });
  }
  return salida.sort((a, b) => b.peso - a.peso).slice(0, maximo);
}

export function caracteresAplicables(respuestas) {
  return CARACTERES.filter((c) => !c.solo_si || Object.entries(c.solo_si).every(([k, vals]) => vals.includes(respuestas[k])));
}
