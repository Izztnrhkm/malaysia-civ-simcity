"""Bake offline city regions from pinned OSM geometry and Copernicus DSM samples.

`python bake_maps.py --fetch` obtains the public source snapshots once. Subsequent
`python bake_maps.py` runs use the committed snapshots and need no network access.
The .cache directory holds large original DEM tiles and is never shipped.
"""
from __future__ import annotations

import argparse
import base64
import datetime as dt
import hashlib
import json
import math
from pathlib import Path
import sys
import time
import uuid
import xml.etree.ElementTree as ET

HERE = Path(__file__).resolve().parent
if (HERE / ".deps").is_dir():
    sys.path.insert(0, str(HERE / ".deps"))

import numpy as np
from PIL import Image, ImageDraw
import rasterio
from rasterio.transform import from_bounds
from rasterio.warp import reproject, Resampling
import requests
from shapely import contains_xy
from shapely.geometry import LineString, Polygon, shape, mapping
from shapely.ops import polygonize, unary_union

OUT = HERE.parents[1] / "Assets" / "Resources" / "Maps"
SOURCES = HERE / "sources"
CACHE = HERE / ".cache"
OSM_API = "https://api.openstreetmap.org/api/0.6/map"
DEM_BUCKET = "https://copernicus-dem-30m.s3.amazonaws.com"
UA = "TamadunKotaOfflineGeography/1.0 (city-builder terrain research)"
COLORS = np.array([
    [24, 65, 90], [38, 91, 122], [69, 136, 157], [212, 194, 143],
    [55, 101, 75], [61, 132, 168], [119, 156, 86], [49, 103, 69],
    [139, 139, 94], [162, 156, 137],
], dtype=np.uint8)


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def write_json(path: Path, value) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def meta(path: Path, texture: bool = False) -> None:
    target = Path(str(path) + ".meta")
    if target.exists():
        return
    guid = uuid.uuid5(uuid.NAMESPACE_URL, "tamadun-kota/" + path.relative_to(HERE.parents[1]).as_posix()).hex
    if texture:
        body = "TextureImporter:\n  externalObjects: {}\n  textureType: 0\n  mipmaps:\n    enableMipMap: 0\n  isReadable: 0\n  sRGBTexture: 1\n  maxTextureSize: 1024\n  textureSettings:\n    filterMode: 1\n    wrapU: 1\n    wrapV: 1\n"
    else:
        body = "TextScriptImporter:\n  externalObjects: {}\n  userData: \n  assetBundleName: \n  assetBundleVariant: \n"
    target.write_text("fileFormatVersion: 2\nguid: " + guid + "\n" + body, encoding="utf-8")


def bounds(region: dict, metres: int) -> tuple[float, float, float, float]:
    lat, lon = region["latitude"], region["longitude"]
    half_lat = metres / 2 / 111_132.92
    half_lon = metres / 2 / (111_412.84 * math.cos(math.radians(lat)))
    return lon - half_lon, lat - half_lat, lon + half_lon, lat + half_lat


def get(url: str, **kwargs):
    for attempt in range(3):
        try:
            response = requests.get(url, timeout=(15, 90), headers={"User-Agent": UA}, **kwargs)
            response.raise_for_status()
            return response
        except requests.RequestException:
            if attempt == 2:
                raise
            time.sleep(2 + attempt * 3)


