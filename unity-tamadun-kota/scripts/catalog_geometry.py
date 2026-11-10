"""Geometry primitives for the Unity scenery catalog (+Y-up source coordinates)."""
import math
import bpy


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


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
