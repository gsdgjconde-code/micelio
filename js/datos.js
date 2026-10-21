// Carga y consulta de la base de datos local de especies.

let datos = null;

export async function cargarEspecies() {
  if (datos) return datos;
  const r = await fetch("data/especies.json");
  if (!r.ok) throw new Error("No se ha podido cargar la guía de especies.");
  const j = await r.json();
  datos = { version: j.version, lista: j.especies, porId: Object.fromEntries(j.especies.map((e) => [e.id, e])) };
  return datos;
}

export const especies = () => datos?.lista ?? [];
export const especie = (id) => datos?.porId[id];
export const versionGuia = () => datos?.version ?? "";

const normalizar = (s) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

export function porNombreCientifico(nombre) {
  const n = normalizar(nombre);
  if (!n) return null;
  return especies().find((e) => normalizar(e.cientifico) === n || e.comunes.some((c) => normalizar(c) === n)) ?? null;
}

export function buscar(texto, filtro = "todas") {
  const t = normalizar(texto);
  return especies().filter((e) => {
    if (filtro === "comestibles" && e.comestibilidad !== "comestible") return false;
    if (filtro === "precaucion" && e.comestibilidad !== "comestible_con_precaucion") return false;
    if (filtro === "peligrosas" && !["toxica", "mortal", "no_comestible"].includes(e.comestibilidad)) return false;
    if (!t) return true;
    return normalizar(e.cientifico).includes(t) || e.comunes.some((c) => normalizar(c).includes(t)) || normalizar(e.grupo).includes(t);
  });
}

export const GRUPOS_ORDEN = [
  "Boletos", "Níscalos y lactarios", "Rúsulas", "Rebozuelos y trompetas", "Champiñones", "Lepiotas", "Amanitas",
  "Tricholomas", "Otras setas con láminas", "Setas de madera", "Colmenillas y afines", "Otras formas",
];