def osm_snapshot(region: dict, extent: tuple) -> dict:
    west, south, east, north = extent
    # Context includes shore ways crossing the crop and the opposite river bank.
    context = 0.012
    bbox = f"{west-context:.8f},{south-context:.8f},{east+context:.8f},{north+context:.8f}"
    response = get(OSM_API, params={"bbox": bbox})
    root = ET.fromstring(response.content)
    nodes = {n.attrib["id"]: [float(n.attrib["lon"]), float(n.attrib["lat"])] for n in root.findall("node")}
    ways = {}
    features = []
    for way in root.findall("way"):
        tags = {t.attrib["k"]: t.attrib["v"] for t in way.findall("tag")}
        refs = [n.attrib["ref"] for n in way.findall("nd")]
        points = [nodes[r] for r in refs if r in nodes]
        if len(points) != len(refs) or len(points) < 2:
            continue
        ways[way.attrib["id"]] = points
        relevant = tags.get("natural") in ("coastline", "water", "wetland", "wood", "beach") or tags.get("waterway") in ("riverbank", "river", "stream") or tags.get("landuse") == "forest"
        if not relevant:
            continue
        is_polygon = points[0] == points[-1] and len(points) >= 4 and tags.get("natural") != "coastline" and tags.get("waterway") not in ("river", "stream")
        geom = Polygon(points) if is_polygon else LineString(points)
        features.append({"type": "Feature", "properties": {"osmType": "way", "osmId": way.attrib["id"], "version": way.attrib.get("version"), "timestamp": way.attrib.get("timestamp"), **tags}, "geometry": mapping(geom)})
    for relation in root.findall("relation"):
        tags = {t.attrib["k"]: t.attrib["v"] for t in relation.findall("tag")}
        if tags.get("natural") not in ("water", "wetland", "wood") and tags.get("waterway") != "riverbank" and tags.get("landuse") != "forest":
            continue
        outer, inner = [], []
        for member in relation.findall("member"):
            points = ways.get(member.attrib["ref"])
            if member.attrib["type"] == "way" and points:
                (inner if member.attrib.get("role") == "inner" else outer).append(LineString(points))
        polygons = list(polygonize(unary_union(outer))) if outer else []
        if not polygons:
            continue
        geom = unary_union(polygons)
        if inner:
            geom = geom.difference(unary_union(list(polygonize(unary_union(inner)))))
        features.append({"type": "Feature", "properties": {"osmType": "relation", "osmId": relation.attrib["id"], "version": relation.attrib.get("version"), "timestamp": relation.attrib.get("timestamp"), **tags}, "geometry": mapping(geom)})
    return {"type": "FeatureCollection", "sourceUrl": response.url, "retrievedUtc": dt.datetime.now(dt.timezone.utc).isoformat(), "sourceSha256": digest(response.content), "copyright": "OpenStreetMap contributors", "licence": "ODbL-1.0", "features": features}


def tile_name(lat: int, lon: int) -> str:
    return f"Copernicus_DSM_COG_10_{'N' if lat >= 0 else 'S'}{abs(lat):02d}_00_{'E' if lon >= 0 else 'W'}{abs(lon):03d}_00_DEM"


def dem_snapshot(region: dict, extent: tuple, cells: int) -> tuple[np.ndarray, list[dict]]:
    west, south, east, north = extent
    elevation = np.full((cells, cells), np.nan, dtype=np.float32)
    transform = from_bounds(*extent, cells, cells)
    records = []
    for lat in range(math.floor(south), math.floor(north) + 1):
        for lon in range(math.floor(west), math.floor(east) + 1):
            name = tile_name(lat, lon)
            url = f"{DEM_BUCKET}/{name}/{name}.tif"
            path = CACHE / (name + ".tif")
            if not path.exists():
                print("Downloading DSM", name, flush=True)
                # A fixed query prevents unrelated cached Range probes being reused by proxies.
                response = get(url + "?tamadun=full-tile-v1")
                if len(response.content) < 100_000:
                    raise ValueError("Incomplete DSM tile: " + url)
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(response.content)
            raw = path.read_bytes()
            with rasterio.open(path) as src:
                reproject(source=rasterio.band(src, 1), destination=elevation,
                          src_transform=src.transform, src_crs=src.crs,
                          dst_transform=transform, dst_crs="EPSG:4326", dst_nodata=np.nan,
                          resampling=Resampling.bilinear, init_dest_nodata=False)
            records.append({"url": url, "sha256": digest(raw), "bytes": len(raw), "dataset": "Copernicus DEM 2021 GLO-30 Public", "retrievedUtc": dt.datetime.now(dt.timezone.utc).isoformat()})
    if not np.isfinite(elevation).all():
        raise ValueError("DSM has unfilled pixels for " + region["stateId"])
    return elevation, records


