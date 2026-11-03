"""
Tamadun & Kota: headless Blender 3D asset pipeline.

Procedurally models every building, zoned lot tier, vehicle, tree and
transport piece of the game, applies PBR (Principled BSDF) materials and
exports one binary glTF 2.0 file per model into ``public/models/``.

Usage (from the repository root)::

    npm run models:spec      # writes scripts/model_spec.json from the TS catalog
    blender --background --factory-startup \
        --python scripts/generate_blender_models.py -- \
        --spec scripts/model_spec.json --out public/models

or simply ``npm run models:blender`` which does both.

Design
------
The architecture is described once, in the TypeScript catalog under
``src/render3d/models/`` (single source of truth). Every model there is a list
of parametric *parts* (box, rectangular frustum, gable prism, cylinder/cone,
ellipsoid/dome) with a material id. ``scripts/model_spec.json`` serialises
those parts and the PBR material table.

This script contains a Python port of the part generators in
``primitives.ts`` (``part_polygons`` below), so Blender builds exactly the
same polygons, normals and material assignments that the browser renders
when it builds meshes inline (the single-file Artifact build, where external
``.glb`` fetches are blocked). Smooth-shaded parts (cylinder sides, domes)
are reproduced with custom split normals.

Coordinate systems: the spec is +Y up (glTF convention). Blender is +Z up, so
spec (x, y, z) maps to Blender (x, -z, y); the glTF exporter's +Y-up
conversion maps it back exactly.

Requires numpy for Blender's glTF exporter (``apt-get install python3-numpy``
on Debian/Ubuntu system Blender builds).
"""

import argparse
import json
import math
import os
import sys
import time

import bpy  # type: ignore
import bmesh  # type: ignore  # noqa: F401  (kept for users extending the script)


# --------------------------------------------------------------------------- arguments


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    here = os.path.dirname(os.path.abspath(__file__))
    root = os.path.dirname(here)
    p = argparse.ArgumentParser(description="Export the Tamadun & Kota 3D catalog to .glb")
    p.add_argument("--spec", default=os.path.join(here, "model_spec.json"))
    p.add_argument("--out", default=os.path.join(root, "public", "models"))
    p.add_argument("--only", default="", help="comma-separated model ids (default: all)")
    return p.parse_args(argv)


# --------------------------------------------------------------------------- math helpers


def v_sub(a, b):
    return (a[0] - b[0], a[1] - b[1], a[2] - b[2])


def v_dot(a, b):
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]


def v_norm(a):
    length = math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]) or 1.0
    return (a[0] / length, a[1] / length, a[2] / length)


def round6(v):
    return round(v * 1e6) / 1e6


def polygon_normal(vs):
    """Newell's method (identical to primitives.ts)."""
    nx = ny = nz = 0.0
    n = len(vs)
    for i in range(n):
        a = vs[i]
        b = vs[(i + 1) % n]
        nx += (a[1] - b[1]) * (a[2] + b[2])
        ny += (a[2] - b[2]) * (a[0] + b[0])
        nz += (a[0] - b[0]) * (a[1] + b[1])
    return v_norm((nx, ny, nz))


def centroid(vs):
    n = float(len(vs))
    return (sum(v[0] for v in vs) / n, sum(v[1] for v in vs) / n, sum(v[2] for v in vs) / n)


def same(a, b):
    return abs(a[0] - b[0]) + abs(a[1] - b[1]) + abs(a[2] - b[2]) <= 1e-7


def dedupe(vs):
    out = []
    for v in vs:
        if not out or not same(out[-1], v):
            out.append(v)
    while len(out) > 1 and same(out[0], out[-1]):
        out.pop()
    return out


def rotate(v, r):
    """Rotate X, then Y, then Z (matches primitives.ts)."""
    if not r:
        return v
    x, y, z = v
    if r[0]:
        c, s = math.cos(r[0]), math.sin(r[0])
        y, z = y * c - z * s, y * s + z * c
    if r[1]:
        c, s = math.cos(r[1]), math.sin(r[1])
        x, z = x * c + z * s, -x * s + z * c
    if r[2]:
        c, s = math.cos(r[2]), math.sin(r[2])
        x, y = x * c - y * s, x * s + y * c
    return (x, y, z)


# --------------------------------------------------------------------------- procedural primitives


