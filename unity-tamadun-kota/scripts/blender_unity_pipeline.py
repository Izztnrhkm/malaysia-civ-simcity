"""
Tamadun & Kota (Unity): headless Blender 3-LOD asset pipeline + shared PBR texture atlas.

Run from ``unity-tamadun-kota/``::

    blender --background --factory-startup --python scripts/blender_unity_pipeline.py

Optional arguments after ``--``::

    -- --spec scripts/model_spec.json --project . --only building_pasar,unity_hab_siber

What it produces
----------------
* ``Assets/Art/Textures/MasterPaletteAtlas.png``           base colour (sRGB)
* ``Assets/Art/Textures/MasterPaletteAtlas_MetallicSmoothness.png``  R = metallic, A = smoothness (linear)
* ``Assets/Art/Textures/MasterPaletteAtlas_Emission.png``  emissive colour (windows, lamps)
* ``Assets/Resources/atlas_layout.json``                   material id -> atlas cell (read by AtlasLayout.cs)
* ``Assets/Art/Models/<Kind>/<id>.fbx`` for every model, each holding three meshes
  ``<id>_LOD0`` (full detail), ``<id>_LOD1`` (small parts dropped, fewer segments) and
  ``<id>_LOD2`` (low-poly stacked boxes) under one root, which is the naming Unity's
  importer and TamadunAutoSetupEditor use to build a LODGroup.
* ``Assets/Art/Models/models_manifest.json``               per-model kind, era, size, metres, triangle counts

Why one atlas
-------------
Every model uses one material ("MasterPaletteAtlas"). Each face's UVs point at the centre of
its material's 32 x 32 px cell, so all buildings, vehicles and trees share one URP Lit material:
the SRP Batcher keeps draw-call setup cheap, and GPU instancing can batch repeated meshes.
That is the basis for thousands of buildings on screen; the real frame rate still depends on
the target GPU and must be profiled in the Unity Profiler.

Scale (1 Unity unit = 1 metre, grid cell = 4 m)
-----------------------------------------------
The Unity-owned catalog in ``scripts/model_spec.json`` contains the scenery geometry and
material definitions. The primitive generators live in ``scripts/catalog_geometry.py``.
Requires Blender 3.6 or newer. No Node or browser source is required.
"""

import argparse
import json
import math
import os
import struct
import sys
import time
import zlib

import bpy  # type: ignore

HERE = os.path.dirname(os.path.abspath(__file__))
PROJECT = os.path.dirname(HERE)
REPO = os.path.dirname(PROJECT)
sys.path.insert(0, HERE)
import catalog_geometry as geometry  # noqa: E402  (part_polygons, polygon_normal, ...)

GRID = 16          # atlas cells per side
ATLAS_SIZE = 512   # pixels
CELL = ATLAS_SIZE // GRID
FOOTPRINT_M = {1: 4.0, 2: 8.0, 3: 16.0}
STOREY_FACTOR = 2.0
# kind -> (horizontal metres per spec unit, vertical metres per spec unit); buildings/zones are per-size
SCALES = {"vehicle": (22.0, 22.0), "tree": (18.0, 18.0), "infra": (4.0, 12.0)}
KIND_FOLDER = {"building": "Buildings", "zone": "Zones", "vehicle": "Vehicles", "tree": "Trees", "infra": "Infrastructure", "unity": "UnityOnly"}

# Extra materials the Unity port needs on top of the web catalog.
EXTRA_MATERIALS = {
    "water": {"color": "#2f6f8f", "metalness": 0.2, "roughness": 0.08},
    "greybox": {"color": "#c9c6bd", "metalness": 0, "roughness": 0.9},
    "led_cyan": {"color": "#bff7ff", "metalness": 0, "roughness": 0.4, "emissive": "#59e3ff", "glow": 2.0, "emissiveBase": 0.8},
}


# --------------------------------------------------------------------------- arguments


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    p = argparse.ArgumentParser(description="Unity 3-LOD FBX + atlas pipeline")
    p.add_argument("--spec", default=os.path.join(HERE, "model_spec.json"))
    p.add_argument("--project", default=PROJECT)
    p.add_argument("--only", default="", help="comma-separated model ids (default: all)")
    return p.parse_args(argv)


# --------------------------------------------------------------------------- Unity-only models
# Authored in the same part language as the web catalog (map-tile units, +Y up, base centre).