def project_points(geometry: dict, lat0: float):
    """Scale WGS84 coordinates to local metres for distance comparisons."""
    sx = 111_412.84 * math.cos(math.radians(lat0))
    sy = 111_132.92
    coordinates = geometry["coordinates"]
    if geometry["type"] == "LineString":
        return [(p[0] * sx, p[1] * sy) for p in coordinates]
    return []


def layer_data(region: dict, extent: tuple, source: dict, heights: np.ndarray, cells: int):
    west, south, east, north = extent
    xx, yy = np.meshgrid(west + (np.arange(cells) + .5) * (east-west) / cells,
                         north - (np.arange(cells) + .5) * (north-south) / cells)
    px = xx * (111_412.84 * math.cos(math.radians(region["latitude"])))
    py = yy * 111_132.92
    best = np.full((cells, cells), np.inf)
    sea = np.zeros((cells, cells), dtype=bool)
    count = 0
    for feature in source["features"]:
        if feature["properties"].get("natural") != "coastline":
            continue
        points = project_points(feature["geometry"], region["latitude"])
        for (x1, y1), (x2, y2) in zip(points, points[1:]):
            dx, dy = x2-x1, y2-y1
            denom = dx*dx + dy*dy
            if denom == 0:
                continue
            t = np.clip(((px-x1)*dx+(py-y1)*dy) / denom, 0, 1)
            distance = (px-(x1+t*dx))**2 + (py-(y1+t*dy))**2
            nearer = distance < best
            sea[nearer] = ((dx*(py-y1)-dy*(px-x1)) < 0)[nearer]
            best[nearer] = distance[nearer]
            count += 1
    if count == 0:
        raise ValueError("No mapped coastline around " + region["stateId"] + "; move the crop to the waterfront")
    coast_distance = np.sqrt(best)
    terrain = np.full((cells, cells), 6, dtype=np.uint8)
    terrain[heights > 20] = 8
    terrain[heights > 60] = 9
    terrain[sea] = 1
    terrain[sea & (coast_distance < 60)] = 2
    terrain[sea & (coast_distance > 260)] = 0
    terrain[~sea & (coast_distance < 12)] = 3
    for feature in source["features"]:
        tags = feature["properties"]
        if tags.get("natural") == "coastline":
            continue
        geom = shape(feature["geometry"])
        if not geom.is_valid:
            geom = geom.buffer(0)
        if geom.is_empty:
            continue
        if geom.geom_type in ("LineString", "MultiLineString"):
            if tags.get("waterway") not in ("river", "stream"):
                continue
            try:
                width = float(tags.get("width", "12").replace(" m", ""))
            except ValueError:
                width = 12
            # River centre lines need a minimum cartographic width at the four-metre grid.
            geom = geom.buffer(max(4, min(width, 200))/2 / 111_132.92)
        mask = contains_xy(geom, xx, yy) & ~sea
        if tags.get("natural") == "water" or tags.get("waterway") in ("riverbank", "river", "stream"):
            terrain[mask] = 5
        elif tags.get("natural") == "wetland":
            terrain[mask] = 4 if tags.get("wetland") == "mangrove" else 6
        elif tags.get("natural") == "wood" or tags.get("landuse") == "forest":
            terrain[mask] = 7
        elif tags.get("natural") == "beach":
            terrain[mask] = 3
    # DSM is a surface model, so structures may raise measured land. Retain the
    # measured relief but use one global 0..60 m rendering range rather than normalising each crop.
    elevation = np.clip(77 + np.maximum(0, heights) * (178/60), 78, 255).astype(np.uint8)
    elevation[sea] = np.clip(76 - coast_distance[sea]/12, 40, 76).astype(np.uint8)
    elevation[terrain == 5] = 76
    # These are explicitly authored gameplay distributions, not mapped mineral surveys.
    row, col = np.indices((cells, cells))
    pattern = (col * 17 + row * 29 + sum(region["stateId"].encode("utf-8"))) % 41
    fertility = np.clip(160 + pattern - np.maximum(0, heights)*1.3, 65, 225).astype(np.uint8)
    tin = np.clip(70 + pattern + np.maximum(0, heights)*.7, 0, 200).astype(np.uint8)
    water = (terrain <= 2) | (terrain == 5)
    fertility[water] = 0
    tin[water] = 0
    return terrain, elevation, fertility, tin, coast_distance


