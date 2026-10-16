// Copia la app estática (sin el servidor) a dist/ para publicarla en un hosting con HTTPS.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const origen = path.join(raiz, "public"), destino = path.join(raiz, "dist");
const excluir = new Set(["pruebas", "modelo_mejor.keras"]);
fs.rmSync(destino, { recursive: true, force: true });
let n = 0;
function copiar(src, dst) {
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    if (e.name.startsWith("._") || e.name === ".DS_Store" || excluir.has(e.name)) continue;
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    if (e.isDirectory()) { fs.mkdirSync(d, { recursive: true }); copiar(s, d); }
    else { fs.mkdirSync(dst, { recursive: true }); fs.copyFileSync(s, d); n++; }
  }
}
copiar(origen, destino);
if (!fs.existsSync(path.join(destino, "modelo", "meta.json"))) console.warn("Aviso: dist/ no incluye modelo de reconocimiento (public/modelo vacío).");
console.log(`dist/ listo: ${n} archivos. Súbelo tal cual a GitHub Pages, Netlify, Cloudflare Pages o cualquier hosting estático con HTTPS.`);