def frustum_polys(bw, bd, tw, td, h):
    b = [(-bw / 2, 0.0, -bd / 2), (bw / 2, 0.0, -bd / 2), (bw / 2, 0.0, bd / 2), (-bw / 2, 0.0, bd / 2)]
    t = [(-tw / 2, h, -td / 2), (tw / 2, h, -td / 2), (tw / 2, h, td / 2), (-tw / 2, h, td / 2)]
    polys = [{"verts": list(b)}]
    if tw > 0 and td > 0:
        polys.append({"verts": list(t)})
    for i in range(4):
        j = (i + 1) % 4
        polys.append({"verts": [b[i], b[j], t[j], t[i]]})
    return polys


def local_polygons(part):
    kind, s = part["t"], part["s"]
    if kind == "box":
        w, h, d = s
        return frustum_polys(w, d, w, d, h)
    if kind == "frustum":
        bw, bd, tw, td, h = s
        return frustum_polys(bw, bd, tw, td, h)
    if kind == "gable":
        w, h, d = s
        x, z = w / 2, d / 2
        a, b, c, e = (-x, 0.0, -z), (x, 0.0, -z), (x, 0.0, z), (-x, 0.0, z)
        r0, r1 = (0.0, h, -z), (0.0, h, z)
        return [{"verts": [a, b, c, e]}, {"verts": [a, r0, b]}, {"verts": [e, c, r1]}, {"verts": [a, e, r1, r0]}, {"verts": [b, r0, r1, c]}]
    if kind == "cyl":
        rb, rt, h, seg = s
        n = max(3, int(round(seg)))
        smooth = bool(part.get("smooth"))

        def ring(r, y):
            return [(r * math.cos(i / n * math.pi * 2), y, r * math.sin(i / n * math.pi * 2)) for i in range(n)]

        def nrm(k):
            a = k / n * math.pi * 2
            return v_norm((math.cos(a) * h, rb - rt, math.sin(a) * h))

        bot, top = ring(rb, 0.0), ring(rt, h)
        polys = []
        for i in range(n):
            j = (i + 1) % n
            verts = [bot[i], bot[j], top[j], top[i]]
            if smooth:
                polys.append({"verts": verts, "normals": [nrm(i), nrm(j), nrm(j), nrm(i)]})
            else:
                polys.append({"verts": verts})
        if rb > 0:
            polys.append({"verts": list(bot)})
        if rt > 0:
            polys.append({"verts": list(top)})
        return polys
    if kind == "sphere":
        rx, ry, rz, seg, rings_raw, hemi = s
        n = max(4, int(round(seg)))
        rings = max(2, int(round(rings_raw)))
        lat0 = 0.0 if hemi else -math.pi / 2
        y_off = 0.0 if hemi else ry

        def pt(i, j):
            lat = lat0 + (math.pi / 2 - lat0) * j / rings
            lon = i / n * math.pi * 2
            return (rx * math.cos(lat) * math.cos(lon), y_off + ry * math.sin(lat), rz * math.cos(lat) * math.sin(lon))

        def nr(v):
            return v_norm((v[0] / (rx * rx), (v[1] - y_off) / (ry * ry), v[2] / (rz * rz)))

        polys = []
        for j in range(rings):
            for i in range(n):
                d = dedupe([pt(i, j), pt(i + 1, j), pt(i + 1, j + 1), pt(i, j + 1)])
                if len(d) < 3:
                    continue
                polys.append({"verts": d, "normals": [nr(v) for v in d]})
        if hemi:
            polys.append({"verts": [pt(i, 0) for i in range(n)]})
        return polys
    raise ValueError("unknown part type %r" % kind)


def part_polygons(part):
    """World-space polygons with outward winding (port of primitives.ts partPolygons)."""
    local = local_polygons(part)
    c = centroid([v for p in local for v in p["verts"]])
    r = part.get("r")
    pos = part["p"]
    out = []
    for poly in local:
        verts = dedupe(poly["verts"])
        if len(verts) < 3:
            continue
        n = polygon_normal(verts)
        normals = poly.get("normals") if poly.get("normals") and len(poly["normals"]) == len(verts) else None
        if v_dot(n, v_sub(centroid(verts), c)) < 0:
            verts = list(reversed(verts))
            normals = list(reversed(normals)) if normals else None
        world = []
        for v in verts:
            w = rotate(v, r)
            world.append((round6(w[0] + pos[0]), round6(w[1] + pos[1]), round6(w[2] + pos[2])))
        out.append({"verts": world, "normals": [rotate(nn, r) for nn in normals] if normals else None})
    return out


# --------------------------------------------------------------------------- PBR materials


def srgb_to_linear(hex_color):
    n = int(hex_color[1:], 16)
    out = []
    for v in ((n >> 16) & 255, (n >> 8) & 255, n & 255):
        s = v / 255.0
        out.append(s / 12.92 if s <= 0.04045 else ((s + 0.055) / 1.055) ** 2.4)
    return out


