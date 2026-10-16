#!/usr/bin/env python3
"""Descarga fotos de cada especie de la guía desde GBIF (observaciones con imagen,
en su mayoría de iNaturalist) para entrenar el modelo de reconocimiento.

Uso:
    python3 descargar_imagenes.py                  # 200 fotos por especie, todo el mundo
    python3 descargar_imagenes.py --por-especie 300 --paises ES,PT,FR,IT

Las fotos se guardan en entrenar/imagenes/<id-de-especie>/ reducidas a 384 px de lado
largo (suficiente para entrenar a 224 px y ahorra mucho disco). Se puede interrumpir y
relanzar: no vuelve a bajar lo que ya tiene.

Las imágenes tienen licencias Creative Commons de sus autores (se guarda el autor y la
licencia en _creditos.json). Son para entrenar un modelo de uso personal.
"""
import argparse
import concurrent.futures
import io
import json
import pathlib
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

try:
    from PIL import Image
except ImportError:
    sys.exit("Falta Pillow: pip install pillow")

RAIZ = pathlib.Path(__file__).resolve().parent.parent
ESPECIES = RAIZ / "public" / "data" / "especies.json"
DESTINO = pathlib.Path(__file__).resolve().parent / "imagenes"
API = "https://api.gbif.org/v1"
CABECERAS = {"User-Agent": "setas-app/1.0 (entrenamiento de modelo personal)"}
LADO_MAXIMO = 384

# Nombres alternativos con los que GBIF tiene muchas más observaciones de la misma seta.
SINONIMOS = {
    "agrocybe-aegerita": ["Agrocybe aegerita", "Agrocybe cylindracea", "Cyclocybe cylindracea"],
    "inocybe-erubescens": ["Inocybe patouillardii", "Inosperma erubescens"],
    "terfezia-arenaria": ["Terfezia leonis"],
    "craterellus-tubaeformis": ["Craterellus lutescens", "Cantharellus tubaeformis"],
    "cortinarius-orellanus": ["Cortinarius rubellus", "Cortinarius speciosissimus"],
    "morchella-esculenta": ["Morchella conica", "Morchella elata", "Morchella vulgaris"],
    "clitocybe-rivulosa": ["Clitocybe dealbata"],
    "neoboletus-erythropus": ["Neoboletus luridiformis", "Boletus erythropus"],
    "agaricus-arvensis": ["Agaricus fissuratus"],
    "lycoperdon-perlatum": ["Calvatia gigantea"],
}


def gbif(ruta, **params):
    url = f"{API}/{ruta}?{urllib.parse.urlencode(params, doseq=True)}"
    req = urllib.request.Request(url, headers=CABECERAS)
    for intento in range(4):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.load(r)
        except (urllib.error.URLError, TimeoutError) as e:
            if intento == 3:
                raise
            time.sleep(2 * (intento + 1))


def clave_taxon(nombre):
    m = gbif("species/match", name=nombre)
    if m.get("matchType") in (None, "NONE"):
        return None, None
    return m.get("usageKey"), m.get("scientificName")


def observaciones_con_foto(taxon_key, maximo, paises):
    """Devuelve [(url, autor, licencia)] con una foto por observación para ganar variedad."""
    salida, offset = [], 0
    while len(salida) < maximo and offset < 5000:
        params = dict(taxonKey=taxon_key, mediaType="StillImage", limit=300, offset=offset)
        if paises:
            params["country"] = paises
        r = gbif("occurrence/search", **params)
        for occ in r.get("results", []):
            for m in occ.get("media", []):
                u = m.get("identifier")
                if u and m.get("type") == "StillImage":
                    salida.append((u, m.get("creator") or occ.get("recordedBy") or "", m.get("license") or ""))
                    break
        if r.get("endOfRecords") or not r.get("results"):
            break
        offset += 300
    return salida[:maximo]


