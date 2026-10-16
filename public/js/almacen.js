// Historial en localStorage (solo en este dispositivo).
const CLAVE_HISTORIAL = "setas.historial";
const MAX_HISTORIAL = 40;

export const historial = {
  leer() {
    try { return JSON.parse(localStorage.getItem(CLAVE_HISTORIAL) || "[]"); } catch { return []; }
  },
  agregar(entrada) {
    const h = [{ id: Date.now() + Math.random().toString(16).slice(2), fecha: new Date().toISOString(), ...entrada }, ...this.leer()].slice(0, MAX_HISTORIAL);
    try { localStorage.setItem(CLAVE_HISTORIAL, JSON.stringify(h)); } catch {}
    return h[0];
  },
  borrar() { try { localStorage.removeItem(CLAVE_HISTORIAL); } catch {} },
};