def validate(terrain: np.ndarray) -> dict:
    h, w = terrain.shape
    buildable = (terrain >= 3) & (terrain != 5) & (terrain != 9)
    coastal = np.zeros_like(buildable)
    sea = terrain <= 2
    coastal[1:] |= sea[:-1]
    coastal[:-1] |= sea[1:]
    coastal[:, 1:] |= sea[:, :-1]
    coastal[:, :-1] |= sea[:, 1:]
    valid = buildable[:-1, :-1] & buildable[1:, :-1] & buildable[:-1, 1:] & buildable[1:, 1:]
    touching = coastal[:-1, :-1] | coastal[1:, :-1] | coastal[:-1, 1:] | coastal[1:, 1:]
    ys, xs = np.nonzero(valid & touching)
    visited = np.zeros_like(buildable)
    components = np.full_like(terrain, -1, dtype=np.int32)
    component_sizes = []
    largest = 0
    for y, x in zip(*np.nonzero(buildable)):
        if visited[y, x]:
            continue
        visited[y, x] = True
        queue = [(int(x), int(y))]
        for cx, cy in queue:
            for nx, ny in ((cx-1,cy),(cx+1,cy),(cx,cy-1),(cx,cy+1)):
                if 0 <= nx < w and 0 <= ny < h and buildable[ny,nx] and not visited[ny,nx]:
                    visited[ny,nx] = True
                    queue.append((nx,ny))
        component_id = len(component_sizes)
        for cx, cy in queue:
            components[cy, cx] = component_id
        component_sizes.append(len(queue))
        largest = max(largest, len(queue))
    usable = [i for i, (y, x) in enumerate(zip(ys, xs)) if component_sizes[components[y,x]] >= 8_000]
    ys, xs = ys[usable], xs[usable]
    result = {"landCells": int(buildable.sum()), "seaCells": int(sea.sum()), "riverCells": int((terrain == 5).sum()), "largestConnectedLandCells": largest, "harborFootprints": len(xs), "harborX": int(xs[len(xs)//2]) if len(xs) else -1, "harborY": int(ys[len(ys)//2]) if len(ys) else -1}
    if len(xs) == 0 or largest < 8_000 or int(sea.sum()) < 1_000:
        raise ValueError("Unplayable geographic crop: " + json.dumps(result))
    return result


def bake(region: dict, cells: int, metres: int, fetch: bool, check: bool):
    state = region["stateId"]
    extent = bounds(region, metres)
    src = SOURCES / state
    osm_path, height_path, dem_path = src / "osm.geojson", src / "dsm_samples.npz", src / "dem_sources.json"
    if fetch:
        src.mkdir(parents=True, exist_ok=True)
        existing_osm = json.loads(osm_path.read_text(encoding="utf-8")) if osm_path.exists() else {}
        if not osm_path.exists() or (existing_osm.get("cropBounds") is not None and existing_osm["cropBounds"] != list(extent)):
            snapshot = osm_snapshot(region, extent)
            snapshot["cropBounds"] = list(extent)
            write_json(osm_path, snapshot)
        elif "cropBounds" not in existing_osm:
            existing_osm["cropBounds"] = list(extent)
            write_json(osm_path, existing_osm)
        old_dem = json.loads(dem_path.read_text(encoding="utf-8")) if dem_path.exists() else []
        sample_bounds = list(extent)
        if not height_path.exists() or (old_dem and old_dem[0].get("sampleBounds", sample_bounds) != sample_bounds):
            heights, dem_records = dem_snapshot(region, extent, cells)
            np.savez_compressed(height_path, metres=heights)
            for item in dem_records:
                item["sampleBounds"] = sample_bounds
            write_json(dem_path, dem_records)
        elif old_dem and "sampleBounds" not in old_dem[0]:
            for item in old_dem:
                item["sampleBounds"] = sample_bounds
            write_json(dem_path, old_dem)
    osm = json.loads(osm_path.read_text(encoding="utf-8"))
    dem_records = json.loads(dem_path.read_text(encoding="utf-8"))
    heights = np.load(height_path)["metres"]
    layers = layer_data(region, extent, osm, heights, cells)
    report = validate(layers[0])
    west, south, east, north = extent
    source_urls = [osm["sourceUrl"], *[r["url"] for r in dem_records]]
    record = {"id": state + "_region", "stateId": state, "regionMs": region["regionMs"], "regionEn": region["regionEn"], "width": cells, "height": cells, "revision": "1", "south": south, "west": west, "north": north, "east": east,
              **{key: base64.b64encode(layer.tobytes()).decode("ascii") for key, layer in zip(("terrain", "elevation", "fertility", "tin"), layers)},
              "sources": source_urls,
              "attribution": "Map data © OpenStreetMap contributors (ODbL; openstreetmap.org/copyright). Produced using Copernicus WorldDEM-30 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved. Contemporary geography; gameplay resources are authored.",
              "previewResource": "Maps/" + state + "_region_preview"}
    target = OUT / (state + "_region.json")
    encoded = json.dumps(record, ensure_ascii=False, indent=2) + "\n"
    if check:
        if target.read_text(encoding="utf-8") != encoded:
            raise ValueError("Map bake differs: " + state)
    else:
        OUT.mkdir(parents=True, exist_ok=True)
        target.write_text(encoded, encoding="utf-8")
        meta(target)
        image = Image.fromarray(COLORS[layers[0]], mode="RGB").resize((512,512), Image.Resampling.NEAREST)
        draw = ImageDraw.Draw(image)
        draw.line((28,480,128,480), fill=(245,240,220), width=4)
        draw.text((28,459), "200 m", fill=(245,240,220))
        draw.text((482,18), "N", fill=(245,240,220))
        draw.line((486,35,486,66), fill=(245,240,220), width=3)
        image_path = OUT / (state + "_region_preview.png")
        image.save(image_path)
        meta(image_path, texture=True)
    report.update({"stateId": state, "mapId": record["id"], "bounds": {"south": south, "west": west, "north": north, "east": east}, "layerSha256": {k: digest(v.tobytes()) for k,v in zip(("terrain","elevation","fertility","tin"),layers)}, "snapshotSha256": {"osm.geojson": digest(osm_path.read_bytes()), "dsm_samples.npz": digest(height_path.read_bytes())}})
    if check:
        pinned = json.loads((HERE / "validation.json").read_text(encoding="utf-8"))
        expected = next((r for r in pinned if r["stateId"] == state), None)
        if expected is None or report["snapshotSha256"] != expected["snapshotSha256"]:
            raise ValueError("Source snapshot checksum differs: " + state)
    print(state, json.dumps({k:v for k,v in report.items() if k in ("landCells", "seaCells", "largestConnectedLandCells", "harborFootprints")}), flush=True)
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--fetch", action="store_true", help="Download missing public source snapshots")
    parser.add_argument("--check", action="store_true", help="Validate the existing bakes without rewriting them")
    parser.add_argument("--only", help="Comma-separated state IDs")
    args = parser.parse_args()
    config = json.loads((HERE / "regions.json").read_text(encoding="utf-8"))
    selected = set(args.only.split(",")) if args.only else None
    regions = [r for r in config["regions"] if not selected or r["stateId"] in selected]
    reports, errors = [], []
    for region in regions:
        try:
            reports.append(bake(region, config["cells"], config["cellMetres"]*config["cells"], args.fetch, args.check))
        except Exception as exc:
            errors.append(region["stateId"] + ": " + str(exc))
            print("ERROR", errors[-1], flush=True)
    if not args.check:
        path = HERE / "validation.json"
        previous = json.loads(path.read_text(encoding="utf-8")) if path.exists() and selected else []
        by_state = {r["stateId"]:r for r in previous}
        by_state.update({r["stateId"]:r for r in reports})
        write_json(path, [by_state[r["stateId"]] for r in config["regions"] if r["stateId"] in by_state])
    if errors:
        raise SystemExit("\n".join(errors))


if __name__ == "__main__":
    main()
