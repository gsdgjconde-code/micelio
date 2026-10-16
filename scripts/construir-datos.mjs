// Une los archivos de datos/parte*.json, los valida contra el esquema y los
// enumerados de la clave y escribe public/data/especies.json.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ENUMS } from "../public/js/clave-motor.js";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dirDatos = path.join(raiz, "datos");
const salida = path.join(raiz, "public", "data", "especies.json");

const COMESTIBILIDAD = ["comestible", "comestible_con_precaucion", "no_comestible", "toxica", "mortal"];
const SEMAFORO = { comestible: "verde", comestible_con_precaucion: "ambar", no_comestible: "rojo", toxica: "rojo", mortal: "rojo" };
const CAMPOS_RASGOS = ["himenio", "color_himenio", "insercion", "anillo", "volva", "color_sombrero", "tamano", "latex", "viraje", "olor", "sustrato", "arboles", "esporada", "meses"];
const EXTRA_ENUMS = { arboles: ["cualquiera"] };

const archivos = fs.readdirSync(dirDatos).filter((f) => /^parte\d+.*\.json$/.test(f)).sort();
const especies = archivos.flatMap((f) => JSON.parse(fs.readFileSync(path.join(dirDatos, f), "utf8")));

const errores = [];
const ids = new Set();
for (const e of especies) {
  const donde = e.id || e.cientifico || "(sin id)";
  for (const campo of ["id", "cientifico", "comunes", "grupo", "comestibilidad", "resumen", "rasgos", "descripcion", "confirmar", "confusiones", "precauciones"]) {
    if (e[campo] === undefined) errores.push(`${donde}: falta el campo "${campo}"`);
  }
  if (ids.has(e.id)) errores.push(`${donde}: id duplicado`);
  ids.add(e.id);
  if (!COMESTIBILIDAD.includes(e.comestibilidad)) errores.push(`${donde}: comestibilidad "${e.comestibilidad}" no válida`);
  if (!/^[a-z0-9-]+$/.test(e.id || "")) errores.push(`${donde}: id con caracteres no permitidos`);
  for (const campo of CAMPOS_RASGOS) {
    const v = e.rasgos?.[campo];
    if (v === undefined) { errores.push(`${donde}: rasgos.${campo} ausente`); continue; }
    const lista = Array.isArray(v) ? v : [v];
    const clave = campo === "meses" ? "mes" : campo;
    const permitidos = [...(ENUMS[clave] || []), ...(EXTRA_ENUMS[campo] || [])];
    for (const x of lista) if (!permitidos.includes(x)) errores.push(`${donde}: rasgos.${campo} contiene "${x}" (no está en ${permitidos.join("|")})`);
  }
  for (const campo of ["sombrero", "himenio", "pie", "carne", "habitat"]) {
    if (!e.descripcion?.[campo]) errores.push(`${donde}: descripcion.${campo} vacía`);
  }
}
for (const e of especies) {
  for (const c of e.confusiones || []) {
    if (c.id && !ids.has(c.id)) errores.push(`${e.id}: confusión con id inexistente "${c.id}"`);
    if (!c.como_distinguir) errores.push(`${e.id}: confusión sin "como_distinguir"`);
  }
}

if (errores.length) {
  console.error(`Datos NO válidos (${errores.length} errores):`);
  for (const x of errores) console.error(" -", x);
  process.exit(1);
}

const salidaDatos = {
  version: new Date().toISOString().slice(0, 10),
  total: especies.length,
  especies: especies.map((e) => ({ ...e, semaforo: SEMAFORO[e.comestibilidad] })),
};
fs.mkdirSync(path.dirname(salida), { recursive: true });
fs.writeFileSync(salida, JSON.stringify(salidaDatos));
const resumen = Object.entries(especies.reduce((acc, e) => ((acc[e.comestibilidad] = (acc[e.comestibilidad] || 0) + 1), acc), {}));
console.log(`OK: ${especies.length} especies -> ${path.relative(raiz, salida)}`);
console.log("   " + resumen.map(([k, v]) => `${k}: ${v}`).join(", "));
