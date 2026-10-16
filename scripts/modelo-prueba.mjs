// Genera un modelo de PRUEBA con pesos aleatorios en public/modelo para comprobar que la
// app carga y ejecuta modelos sin conexión. No sirve para identificar nada.
// Uso: node scripts/modelo-prueba.mjs [--borrar]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as tf from "@tensorflow/tfjs";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const salida = path.join(raiz, "public", "modelo");

if (process.argv.includes("--borrar")) {
  fs.rmSync(salida, { recursive: true, force: true });
  console.log("Modelo de prueba borrado");
  process.exit(0);
}

const { especies } = JSON.parse(fs.readFileSync(path.join(raiz, "public", "data", "especies.json"), "utf8"));
const etiquetas = especies.map((e) => e.id);
const T = 96;

const modelo = tf.sequential();
modelo.add(tf.layers.rescaling({ scale: 1 / 255, inputShape: [T, T, 3] }));
modelo.add(tf.layers.conv2d({ filters: 8, kernelSize: 3, activation: "relu" }));
modelo.add(tf.layers.maxPooling2d({ poolSize: 4 }));
modelo.add(tf.layers.conv2d({ filters: 8, kernelSize: 3, activation: "relu" }));
modelo.add(tf.layers.globalAveragePooling2d({}));
modelo.add(tf.layers.dense({ units: etiquetas.length, activation: "softmax" }));

fs.rmSync(salida, { recursive: true, force: true });
fs.mkdirSync(salida, { recursive: true });
await modelo.save(tf.io.withSaveHandler(async (a) => {
  fs.writeFileSync(path.join(salida, "weights.bin"), Buffer.from(a.weightData));
  fs.writeFileSync(path.join(salida, "model.json"), JSON.stringify({
    modelTopology: a.modelTopology,
    format: a.format,
    generatedBy: a.generatedBy,
    convertedBy: "scripts/modelo-prueba.mjs",
    weightsManifest: [{ paths: ["weights.bin"], weights: a.weightSpecs }],
  }));
  return { modelArtifactsInfo: { dateSaved: new Date(), modelTopologyType: "JSON" } };
}));
fs.writeFileSync(path.join(salida, "meta.json"), JSON.stringify({
  version: "prueba-" + Date.now(),
  formato: "layers",
  entrada: { tamano: T, rango: "0-255" },
  etiquetas,
  metricas: {},
  prueba: true,
  generado: new Date().toISOString(),
}, null, 2));
console.log(`Modelo de prueba escrito en ${path.relative(raiz, salida)} (${etiquetas.length} clases, entrada ${T}px)`);
