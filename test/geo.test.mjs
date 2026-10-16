import { test } from "node:test";
import assert from "node:assert/strict";
import { distancia, rumbo, puntoCardinal, longitudRuta, formatoDistancia, formatoDuracion, aGPX } from "../public/js/geo.js";

const madrid = { lat: 40.4168, lon: -3.7038 };
const barcelona = { lat: 41.3874, lon: 2.1686 };

test("distancia Madrid-Barcelona ≈ 505 km", () => {
  const d = distancia(madrid, barcelona);
  assert.ok(d > 500000 && d < 510000, `${d}`);
});

test("rumbo Madrid→Barcelona es hacia el este-noreste", () => {
  const r = rumbo(madrid, barcelona);
  assert.ok(r > 65 && r < 85, `${r}`);
  assert.equal(puntoCardinal(r), "E");
  assert.equal(puntoCardinal(0), "N");
  assert.equal(puntoCardinal(225), "SO");
});

test("longitud de ruta suma los tramos", () => {
  const a = { lat: 40.0, lon: -4.0 }, b = { lat: 40.001, lon: -4.0 }, c = { lat: 40.001, lon: -4.001 };
  const total = longitudRuta([a, b, c]);
  assert.ok(Math.abs(total - (distancia(a, b) + distancia(b, c))) < 0.001);
  assert.equal(longitudRuta([a]), 0);
});

test("formatos", () => {
  assert.equal(formatoDistancia(850), "850 m");
  assert.equal(formatoDistancia(2300), "2,3 km");
  assert.equal(formatoDistancia(12000), "12 km");
  assert.equal(formatoDuracion(5 * 60000), "5 min");
  assert.equal(formatoDuracion(2 * 3600000 + 7 * 60000), "2 h 07 min");
});

test("GPX con ruta y setales, con el nombre escapado", () => {
  const gpx = aGPX({ nombre: "Pinar & co", puntos: [{ lat: 40, lon: -4, alt: 1200, t: 1700000000000 }, { lat: 40.001, lon: -4 }], setales: [{ lat: 40.0005, lon: -4, nombre: "Níscalo <muchos>", descripcion: "Muchas" }] });
  assert.ok(gpx.includes("<trkpt lat=\"40\" lon=\"-4\">"));
  assert.ok(gpx.includes("<ele>1200</ele>"));
  assert.ok(gpx.includes("<wpt lat=\"40.0005\""));
  assert.ok(gpx.includes("Pinar &amp; co"));
  assert.ok(gpx.includes("Níscalo &lt;muchos&gt;"));
});