def B(p, s, m, r=None):
    d = {"t": "box", "p": list(p), "s": list(s), "m": m}
    if r:
        d["r"] = list(r)
    return d


def C(p, rb, rt, h, seg, m, smooth=True, r=None):
    d = {"t": "cyl", "p": list(p), "s": [rb, rt, h, seg], "m": m, "smooth": smooth}
    if r:
        d["r"] = list(r)
    return d


def S(p, rx, ry, rz, seg, rings, hemi, m):
    return {"t": "sphere", "p": list(p), "s": [rx, ry, rz, seg, rings, 1 if hemi else 0], "m": m}


def F(p, bw, bd, tw, td, h, m):
    return {"t": "frustum", "p": list(p), "s": [bw, bd, tw, td, h], "m": m}


def oil_refinery():
    """Kilang Penapis Minyak (era 3): tanks, distillation columns, flare, pipe racks."""
    parts = [B((0, 0, 0), (2.96, 0.015, 2.96), "concrete")]
    for x, z in ((-0.9, -0.9), (-0.35, -0.9), (-0.9, -0.35), (-0.35, -0.35)):
        parts.append(C((x, 0.015, z), 0.22, 0.22, 0.26, 16, "paint_white"))
        parts.append(S((x, 0.275, z), 0.22, 0.04, 0.22, 16, 3, True, "steel"))
    for i, (x, h) in enumerate(((0.45, 1.05), (0.75, 0.85), (1.05, 0.95))):
        parts.append(C((x, 0.015, -0.7), 0.07, 0.07, h, 10, "steel"))
        for k in range(1, 4):
            parts.append(C((x, 0.015 + h * k / 4.2, -0.7), 0.09, 0.09, 0.02, 10, "steel_dark"))
    parts.append(C((1.2, 0.015, 1.15), 0.035, 0.025, 1.35, 8, "steel_dark"))
    parts.append(S((1.2, 1.36, 1.15), 0.045, 0.06, 0.045, 8, 3, False, "signal_red"))
    for z in (-0.15, 0.05):
        parts.append(B((0.2, 0.25, z), (2.3, 0.03, 0.05), "steel"))
        for x in (-0.8, -0.2, 0.4, 1.0):
            parts.append(B((x, 0.015, z), (0.03, 0.24, 0.03), "steel_dark"))
    parts.append(B((-0.6, 0.015, 0.8), (0.9, 0.22, 0.6), "plaster_white"))
    parts.append(B((-0.6, 0.1, 0.5), (0.86, 0.05, 0.01), "window"))
    parts.append(B((-0.6, 0.235, 0.8), (0.92, 0.02, 0.62), "roof_blue"))
    parts.append(C((0.5, 0.015, 0.8), 0.16, 0.12, 0.5, 12, "paint_red"))
    parts.append(C((0.5, 0.515, 0.8), 0.12, 0.12, 0.06, 12, "paint_white"))
    return {"id": "unity_kilang_minyak", "kind": "building", "size": 3, "era": 3, "parts": parts}


def oil_platform():
    """Pelantar Minyak & Gas (era 3): jacket legs, deck, modules, derrick, helipad, flare boom."""
    parts = []
    for x in (-0.55, 0.55):
        for z in (-0.55, 0.55):
            parts.append(C((x, 0, z), 0.05, 0.04, 0.45, 8, "paint_yellow"))
    parts.append(B((0, 0.2, -0.55), (1.1, 0.025, 0.025), "steel_dark"))
    parts.append(B((0, 0.2, 0.55), (1.1, 0.025, 0.025), "steel_dark"))
    parts.append(B((0, 0.45, 0), (1.5, 0.06, 1.5), "steel"))
    parts.append(B((-0.35, 0.51, -0.3), (0.6, 0.22, 0.5), "paint_white"))
    parts.append(B((-0.35, 0.6, -0.04), (0.56, 0.04, 0.01), "window"))
    parts.append(B((0.3, 0.51, -0.4), (0.5, 0.16, 0.4), "paint_orange"))
    parts.append(F((0.35, 0.51, 0.25), 0.34, 0.34, 0.06, 0.06, 0.8, "steel"))
    parts.append(C((-0.4, 0.51, 0.45), 0.26, 0.26, 0.03, 16, "paint_green"))
    parts.append(B((-0.4, 0.545, 0.45), (0.2, 0.005, 0.03), "paint_white"))
    parts.append(B((0.95, 0.5, 0.0), (0.7, 0.03, 0.03), "steel_dark", r=(0, 0, 0.5)))
    parts.append(S((1.26, 0.67, 0.0), 0.05, 0.07, 0.05, 8, 3, False, "signal_red"))
    return {"id": "unity_pelantar_minyak", "kind": "building", "size": 2, "era": 3, "parts": parts}


