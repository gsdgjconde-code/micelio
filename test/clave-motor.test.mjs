import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { puntuar, compatibles, alertas, preguntasDiscriminantes, CARACTERES } from "../public/js/clave-motor.js";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { especies } = JSON.parse(fs.readFileSync(path.join(raiz, "public/data/especies.json"), "utf8"));
const porId = Object.fromEntries(especies.map((e) => [e.id, e]));

const top = (respuestas, n = 5) => compatibles(puntuar(especies, respuestas)).slice(0, n).map((r) => r.especie.id);

test("níscalo: láminas naranjas, látex naranja, bajo pino", () => {
  const ids = top({ himenio: "laminas", color_himenio: "naranja", latex: "naranja", sustrato: "suelo", arboles: "pino", color_sombrero: "naranja" });
  assert.equal(ids[0], "lactarius-deliciosus");
  assert.ok(!ids.includes("lactarius-torminosus"), "el falso níscalo (látex blanco) debe quedar excluido");
});

test("oronja verde: láminas blancas, anillo, volva en saco, sombrero verde", () => {
  const res = puntuar(especies, { himenio: "laminas", color_himenio: "blanco", anillo: "si", volva: "si", color_sombrero: "verde" });
  const ids = compatibles(res).map((r) => r.especie.id);
  assert.equal(ids[0], "amanita-phalloides");
  const al = alertas({ himenio: "laminas", color_himenio: "blanco", anillo: "si", volva: "si", color_sombrero: "verde" }, res);
  assert.ok(al.some((a) => a.nivel === "mortal" && a.titulo === "Rasgos de amanita"));
  assert.ok(al.some((a) => a.titulo === "Compatible con especies mortales"));
});

test("rúsula verde sin anillo ni volva no se excluye aunque el usuario no vea volva", () => {
  const ids = top({ himenio: "laminas", color_himenio: "blanco", anillo: "no", volva: "no", color_sombrero: "verde" });
  assert.ok(ids.includes("russula-virescens"));
  // la oronja verde sigue apareciendo (volva enterrada / anillo caído) pero con menor puntuación
  const res = puntuar(especies, { himenio: "laminas", color_himenio: "blanco", anillo: "no", volva: "no", color_sombrero: "verde" });
  const phal = res.find((r) => r.especie.id === "amanita-phalloides");
  assert.equal(phal.excluida, false, "no se excluye del todo: el anillo puede caerse y la volva quedar enterrada");
  const virescens = res.find((r) => r.especie.id === "russula-virescens");
  assert.ok(virescens.score > phal.score);
});

test("el usuario ve anillo pero la especie no lo tiene: se excluye", () => {
  const res = puntuar(especies, { himenio: "laminas", anillo: "si" });
  assert.equal(res.find((r) => r.especie.id === "russula-virescens").excluida, true);
  assert.equal(res.find((r) => r.especie.id === "amanita-phalloides").excluida, false);
});

test("boleto: poros blancos, no azulea, bajo pino", () => {
  const ids = top({ himenio: "poros", color_himenio: "blanco", viraje: "no", arboles: "pino", color_sombrero: "marron" });
  assert.ok(ids.slice(0, 3).includes("boletus-edulis"));
  assert.ok(!top({ himenio: "poros", color_himenio: "blanco", viraje: "no", arboles: "pino" }).includes("amanita-phalloides"));
});

test("boleto de poros rojos genera alerta tóxica y propone Satanás y pie rojo", () => {
  const r = { himenio: "poros", color_himenio: "rojo", viraje: "azul" };
  const res = puntuar(especies, r);
  const ids = compatibles(res).map((x) => x.especie.id);
  assert.ok(ids.includes("rubroboletus-satanas"));
  assert.ok(ids.includes("neoboletus-erythropus"));
  assert.ok(alertas(r, res).some((a) => a.titulo === "Boleto de poros rojos"));
});

test("rebozuelo: pliegues amarillos con olor a fruta", () => {
  const ids = top({ himenio: "pliegues", color_himenio: "amarillo", olor: "fruta", color_sombrero: "amarillo" });
  assert.equal(ids[0], "cantharellus-cibarius");
  assert.ok(!ids.includes("hygrophoropsis-aurantiaca"), "el falso rebozuelo tiene láminas, no pliegues");
});

test("setita blanca en césped con láminas decurrentes: alerta mortal y clitocibe entre candidatos", () => {
  const r = { himenio: "laminas", color_himenio: "blanco", insercion: "decurrentes", tamano: "pequeno", sustrato: "prado", anillo: "no", volva: "no" };
  const res = puntuar(especies, r);
  assert.ok(compatibles(res).map((x) => x.especie.id).includes("clitocybe-rivulosa"));
  assert.ok(alertas(r, res).some((a) => a.titulo === "Seta pequeña y blanca"));
});