def set_input(node, names, value):
    for name in names:
        if name in node.inputs:
            node.inputs[name].default_value = value
            return


def build_material(mat_id, d):
    mat = bpy.data.materials.get(mat_id) or bpy.data.materials.new(mat_id)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    r, g, b = srgb_to_linear(d["color"])
    set_input(bsdf, ["Base Color"], (r, g, b, 1.0))
    set_input(bsdf, ["Metallic"], float(d["metalness"]))
    set_input(bsdf, ["Roughness"], float(d["roughness"]))
    if d.get("opacity", 1) < 1:
        set_input(bsdf, ["Alpha"], float(d["opacity"]))
    if d.get("emissive") and d.get("emissiveBase"):
        er, eg, eb = srgb_to_linear(d["emissive"])
        set_input(bsdf, ["Emission Color", "Emission"], (er, eg, eb, 1.0))
        set_input(bsdf, ["Emission Strength"], float(d["emissiveBase"]))
    mat.diffuse_color = (r, g, b, 1.0)
    return mat


# --------------------------------------------------------------------------- model assembly


def to_blender(v):
    """spec (x, y-up, z) -> Blender (x, -z, z-up)."""
    return (v[0], -v[2], v[1])


def build_object(model, materials):
    verts, faces, mat_index, loop_normals = [], [], [], []
    slots = {}
    for part in model["parts"]:
        mid = part["m"]
        if mid not in slots:
            slots[mid] = len(slots)
        for poly in part_polygons(part):
            base = len(verts)
            verts.extend(to_blender(v) for v in poly["verts"])
            faces.append(tuple(range(base, base + len(poly["verts"]))))
            mat_index.append(slots[mid])
            ns = poly["normals"] or [polygon_normal(poly["verts"])] * len(poly["verts"])
            loop_normals.extend(to_blender(n) for n in ns)

    mesh = bpy.data.meshes.new(model["id"])
    mesh.from_pydata(verts, [], faces)
    for mid in slots:
        mesh.materials.append(materials[mid])
    mesh.polygons.foreach_set("material_index", mat_index)
    mesh.polygons.foreach_set("use_smooth", [True] * len(faces))
    if hasattr(mesh, "use_auto_smooth"):  # Blender < 4.1
        mesh.use_auto_smooth = True
    mesh.normals_split_custom_set(loop_normals)
    mesh.update()

    obj = bpy.data.objects.new(model["id"], mesh)
    obj["kind"] = model["kind"]
    obj["size"] = model["size"]
    obj["era"] = model["era"]
    bpy.context.scene.collection.objects.link(obj)
    return obj


def export_glb(obj, path):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=True,
        export_yup=True,
        export_apply=True,
        export_normals=True,
        export_materials="EXPORT",
        export_extras=True,
        export_texcoords=False,
    )


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def main():
    args = parse_args()
    if not os.path.exists(args.spec):
        raise SystemExit("Spec %s not found: run `npm run models:spec` first" % args.spec)
    with open(args.spec, "r", encoding="utf-8") as fh:
        spec = json.load(fh)
    only = set(filter(None, args.only.split(",")))
    os.makedirs(args.out, exist_ok=True)
    if not only:
        for f in os.listdir(args.out):
            if f.endswith(".glb"):
                os.remove(os.path.join(args.out, f))

    t0 = time.time()
    manifest = {}
    total = 0
    for model in spec["models"]:
        if only and model["id"] not in only:
            continue
        reset_scene()
        materials = {mid: build_material(mid, d) for mid, d in spec["materials"].items()}
        obj = build_object(model, materials)
        path = os.path.join(args.out, model["id"] + ".glb")
        export_glb(obj, path)
        total += os.path.getsize(path)
        manifest[model["id"]] = {"file": model["id"] + ".glb", "kind": model["kind"], "size": model["size"], "era": model["era"]}
        print("[blender] %-34s %3d parts -> %6.1f KiB" % (model["id"], len(model["parts"]), os.path.getsize(path) / 1024.0))

    if not only:
        with open(os.path.join(args.out, "manifest.json"), "w", encoding="utf-8") as fh:
            json.dump({"generator": "blender %s" % bpy.app.version_string, "version": 1, "models": manifest}, fh, indent=1)
    print("[blender] exported %d models, %.0f KiB in %.1fs" % (len(manifest), total / 1024.0, time.time() - t0))


if __name__ == "__main__":
    main()