def vertical_farm():
    """Ladang Menegak (era 4): glass tower with planted floors and a solar roof."""
    parts = [B((0, 0, 0), (1.96, 0.015, 1.96), "grass")]
    parts.append(B((0, 0.015, 0), (1.2, 1.6, 1.2), "glass_green"))
    for k in range(8):
        y = 0.015 + 0.2 * k
        parts.append(B((0, y, 0), (1.26, 0.025, 1.26), "concrete"))
        parts.append(B((0, y + 0.025, 0.6), (1.18, 0.05, 0.04), "foliage_light"))
        parts.append(B((0.6, y + 0.025, 0), (0.04, 0.05, 1.18), "foliage"))
    parts.append(B((0, 1.615, 0), (1.26, 0.03, 1.26), "concrete_dark"))
    for x in (-0.35, 0.0, 0.35):
        parts.append(B((x, 1.65, 0), (0.3, 0.02, 1.0), "solar", r=(0.3, 0, 0)))
    parts.append(B((-0.75, 0.015, -0.75), (0.3, 0.12, 0.3), "paint_green"))
    return {"id": "unity_ladang_menegak", "kind": "building", "size": 2, "era": 4, "parts": parts}


def cyber_hub():
    """Hab AI & Keselamatan Siber (era 4): podium, twin glass towers, dish, LED crown."""
    parts = [B((0, 0, 0), (1.96, 0.015, 1.96), "concrete")]
    parts.append(B((0, 0.015, 0), (1.8, 0.25, 1.6), "concrete_dark"))
    parts.append(B((0, 0.1, 0.8), (1.7, 0.08, 0.01), "glass"))
    parts.append(B((-0.35, 0.265, -0.1), (0.8, 1.45, 0.8), "glass_dark"))
    parts.append(B((-0.35, 1.715, -0.1), (0.84, 0.05, 0.84), "led_cyan"))
    parts.append(B((0.5, 0.265, 0.3), (0.55, 1.0, 0.55), "glass"))
    parts.append(B((0.5, 1.265, 0.3), (0.58, 0.04, 0.58), "led_cyan"))
    parts.append(S((0.5, 1.305, 0.3), 0.18, 0.08, 0.18, 12, 3, True, "steel"))
    parts.append(C((-0.35, 1.765, -0.1), 0.015, 0.008, 0.45, 6, "steel_dark"))
    parts.append(S((-0.35, 2.215, -0.1), 0.025, 0.025, 0.025, 6, 3, False, "signal_red"))
    return {"id": "unity_hab_siber", "kind": "building", "size": 2, "era": 4, "parts": parts}


def eco_tower():
    """Menara Eko (era 4 residential, density 3+): balconies planted with greenery."""
    parts = [B((0, 0, 0), (0.98, 0.015, 0.98), "grass")]
    parts.append(B((0, 0.015, 0), (0.5, 2.3, 0.5), "glass"))
    for k in range(11):
        y = 0.12 + 0.2 * k
        parts.append(B((0, y, 0), (0.66, 0.025, 0.66), "plaster_white"))
        parts.append(B((0, y + 0.025, 0.31), (0.62, 0.04, 0.04), "foliage" if k % 2 else "foliage_light"))
        parts.append(B((-0.31, y + 0.025, 0), (0.04, 0.04, 0.62), "foliage_dark"))
    parts.append(B((0, 2.315, 0), (0.56, 0.03, 0.56), "concrete"))
    parts.append(S((0, 2.345, 0), 0.2, 0.1, 0.2, 8, 3, True, "foliage_light"))
    return {"id": "unity_eco_tower", "kind": "zone", "size": 1, "era": 4, "parts": parts}


UNITY_MODELS = [oil_refinery, oil_platform, vertical_farm, cyber_hub, eco_tower]


# --------------------------------------------------------------------------- LODs


def part_height(p):
    t, s = p["t"], p["s"]
    if t in ("box", "gable"):
        return s[1]
    if t == "frustum":
        return s[4]
    if t == "cyl":
        return s[2]
    return s[1] * (1 if s[5] else 2)