test("sin respuestas no hay compatibles ni alertas", () => {
  const res = puntuar(especies, {});
  assert.equal(compatibles(res).length, 0);
  assert.equal(alertas({}, res).length, 0);
});

test("cortina produce alerta de cortinarios", () => {
  const r = { himenio: "laminas", anillo: "cortina" };
  assert.ok(alertas(r, puntuar(especies, r)).some((a) => a.titulo.startsWith("Cortina")));
});

test("todas las especies tienen al menos un valor válido en cada carácter con datos", () => {
  for (const c of CARACTERES) {
    const clave = c.id === "mes" ? "meses" : c.id;
    for (const e of especies) {
      const v = e.rasgos[clave];
      const lista = Array.isArray(v) ? v : [v];
      if (c.id === "insercion" && !e.rasgos.himenio.includes("laminas")) continue;
      assert.ok(lista.length > 0, `${e.id} sin valor en ${clave}`);
    }
  }
});

test("las especies mortales y tóxicas populares tienen confusiones documentadas", () => {
  for (const e of especies) {
    if (e.comestibilidad === "mortal") assert.ok(e.confusiones.length > 0, `${e.id} sin confusiones`);
  }
  assert.ok(porId["amanita-phalloides"].confusiones.some((c) => c.id === "russula-virescens"));
});

test("modo estricto: sin anillo ni volva (base desenterrada) descarta las amanitas", () => {
  const r = { himenio: "laminas", color_himenio: "blanco", anillo: "no", volva: "no" };
  const res = puntuar(especies, r, { estricto: true });
  assert.equal(res.find((x) => x.especie.id === "amanita-phalloides").excluida, true);
  assert.equal(res.find((x) => x.especie.id === "russula-virescens").excluida, false);
  // Siguen siendo posibles mortales SIN anillo ni volva (clitocibe blanco, inocibe, paxilo): correcto
  const mortales = compatibles(res).filter((x) => x.especie.comestibilidad === "mortal").map((x) => x.especie.id);
  assert.ok(!mortales.some((id) => id.startsWith("amanita-")), "ninguna amanita entre las mortales compatibles");
  assert.ok(mortales.includes("clitocybe-rivulosa"), "el clitocibe blanco sigue siendo posible");
});

test("modo estricto: poros blancos descartan el boleto de Satanás pero no el boleto", () => {
  const r = { himenio: "poros", color_himenio: "blanco", anillo: "no", volva: "no" };
  const res = puntuar(especies, r, { estricto: true });
  assert.equal(res.find((x) => x.especie.id === "rubroboletus-satanas").excluida, true);
  assert.equal(res.find((x) => x.especie.id === "boletus-edulis").excluida, false);
});

test("colores vecinos: crema en vez de blanco no excluye ni en modo estricto", () => {
  const r = { himenio: "laminas", color_himenio: "crema", anillo: "no", volva: "no" };
  const x = puntuar(especies, r, { estricto: true }).find((x) => x.especie.id === "russula-emetica"); // solo "blanco"
  assert.equal(x.excluida, false);
  assert.ok(x.fallos.some((f) => f.caracter === "color_himenio" && f.suave));
});

test("preguntas discriminantes: perretxiko frente a entoloma propone la esporada", () => {
  const r = { himenio: "laminas", color_himenio: "blanco", anillo: "no", volva: "no" };
  const d = preguntasDiscriminantes(porId["calocybe-gambosa"], [porId["entoloma-sinuatum"]], r);
  assert.ok(d.some((x) => x.caracter.id === "esporada"), JSON.stringify(d.map((x) => x.caracter.id)));
});

test("preguntas discriminantes: níscalo frente a falso níscalo propone el látex", () => {
  const r = { himenio: "laminas", color_himenio: "naranja", anillo: "no", volva: "no" };
  const d = preguntasDiscriminantes(porId["lactarius-deliciosus"], [porId["lactarius-torminosus"]], r);
  assert.equal(d[0].caracter.id, "latex");
});

test("modo estricto: un color opuesto bajo el sombrero sí excluye", () => {
  const r = { himenio: "laminas", color_himenio: "rojo" };
  assert.equal(puntuar(especies, r, { estricto: true }).find((x) => x.especie.id === "russula-emetica").excluida, true);
  assert.equal(puntuar(especies, r, { estricto: false }).find((x) => x.especie.id === "russula-emetica").excluida, false);
});