def descargar(url, destino):
    # iNaturalist sirve varios tamaños: "medium" basta y pesa 10 veces menos que "original".
    url = url.replace("/original.", "/medium.").replace("/original?", "/medium?")
    req = urllib.request.Request(url, headers=CABECERAS)
    with urllib.request.urlopen(req, timeout=60) as r:
        datos = r.read()
    img = Image.open(io.BytesIO(datos)).convert("RGB")
    img.thumbnail((LADO_MAXIMO, LADO_MAXIMO))
    img.save(destino, "JPEG", quality=88)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--por-especie", type=int, default=200, help="fotos por especie (por defecto 200)")
    ap.add_argument("--paises", default="", help="códigos ISO separados por comas, p. ej. ES,PT,FR (por defecto, todo el mundo)")
    ap.add_argument("--hilos", type=int, default=8)
    ap.add_argument("--solo", default="", help="ids de especie separados por comas para descargar solo esas")
    args = ap.parse_args()

    especies = json.loads(ESPECIES.read_text())["especies"]
    if args.solo:
        ids = set(args.solo.split(","))
        especies = [e for e in especies if e["id"] in ids]
    paises = [p.strip().upper() for p in args.paises.split(",") if p.strip()]
    DESTINO.mkdir(parents=True, exist_ok=True)
    resumen, creditos = {}, {}

    for n, e in enumerate(especies, 1):
        carpeta = DESTINO / e["id"]
        carpeta.mkdir(exist_ok=True)
        existentes = len([f for f in carpeta.glob("*.jpg") if not f.name.startswith("._")])
        if existentes >= args.por_especie:
            print(f"[{n}/{len(especies)}] {e['cientifico']}: ya hay {existentes} fotos")
            resumen[e["id"]] = existentes
            continue
        fotos, nombres_gbif, vistas = [], [], set()
        for nombre in [e["cientifico"]] + SINONIMOS.get(e["id"], []):
            try:
                key, nombre_gbif = clave_taxon(nombre)
            except Exception as ex:
                print(f"[{n}/{len(especies)}] {nombre}: error consultando GBIF ({ex})")
                continue
            if not key or key in vistas:
                continue
            vistas.add(key)
            nombres_gbif.append(nombre_gbif)
            fotos += observaciones_con_foto(key, args.por_especie * 2 - len(fotos), paises)
            if len(fotos) >= args.por_especie * 2:
                break
        if not fotos:
            print(f"[{n}/{len(especies)}] {e['cientifico']}: no encontrada en GBIF")
            continue
        print(f"[{n}/{len(especies)}] {e['cientifico']} ({'; '.join(nombres_gbif)}): {len(fotos)} observaciones con foto", flush=True)

        pendientes = []
        for i, (url, autor, lic) in enumerate(fotos):
            destino = carpeta / f"{i:04d}.jpg"
            if destino.exists():
                continue
            pendientes.append((url, destino, autor, lic))
            if existentes + len(pendientes) >= args.por_especie + 20:  # un pequeño margen por fallos
                break
        bajadas = existentes
        with concurrent.futures.ThreadPoolExecutor(max_workers=args.hilos) as ex:
            futuros = {ex.submit(descargar, u, d): (u, d, a, l) for (u, d, a, l) in pendientes}
            for f in concurrent.futures.as_completed(futuros):
                u, d, a, l = futuros[f]
                try:
                    f.result()
                    bajadas += 1
                    creditos[str(d.relative_to(DESTINO))] = {"url": u, "autor": a, "licencia": l}
                    if bajadas >= args.por_especie:
                        for g in futuros:
                            g.cancel()
                        break
                except Exception:
                    pass
        resumen[e["id"]] = len([f for f in carpeta.glob("*.jpg") if not f.name.startswith("._")])
        print(f"     -> {resumen[e['id']]} fotos guardadas")

    (DESTINO / "_resumen.json").write_text(json.dumps(resumen, indent=2, ensure_ascii=False))
    previos = {}
    if (DESTINO / "_creditos.json").exists():
        previos = json.loads((DESTINO / "_creditos.json").read_text())
    previos.update(creditos)
    (DESTINO / "_creditos.json").write_text(json.dumps(previos, ensure_ascii=False))

    pocas = [k for k, v in resumen.items() if v < 40]
    print(f"\nTotal: {sum(resumen.values())} fotos de {len(resumen)} especies.")
    if pocas:
        print(f"Especies con menos de 40 fotos (el modelo las reconocerá mal): {', '.join(pocas)}")


if __name__ == "__main__":
    main()