def part_extent(p):
    """Largest horizontal/vertical extent of a part in spec units (before rotation)."""
    t, s = p["t"], p["s"]
    if t in ("box", "gable"):
        return max(s[0], s[1], s[2])
    if t == "frustum":
        return max(s[0], s[1], s[4])
    if t == "cyl":
        return max(2 * s[0], 2 * s[1], s[2])
    return 2 * max(s[0], s[1], s[2])


def simplify_part(p):
    q = json.loads(json.dumps(p))
    if q["t"] == "cyl":
        q["s"][3] = max(3, int(round(q["s"][3])) // 2)
    elif q["t"] == "sphere":
        q["s"][3] = max(4, int(round(q["s"][3])) // 2)
        q["s"][4] = max(2, int(round(q["s"][4])) // 2)
    return q


def lod1_parts(model):
    """Drop parts smaller than 6 % of the model's size and halve curved segment counts."""
    size = max(part_extent(p) for p in model["parts"])
    keep = [simplify_part(p) for p in model["parts"] if part_extent(p) >= 0.06 * size]
    return keep or [simplify_part(p) for p in model["parts"]]


def bounds(polys):
    xs = [v[0] for poly in polys for v in poly["verts"]]
    ys = [v[1] for poly in polys for v in poly["verts"]]
    zs = [v[2] for poly in polys for v in poly["verts"]]
    return (min(xs), min(ys), min(zs)), (max(xs), max(ys), max(zs))


def lod2_parts(model, materials):
    """Low-poly stand-in: up to three stacked boxes (one per height band) + a ground slab."""
    polys_by_part = [(p, geometry.part_polygons(p)) for p in model["parts"]]
    polys_by_part = [(p, ps) for p, ps in polys_by_part if ps]
    lo, hi = bounds([poly for _, ps in polys_by_part for poly in ps])
    height = max(1e-4, hi[1] - lo[1])
    out = []
    span = max(hi[0] - lo[0], hi[2] - lo[2])

    def is_ground_plate(p, ps):
        (a, _, c), (b, _, d) = bounds(ps)
        return part_height(p) < 0.035 * max(height, 0.5) and p["p"][1] < 0.01 and max(b - a, d - c) >= 0.5 * span

    flat = [(p, ps) for p, ps in polys_by_part if is_ground_plate(p, ps)]
    flat_ids = {id(p) for p, _ in flat}
    solid = [(p, ps) for p, ps in polys_by_part if id(p) not in flat_ids] or polys_by_part
    if flat:
        (a, _, c), (b, _, d) = bounds([poly for _, ps in flat for poly in ps])
        out.append(B(((a + b) / 2, 0, (c + d) / 2), (b - a, 0.012, d - c), dominant(flat, materials)))
    bands = 3 if height > 0.6 else 1
    for k in range(bands):
        y0 = lo[1] + height * k / bands
        y1 = lo[1] + height * (k + 1) / bands
        sel = []
        for p, ps in solid:
            pl, ph = bounds(ps)
            if ph[1] > y0 + 1e-4 and pl[1] < y1 - 1e-4:
                sel.append((p, ps))
        if not sel:
            continue
        (a, _, c), (b, _, d) = bounds([poly for _, ps in sel for poly in ps])
        top = min(y1, max(bounds(ps)[1][1] for _, ps in sel))
        if b - a < 1e-3 or d - c < 1e-3 or top - y0 < 1e-3:
            continue
        out.append(B(((a + b) / 2, y0, (c + d) / 2), (b - a, top - y0, d - c), dominant(sel, materials)))
    return out


def poly_area(vs):
    n = geometry.polygon_normal(vs)
    ax = ay = az = 0.0
    for i in range(len(vs)):
        a, b = vs[i], vs[(i + 1) % len(vs)]
        ax += a[1] * b[2] - a[2] * b[1]
        ay += a[2] * b[0] - a[0] * b[2]
        az += a[0] * b[1] - a[1] * b[0]
    return abs(ax * n[0] + ay * n[1] + az * n[2]) / 2


def dominant(parts_polys, materials):
    area = {}
    for p, ps in parts_polys:
        if p["m"] not in materials:
            continue
        area[p["m"]] = area.get(p["m"], 0) + sum(poly_area(poly["verts"]) for poly in ps)
    return max(area, key=area.get) if area else "greybox"


# --------------------------------------------------------------------------- atlas


def hex_rgb(h):
    n = int(h[1:], 16)
    return ((n >> 16) & 255, (n >> 8) & 255, n & 255)


def write_png(path, width, height, rows_rgba):
    """Minimal RGBA8 PNG writer (no external dependencies)."""
    raw = b"".join(b"\x00" + bytes(row) for row in rows_rgba)

    def chunk(tag, data):
        c = struct.pack(">I", len(data)) + tag + data
        return c + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")
    with open(path, "wb") as fh:
        fh.write(png)


def build_atlas(materials, tex_dir, layout_path):
    ids = list(materials.keys())
    if len(ids) > GRID * GRID:
        raise SystemExit("too many materials for a %dx%d atlas" % (GRID, GRID))
    base = [[0] * (ATLAS_SIZE * 4) for _ in range(ATLAS_SIZE)]
    ms = [[0] * (ATLAS_SIZE * 4) for _ in range(ATLAS_SIZE)]
    em = [[0] * (ATLAS_SIZE * 4) for _ in range(ATLAS_SIZE)]
    for i, mid in enumerate(ids):
        d = materials[mid]
        r, g, b = hex_rgb(d["color"])
        metal = int(round(255 * float(d.get("metalness", 0))))
        smooth = int(round(255 * (1 - float(d.get("roughness", 0.8)))))
        if d.get("emissive"):
            er, eg, eb = hex_rgb(d["emissive"])
            k = min(1.0, float(d.get("glow", 1)))
            er, eg, eb = int(er * k), int(eg * k), int(eb * k)
        else:
            er = eg = eb = 0
        cx, cy = i % GRID, i // GRID  # row 0 at the top of the image
        for y in range(cy * CELL, (cy + 1) * CELL):
            rb, rm, re = base[y], ms[y], em[y]
            for x in range(cx * CELL, (cx + 1) * CELL):
                o = x * 4
                rb[o:o + 4] = (r, g, b, 255)
                rm[o:o + 4] = (metal, 0, 0, smooth)
                re[o:o + 4] = (er, eg, eb, 255)
    os.makedirs(tex_dir, exist_ok=True)
    write_png(os.path.join(tex_dir, "MasterPaletteAtlas.png"), ATLAS_SIZE, ATLAS_SIZE, base)
    write_png(os.path.join(tex_dir, "MasterPaletteAtlas_MetallicSmoothness.png"), ATLAS_SIZE, ATLAS_SIZE, ms)
    write_png(os.path.join(tex_dir, "MasterPaletteAtlas_Emission.png"), ATLAS_SIZE, ATLAS_SIZE, em)
    os.makedirs(os.path.dirname(layout_path), exist_ok=True)
    with open(layout_path, "w", encoding="utf-8") as fh:
        json.dump({"grid": GRID, "size": ATLAS_SIZE, "materials": ids}, fh, indent=1)
    return {mid: ((i % GRID + 0.5) / GRID, 1 - (i // GRID + 0.5) / GRID) for i, mid in enumerate(ids)}


# --------------------------------------------------------------------------- meshes


def scale_for(model):
    kind = model["kind"]
    if kind in SCALES:
        return SCALES[kind]
    size = int(model.get("size") or 1)
    h = FOOTPRINT_M.get(size, 4.0 * size) / size
    return (h, h * STOREY_FACTOR)


def build_mesh(name, parts, uv_of, sx, sy):
    verts, faces, uvs, loop_normals = [], [], [], []
    for part in parts:
        uv = uv_of.get(part["m"], uv_of["greybox"])
        for poly in geometry.part_polygons(part):
            base = len(verts)
            # spec (x, y-up, z) scaled to metres -> Blender (x, -z, z-up)
            verts.extend((v[0] * sx, -v[2] * sx, v[1] * sy) for v in poly["verts"])
            faces.append(tuple(range(base, base + len(poly["verts"]))))
            uvs.extend([uv] * len(poly["verts"]))
            ns = poly["normals"] or [geometry.polygon_normal(poly["verts"])] * len(poly["verts"])
            for n in ns:
                # non-uniform scale: transform normals by the inverse scale, then renormalise
                nx, ny, nz = n[0] / sx, n[1] / sy, n[2] / sx
                ln = math.sqrt(nx * nx + ny * ny + nz * nz) or 1.0
                loop_normals.append((nx / ln, -nz / ln, ny / ln))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    uv_layer = mesh.uv_layers.new(name="UVMap")
    flat = [c for uv in uvs for c in uv]
    uv_layer.data.foreach_set("uv", flat)
    mesh.polygons.foreach_set("use_smooth", [True] * len(faces))
    if hasattr(mesh, "use_auto_smooth"):  # Blender < 4.1
        mesh.use_auto_smooth = True
    mesh.normals_split_custom_set(loop_normals)
    mesh.update()
    tris = sum(len(f) - 2 for f in faces)
    return mesh, tris


def export_fbx(root, path):
    bpy.ops.object.select_all(action="DESELECT")
    root.select_set(True)
    for c in root.children:
        c.select_set(True)
    bpy.context.view_layer.objects.active = root
    bpy.ops.export_scene.fbx(
        filepath=path,
        use_selection=True,
        object_types={"EMPTY", "MESH"},
        apply_unit_scale=True,
        apply_scale_options="FBX_SCALE_ALL",
        axis_forward="-Z",
        axis_up="Y",
        bake_space_transform=True,
        use_mesh_modifiers=True,
        mesh_smooth_type="OFF",
        use_custom_props=True,
        add_leaf_bones=False,
        path_mode="STRIP",
        embed_textures=False,
    )


def main():
    args = parse_args()
    if not os.path.exists(args.spec):
        raise SystemExit("Spec %s not found: restore scripts/model_spec.json from Git" % args.spec)
    with open(args.spec, "r", encoding="utf-8") as fh:
        spec = json.load(fh)
    materials = dict(spec["materials"])
    materials.update(EXTRA_MATERIALS)
    models = list(spec["models"]) + [f() for f in UNITY_MODELS]
    only = set(filter(None, args.only.split(",")))

    project = os.path.abspath(args.project)
    tex_dir = os.path.join(project, "Assets", "Art", "Textures")
    model_dir = os.path.join(project, "Assets", "Art", "Models")
    uv_of = build_atlas(materials, tex_dir, os.path.join(project, "Assets", "Resources", "atlas_layout.json"))
    print("[unity-pipeline] atlas: %d materials in a %dx%d grid (%d px)" % (len(materials), GRID, GRID, ATLAS_SIZE))

    manifest = {}
    t0 = time.time()
    for model in models:
        if only and model["id"] not in only:
            continue
        geometry.reset_scene()
        mat = bpy.data.materials.new("MasterPaletteAtlas")
        sx, sy = scale_for(model)
        root = bpy.data.objects.new(model["id"], None)
        bpy.context.scene.collection.objects.link(root)
        root["kind"] = model["kind"]
        root["era"] = int(model.get("era") or 0)
        root["size"] = int(model.get("size") or 1)
        lods = [model["parts"], lod1_parts(model), lod2_parts(model, materials)]
        tri_counts = []
        for k, parts in enumerate(lods):
            name = "%s_LOD%d" % (model["id"], k)
            mesh, tris = build_mesh(name, parts, uv_of, sx, sy)
            mesh.materials.append(mat)
            obj = bpy.data.objects.new(name, mesh)
            bpy.context.scene.collection.objects.link(obj)
            obj.parent = root
            tri_counts.append(tris)
        kind = "unity" if model["id"].startswith("unity_") else model["kind"]
        folder = os.path.join(model_dir, KIND_FOLDER.get(kind, "Misc"))
        os.makedirs(folder, exist_ok=True)
        path = os.path.join(folder, model["id"] + ".fbx")
        export_fbx(root, path)
        size = int(model.get("size") or 1)
        manifest[model["id"]] = {
            "file": os.path.relpath(path, project).replace(os.sep, "/"),
            "kind": model["kind"],
            "era": int(model.get("era") or 0),
            "size": size,
            "footprintMeters": FOOTPRINT_M.get(size, 4.0) if model["kind"] in ("building", "zone") else None,
            "scale": [sx, sy],
            "triangles": tri_counts,
        }
        print("[unity-pipeline] %-30s LOD0 %5d  LOD1 %5d  LOD2 %3d tris -> %s" % (model["id"], tri_counts[0], tri_counts[1], tri_counts[2], manifest[model["id"]]["file"]))

    if not only:
        with open(os.path.join(model_dir, "models_manifest.json"), "w", encoding="utf-8") as fh:
            json.dump({"generator": "blender %s" % bpy.app.version_string, "unitsPerMetre": 1, "cellMetres": 4,
                       "atlas": "Assets/Art/Textures/MasterPaletteAtlas.png", "models": manifest}, fh, indent=1)
    print("[unity-pipeline] exported %d models in %.1fs" % (len(manifest), time.time() - t0))


if __name__ == "__main__":
    main()
