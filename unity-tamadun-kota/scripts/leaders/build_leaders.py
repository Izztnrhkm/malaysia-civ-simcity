"""Build the original leader character meshes, rigs, textures and Unity assets.

Run with Blender, not Unity:
  blender --background --python scripts/leaders/build_leaders.py -- --only sultan_abu_bakar
  blender --background --python scripts/leaders/build_leaders.py -- --all

Anatomy uses MakeHuman's official CC0 base and age targets (see vendor licenses).
Clothing, historical variations, rigging and PBR atlases are authored here.
Historical references inform appearance; portrait photos are not used as textures.
"""
import argparse
import hashlib
import json
import math
import os
import sys
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parent.parent
ART = PROJECT / "Assets/Art/Leaders"
RES = PROJECT / "Assets/Resources/Leaders"
FPS = 30
SKIN, CLOTH, METAL, DARK = range(4)


def guid(path):
    return hashlib.md5(("tamadun-leaders/" + str(path).replace("\\", "/")).encode()).hexdigest()


def meta(path, importer=None):
    path = Path(path)
    target = Path(str(path) + ".meta")
    if not target.exists():
        text = "fileFormatVersion: 2\nguid: " + guid(path.relative_to(PROJECT)) + "\n"
        if path.is_dir():
            text += "folderAsset: yes\nDefaultImporter:\n  externalObjects: {}\n  userData: \n  assetBundleName: \n  assetBundleVariant: \n"
        elif importer:
            text += importer
        target.write_text(text, encoding="utf-8")


def ensure(path):
    Path(path).mkdir(parents=True, exist_ok=True)
    current = Path(path)
    while current != PROJECT / "Assets" and PROJECT / "Assets" in current.parents:
        meta(current)
        current = current.parent


def rgb(value):
    return np.array([int(value[i:i + 2], 16) / 255.0 for i in (0, 2, 4)], dtype=np.float32)


def textures(p, folder):
    """A 2K physically based atlas: pores, woven cloth, songket and leather."""
    ensure(folder)
    size = 2048
    yy, xx = np.mgrid[0:size, 0:size]
    palette = [p["skin"], p["cloth"], p["secondary"], "cba859", p["hair"], "e0d9c8",
               "49382a", "302c29", "e8e4d9", p["sash"], "346079", p["skin"],
               "25394b", "a8adb1", "62412b", "895746"]
    colors = np.asarray([rgb(x) for x in palette])
    tile = (yy // 512) * 4 + xx // 512
    local_x, local_y = xx % 512, yy % 512
    seed = int(hashlib.sha256(p["id"].encode()).hexdigest()[:8], 16)
    rng = np.random.default_rng(seed)
    pores = rng.normal(0, 0.006, (size, size)).astype(np.float32)
    weave = np.sin(local_x * math.pi / 2) * np.sin(local_y * math.pi / 2)
    coarse = np.sin(local_x / 41) * np.cos(local_y / 53)
    grain = pores + np.where(np.isin(tile, [1, 2, 8, 9, 10, 12]), weave * 0.013, 0)
    grain += np.where(tile == 0, coarse * 0.003, coarse * 0.008)
    base = np.ones((size, size, 4), dtype=np.float32)
    base[:, :, :3] = np.clip(colors[tile] + grain[:, :, None], 0, 1)
    # Small gold-thread diamonds belong to the sampin and woven headcloth tiles.
    diam = np.abs((local_x % 80) - 40) + np.abs((local_y % 80) - 40)
    brocade = np.isin(tile, [2, 9]) & ((diam < 7) | ((diam > 33) & (diam < 36)))
    base[brocade, :3] = base[brocade, :3] * 0.45 + rgb("c4a45e") * 0.55
    u, v = (local_x / 512 - .04) / .92, (local_y / 512 - .04) / .92
    tint = np.zeros((size, size), dtype=np.float32)
    for ex in (.683, .817):
        tint -= .045 * np.exp(-((u-ex)/.039)**2 - ((v-.556)/.04)**2)
        tint += .012 * np.exp(-((u-ex)/.047)**2 - ((v-.47)/.035)**2)
    tint -= .025 * np.exp(-((u-.75)/.035)**2 - ((v-.25)/.015)**2)
    for fz in (.73, .77, .81):
        tint -= max(0, p["age"]-35) / 1200 * np.exp(-((u-.75)/.09)**4 - ((v-fz)/.0025)**2)
    base[:, :, :3] = np.clip(base[:, :, :3] + np.where(tile == 11, tint, 0)[:, :, None], 0, 1)
    metal = np.zeros((size, size, 4), dtype=np.float32)
    metal[:, :, 3] = np.where(tile == 3, 0.65, np.where(tile == 13, 0.7, 0.34))
    metal[:, :, 0] = np.where(np.isin(tile, [3, 13]), 0.85, 0.0)
    metal[brocade, 0] = 0.3
    metal[brocade, 3] = 0.53
    normal = np.ones((size, size, 4), dtype=np.float32)
    normal[:, :, 0] = np.clip(0.5 + np.cos(local_x * math.pi / 2) * 0.035 + pores * 2, 0, 1)
    normal[:, :, 1] = np.clip(0.5 + np.sin(local_y * math.pi / 2) * 0.035 + pores * 2, 0, 1)
    normal[:, :, 2] = 1
    result = {}
    for suffix, pixels in (("BaseColor", base), ("MetallicSmoothness", metal), ("Normal", normal)):
        path = folder / (p["id"] + "_" + suffix + ".png")
        im = bpy.data.images.new(p["id"] + "_" + suffix, width=size, height=size, alpha=True)
        im.pixels.foreach_set(pixels.ravel())
        im.filepath_raw = str(path)
        im.file_format = "PNG"
        im.save()
        bpy.data.images.remove(im)
        im = bpy.data.images.load(str(path), check_existing=False)
        im.colorspace_settings.name = "sRGB" if suffix == "BaseColor" else "Non-Color"
        result[suffix] = im
        normal_meta = "  textureType: 1\n" if suffix == "Normal" else "  textureType: 0\n"
        meta(path, "TextureImporter:\n  internalIDToNameTable: []\n  externalObjects: {}\n  serializedVersion: 13\n  mipmaps:\n    enableMipMap: 1\n    sRGBTexture: " + ("1" if suffix == "BaseColor" else "0") + "\n  isReadable: 0\n  maxTextureSize: 2048\n" + normal_meta + "  textureShape: 1\n  alphaIsTransparency: 0\n  userData: \n  assetBundleName: \n  assetBundleVariant: \n")
    return result


def materials(p, images, folder):
    result = []
    for name, rough in (("Skin", .54), ("Cloth", .68), ("Metal", .32), ("Hair", .7)):
        m = bpy.data.materials.new(p["id"] + "_" + name)
        m.use_nodes = True
        nt = m.node_tree
        bs = nt.nodes.get("Principled BSDF")
        bs.inputs["Roughness"].default_value = rough
        if name == "Skin":
            bs.inputs["Subsurface Weight"].default_value = .08
            bs.inputs["Subsurface Radius"].default_value = (.6, .3, .15)
        col = nt.nodes.new("ShaderNodeTexImage")
        col.image = images["BaseColor"]
        nt.links.new(col.outputs["Color"], bs.inputs["Base Color"])
        nor = nt.nodes.new("ShaderNodeTexImage")
        nor.image = images["Normal"]
        conv = nt.nodes.new("ShaderNodeNormalMap")
        conv.inputs["Strength"].default_value = .16 if name == "Skin" else .3
        nt.links.new(nor.outputs["Color"], conv.inputs["Color"])
        nt.links.new(conv.outputs["Normal"], bs.inputs["Normal"])
        met = nt.nodes.new("ShaderNodeTexImage")
        met.image = images["MetallicSmoothness"]
        sep = nt.nodes.new("ShaderNodeSeparateColor")
        nt.links.new(met.outputs["Color"], sep.inputs["Color"])
        nt.links.new(sep.outputs["Red"], bs.inputs["Metallic"])
        result.append(m)
        # Explicit URP Lit materials prevent an FBX importer from choosing the Standard shader.
        path = folder / (p["id"] + "_" + name + ".mat")
        ensure(folder)
        ids = {k: guid(Path(im.filepath_raw).relative_to(PROJECT)) for k, im in images.items()}
        text = "%YAML 1.1\n%TAG !u! tag:unity3d.com,2011:\n--- !u!21 &2100000\nMaterial:\n  serializedVersion: 8\n  m_ObjectHideFlags: 0\n  m_CorrespondingSourceObject: {fileID: 0}\n  m_PrefabInstance: {fileID: 0}\n  m_PrefabAsset: {fileID: 0}\n  m_Name: " + m.name + "\n  m_Shader: {fileID: 4800000, guid: 933532a4fcc9baf4fa0491de14d08ed7, type: 3}\n  m_ValidKeywords:\n  - _NORMALMAP\n  - _METALLICSPECGLOSSMAP\n  m_InvalidKeywords: []\n  m_LightmapFlags: 4\n  m_EnableInstancingVariants: 1\n  m_DoubleSidedGI: 0\n  m_CustomRenderQueue: -1\n  stringTagMap: {}\n  disabledShaderPasses: []\n  m_LockedProperties: \n  m_SavedProperties:\n    serializedVersion: 3\n    m_TexEnvs:\n"
        for prop, key in (("_BaseMap", "BaseColor"), ("_MetallicGlossMap", "MetallicSmoothness"), ("_BumpMap", "Normal")):
            text += "    - " + prop + ":\n        m_Texture: {fileID: 2800000, guid: " + ids[key] + ", type: 3}\n        m_Scale: {x: 1, y: 1}\n        m_Offset: {x: 0, y: 0}\n"
        text += "    m_Ints: []\n    m_Floats:\n    - _Surface: 0\n    - _Cull: 2\n    - _AlphaClip: 0\n    - _Metallic: 0\n    - _Smoothness: " + str(1 - rough) + "\n    - _BumpScale: 0.3\n    m_Colors:\n    - _BaseColor: {r: 1, g: 1, b: 1, a: 1}\n    - _EmissionColor: {r: 0, g: 0, b: 0, a: 1}\n  m_BuildTextureStacks: []\n"
        path.write_text(text, encoding="utf-8")
        meta(path, "NativeFormatImporter:\n  externalObjects: {}\n  mainObjectFileID: 2100000\n  userData: \n  assetBundleName: \n  assetBundleVariant: \n")
    return result


class MeshBuilder:
    def __init__(self):
        self.vertices, self.faces, self.uvs, self.weights, self.mats = [], [], [], [], []

    def add(self, verts, faces, uvs, bone, tile, mat):
        start = len(self.vertices)
        self.vertices.extend(verts)
        self.weights.extend([bone(v) if callable(bone) else {bone: 1} for v in verts])
        ox, oy = tile % 4, tile // 4
        self.uvs.extend([((ox + .04 + .92 * u) / 4, (oy + .04 + .92 * v) / 4) for u, v in uvs])
        self.faces.extend([tuple(start + v for v in f) for f in faces])
        self.mats.extend([mat] * len(faces))

    def loft(self, rings, bone="Hips", tile=1, mat=CLOTH, seg=48, deform=None):
        verts, faces, uv = [], [], []
        for j, (z, rx, ry, cx, cy) in enumerate(rings):
            for k in range(seg + 1):
                a = k / seg * math.tau
                point = (cx + rx * math.cos(a), cy + ry * math.sin(a), z)
                if deform:
                    point = deform(point, a, j / max(1, len(rings) - 1))
                verts.append(point)
                uv.append((k / seg, j / max(1, len(rings) - 1)))
                if j and k:
                    n = j * (seg + 1) + k
                    faces.append((n - seg - 2, n - seg - 1, n, n - 1))
        # Face order follows an outward normal for ascending Z ring sets.
        if rings[0][0] > rings[-1][0]:
            faces = [tuple(reversed(f)) for f in faces]
        faces += [tuple(reversed(tuple(range(seg)))), tuple((len(rings) - 1) * (seg + 1) + k for k in range(seg))]
        self.add(verts, faces, uv, bone, tile, mat)

    def sphere(self, center, radius, bone="Head", tile=0, mat=SKIN, seg=28, rings=16, clamp=None):
        verts, faces, uv = [], [], []
        for j in range(rings + 1):
            a = math.pi * j / rings
            for k in range(seg + 1):
                b = math.tau * k / seg
                p = (center[0] + radius[0] * math.sin(a) * math.cos(b),
                     center[1] + radius[1] * math.sin(a) * math.sin(b),
                     center[2] + radius[2] * math.cos(a))
                if clamp:
                    p = clamp(p)
                verts.append(p)
                uv.append((k / seg, j / rings))
                if j and k:
                    n = j * (seg + 1) + k
                    faces.append((n - 1, n, n - seg - 1, n - seg - 2))
        self.add(verts, faces, uv, bone, tile, mat)

    def tube(self, points, radii, bone="Head", tile=3, mat=METAL, seg=10):
        verts, faces, uv = [], [], []
        for j, pt in enumerate(points):
            p = Vector(pt)
            tangent = Vector(points[min(j + 1, len(points) - 1)]) - Vector(points[max(0, j - 1)])
            tangent.normalize()
            u = tangent.cross(Vector((0, 1, 0)))
            if u.length < .1:
                u = tangent.cross(Vector((1, 0, 0)))
            u.normalize()
            v = tangent.cross(u).normalized()
            r = radii[j] if isinstance(radii, (list, tuple)) else radii
            for k in range(seg + 1):
                a = k / seg * math.tau
                q = p + r * (u * math.cos(a) + v * math.sin(a))
                verts.append(tuple(q))
                uv.append((k / seg, j / max(1, len(points) - 1)))
                if j and k:
                    n = j * (seg + 1) + k
                    faces.append((n - seg - 2, n - seg - 1, n, n - 1))
        self.add(verts, faces, uv, bone, tile, mat)

    def patch(self, points, bone="Chest", tile=3, mat=METAL):
        faces = [tuple(range(len(points)))]
        self.add(points, faces, [(i % 2, (i // 2) % 2) for i in range(len(points))], bone, tile, mat)

    def finish(self, name, mats):
        mesh = bpy.data.meshes.new(name)
        mesh.from_pydata(self.vertices, [], self.faces)
        mesh.materials.clear()
        for m in mats:
            mesh.materials.append(m)
        uv = mesh.uv_layers.new(name="UVMap")
        for polygon, mi in zip(mesh.polygons, self.mats):
            polygon.material_index = mi
            polygon.use_smooth = True
            for li in polygon.loop_indices:
                uv.data[li].uv = self.uvs[mesh.loops[li].vertex_index]
        mesh.update()
        obj = bpy.data.objects.new(name, mesh)
        bpy.context.collection.objects.link(obj)
        groups = {}
        for i, weights in enumerate(self.weights):
            for bone, weight in weights.items():
                if bone not in groups:
                    groups[bone] = obj.vertex_groups.new(name=bone)
                groups[bone].add([i], weight, "REPLACE")
        return obj


def torso_weights(v):
    z = v[2]
    if z < 1.02:
        return {"Hips": 1}
    if z < 1.24:
        t = (z - 1.02) / .22
        return {"Hips": 1 - t, "Spine": t}
    if z < 1.42:
        t = (z - 1.24) / .18
        return {"Spine": 1 - t, "Chest": t}
    return {"Chest": 1}


def smooth_rings(control, count):
    zs = np.linspace(control[0][0], control[-1][0], count)
    data = np.array(control)
    return [tuple([float(z)] + [float(np.interp(z, data[:, 0], data[:, i])) for i in range(1, 5)]) for z in zs]


def anatomical_skin(b,p):
    """Morph CC0 human topology, repose the arms, and skin it to our preview rig."""
    verts, groups, faces = [], {}, []
    group = ""
    for line in (HERE/"vendor/base.obj").read_text(encoding="utf-8").splitlines():
        t=line.split()
        if not t:
            continue
        if t[0]=="v":
            verts.append(list(map(float,t[1:])))
        elif t[0]=="g":
            group=t[1]
            groups[group]=set()
        elif t[0]=="f":
            f=[int(x.split("/")[0])-1 for x in t[1:]]
            groups[group].update(f)
            if group=="body":
                faces.append(f)
    v=np.asarray(verts,dtype=np.float64)
    age=max(0,min(1,(p["age"]-25)/55))
    for name,weight in (("asian-male-young.target",1-age),("asian-male-old.target",age)):
        for line in (HERE/"vendor"/name).read_text(encoding="utf-8").splitlines():
            if not line.strip() or line.startswith("#"):
                continue
            t=line.split()
            v[int(t[0])]+=np.asarray(list(map(float,t[1:])))*weight
    lo=min(v[i,1] for i in groups["body"])
    hi=max(v[i,1] for i in groups["body"])
    scale=1.8/(hi-lo)
    v=np.column_stack((v[:,0]*scale,-v[:,2]*scale,(v[:,1]-lo)*scale))
    joints={name:Vector(np.mean(v[list(indices)],axis=0)) for name,indices in groups.items() if name.startswith("joint-")}
    target={}
    for side,sign in (("l",1),("r",-1)):
        source=[joints["joint-"+side+"-shoulder"],joints["joint-"+side+"-elbow"],joints["joint-"+side+"-hand"],joints["joint-"+side+"-finger-3-3"]]
        dest=[Vector((sign*.18*p["width"],0,1.43)),Vector((sign*.275,0,1.13)),Vector((sign*.311,-.015,.92)),Vector((sign*.316,-.025,.79))]
        target[side]=(source,dest)
    def transform_arm(point,side):
        source,dest=target[side]
        distances,transforms=[],[]
        for i in range(3):
            delta=source[i+1]-source[i]
            direction=delta.normalized()
            other=dest[i+1]-dest[i]
            rotation=direction.rotation_difference(other.normalized())
            projected=(point-source[i]).dot(direction)
            closest=source[i]+direction*max(0,min(delta.length,projected))
            distances.append((point-closest).length)
            transforms.append(dest[i]+other.normalized()*projected*(other.length/delta.length)+rotation@(point-source[i]-direction*projected))
        weights=np.exp(-np.asarray(distances)**2/.0025)
        weights/=sum(weights)
        return sum((transforms[i]*float(weights[i]) for i in range(3)),Vector((0,0,0))),weights
    transformed=[]
    weights=[]
    keep=[]
    for i,point in enumerate(v):
        x,y,z=point
        w=torso_weights(point)
        hand=False
        if abs(x)>.18 and z>0.9 and z<1.49:
            side="l" if x>0 else "r"
            label="Left" if x>0 else "Right"
            result,ww=transform_arm(Vector(point),side)
            mix=max(0,min(1,(abs(x)-.15)/.07))
            point=np.asarray(Vector(point).lerp(result,mix))
            w={label+"UpperArm":float(ww[0]),label+"Forearm":float(ww[1]),label+"Hand":float(ww[2])}
            hand=abs(x)>.424
        if z>1.49:
            # Shift the head toward the garment axis without changing its real
            # anatomical loops, then introduce individual jaw/nose morphology.
            neckblend=max(0,min(1,(z-1.49)/.07))
            point=np.asarray(point).copy()
            point[1]+=.077*neckblend
            point[0]*=1+(p["jaw"]-1)*math.exp(-((z-1.58)/.055)**2)+(p["width"]-1)*.5
            if point[1]<-.045:
                point[1]-=(p["nose"]-1)*.10*math.exp(-(point[0]/.018)**2-((z-1.63)/.025)**2)
            w={"Neck":1-neckblend,"Head":neckblend}
            if point[1]<-.065:
                for sign,side in ((1,"L"),(-1,"R")):
                    d=((point[0]-sign*.033)/.021)**2+((z-1.68)/.013)**2
                    if d<1.5 and z>1.669:
                        amount=.65*max(0,1-d/1.5)
                        w={"Head":1-amount,"Blink"+side:amount}
        if z<.14:
            w={("Left" if x>0 else "Right")+"Foot":1}
        elif z<.94:
            side="Left" if x>0 else "Right"
            t=max(0,min(1,(z-.43)/.18))
            w={side+"UpperLeg":t,side+"LowerLeg":1-t}
        transformed.append(tuple(point))
        weights.append(w)
        keep.append((z>1.55 or (z>1.49 and abs(x)<.058) or hand or (p["outfit"]=="iban" and z>.13)))
    selected=[f for f in faces if all(keep[i] for i in f)]
    # Duplicating only seam vertices lets the head have its own aging atlas tile.
    for is_head,tile in ((True,11),(False,0)):
        ff=[f for f in selected if (sum(transformed[i][2] for i in f)/len(f)>1.49)==is_head]
        unique=sorted(set(i for f in ff for i in f))
        remap={old:new for new,old in enumerate(unique)}
        uv=[]
        for i in unique:
            x,y,z=transformed[i]
            a=(math.atan2(y-.018,x)+math.tau)%math.tau
            uv.append((a/math.tau,max(0,min(1,(z-1.535)/.265)) if is_head else (z*3)%1))
        start=len(b.vertices)
        b.add([transformed[i] for i in unique],[[remap[i] for i in f] for f in ff],uv,"Head",tile,SKIN)
        b.weights[start:]=[weights[i] for i in unique]
    # Shoes are custom, preserving a consistent standing plane for the roster.
    for s,side in ((-1,"Right"),(1,"Left")):
        b.sphere((s*.095,-.057,.07),(.05,.115,.057),side+"Foot",7,DARK,28,16,lambda v:(v[0],v[1],max(.019,v[2])))
    p["_anatomy"]="MakeHuman CC0 hm08, customized male/age targets"


def anatomical_details(b,p):
    """Eyes, hair, glasses and facial hair fitted to the human facial loops."""
    for sign in (-1,1):
        x=sign*.033*(1+(p["width"]-1)*.5)
        b.sphere((x,-.0695,1.668),(.014,.010,.007),"Head",5,DARK,28,18)
        b.sphere((x,-.0792,1.668),(.0057,.0012,.0058),"Head",6,DARK,24,14)
        b.sphere((x,-.0803,1.668),(.0025,.0005,.0031),"Head",4,DARK,20,10)
        points=[(x+(t-.5)*.036,-.077,1.690+.004*math.sin(t*math.pi)) for t in np.linspace(0,1,22)]
        b.tube(points,[.0005+.0018*math.sin(t*math.pi) for t in np.linspace(0,1,22)],"Head",4,DARK,8)
        if p["moustache"]:
            points=[(sign*.002,-.078,1.609),(sign*.012,-.083,1.608),(sign*.025,-.082,1.603),(sign*.039,-.075,1.606)]
            b.tube(points,[.003,.005,.005,.001],"Head",4,DARK,12)
            for j in range(8):
                b.tube([(x,y-.001,z+j*.0005) for x,y,z in points],.0004,"Head",4,DARK,5)
    if p["beard"]!="none":
        end=1.37 if p["beard"]=="long" else 1.55
        rings=[(end,.008,.009,0,-.045),((end+1.565)/2,.037,.025,0,-.042),(1.565,.06,.029,0,-.025),(1.587,.066,.031,0,-.014)]
        b.loft(smooth_rings(rings,24),"Head",4,DARK,48,lambda v,a,t:(v[0]+.001*math.cos(19*a),v[1]-.001*math.sin(19*a),v[2]))
        for j in range(27):
            x=(j/26-.5)*.107
            b.tube([(x,-.06,1.58),(x*.8,-.074,1.555),(x*.2,-.055,end+.008)],.0006,"Head",4,DARK,5)
    if p["headwear"]=="none":
        for s in (-1,1):
            b.sphere((s*.071,.027,1.745),(.024,.065,.044),"Head",4,DARK,32,18)
        b.sphere((0,.046,1.777),(.067,.044,.024),"Head",4,DARK,32,18)
        for s in (-1,1):
            x=s*.033
            pts=[(x+.021*math.cos(a),-.088,1.668+.014*math.sin(a)) for a in np.linspace(0,math.tau,40)]
            b.tube(pts,.0013,"Head",4,DARK,8)
            b.tube([(s*.012,-.088,1.672),(0,-.092,1.677),(-s*.012,-.088,1.672)],.0014,"Head",4,DARK,8)
            b.tube([(s*.055,-.088,1.673),(s*.088,.002,1.681)],.0013,"Head",4,DARK,8)


def body(b, p):
    return anatomical_skin(b,p)


def unused_original_body(b, p):
    w = p["width"]
    torso = [(0.89, .145*w, .086, 0, .01), (1.0, .142*w, .095, 0, .005),
             (1.12, .13*w, .085, 0, 0), (1.27, .168*w, .104, 0, 0),
             (1.38, .19*w, .098, 0, 0), (1.43, .165*w, .08, 0, 0),
             (1.48, .067, .061, 0, 0)]
    b.loft(smooth_rings(torso, 30), torso_weights, 0, SKIN, 48)
    b.loft(smooth_rings([(1.43, .062, .057, 0, 0), (1.54, .047, .048, 0, -.004),
                        (1.58, .052, .05, 0, -.002)], 15), "Neck", 0, SKIN, 40)
    for s, side in ((-1, "Right"), (1, "Left")):
        cx = s * .095
        def leg_weight(v, side=side):
            t = max(0, min(1, (v[2] - .43) / .18))
            return {side + "UpperLeg": t, side + "LowerLeg": 1 - t}
        leg = [(0.10, .035, .038, cx, 0), (.24, .044, .045, cx, .005),
               (.46, .047, .05, cx, -.006), (.54, .052, .057, cx, 0),
               (.76, .068, .07, cx, .012), (.96, .078, .082, cx, .01)]
        b.loft(smooth_rings(leg, 28), leg_weight, 0, SKIN, 32)
        b.sphere((cx, -.057, .07), (.05, .115, .057), side + "Foot", 7, DARK,
                 clamp=lambda v: (v[0], v[1], max(.019, v[2])))
        # Soles follow the rounded leather shoe rather than a rectangular foot.
        shoe = [(0.021, .048, .108, cx, -.055), (.034, .051, .112, cx, -.055)]
        b.loft(shoe, side + "Foot", 7, DARK, 40)
        arm = [(0.91, .027, .03, s * .311, -.015), (.99, .037, .038, s * .303, -.005),
               (1.12, .041, .043, s * .275, 0), (1.23, .046, .046, s * .251, 0),
               (1.38, .056, .055, s * .213, 0), (1.44, .055, .057, s * .18*w, 0)]
        def arm_weight(v, side=side):
            t = max(0, min(1, (v[2] - 1.06) / .17))
            return {side + "UpperArm": t, side + "Forearm": 1 - t}
        b.loft(smooth_rings(arm, 25), arm_weight, 0, SKIN, 32)
        # Anatomical palm, four individually bent fingers and an opposed thumb.
        palm = [(.825, .026, .013, s * .316, -.016), (.85, .033, .017, s * .316, -.016),
                (.89, .031, .018, s * .313, -.013), (.92, .025, .025, s * .311, -.015)]
        b.loft(smooth_rings(palm, 12), side + "Hand", 0, SKIN, 28)
        for k, length in enumerate((.052, .071, .067, .048)):
            x = s * (.293 + k * .015)
            pts = [(x, -.017, .841), (x, -.02, .822), (x, -.026, .832 - length*.65),
                   (x, -.033, .836-length)]
            b.tube(pts, [.009, .0085, .007, .0055], side+"Hand", 0, SKIN, 12)
            b.sphere((x, -.038, .842-length), (.0045, .0015, .006), side+"Hand", 11, SKIN, 12, 8)
        pts = [(s*.29, -.02, .89), (s*.276, -.035, .869), (s*.278, -.044, .843)]
        b.tube(pts, [.014, .011, .008], side+"Hand", 0, SKIN, 12)


def head(b,p):
    return anatomical_details(b,p)


def unused_original_head(b, p):
    width, jaw = p["width"], p["jaw"]
    controls = [(1.535, .025*jaw, .035, 0, -.013), (1.555, .06*jaw, .057, 0, -.003),
                (1.585, .078*jaw, .068, 0, 0), (1.62, .086*width, .076, 0, 0),
                (1.665, .09*width, .078, 0, .002), (1.71, .089*width, .079, 0, .006),
                (1.75, .079*width, .073, 0, .009), (1.78, .052, .052, 0, .01),
                (1.794, .008, .01, 0, .01)]
    def gaussian(x, z, cx, cz, rx, rz):
        return math.exp(-((x-cx)/rx)**2 - ((z-cz)/rz)**2)
    def sculpt(v, angle, t):
        x, y, z = v
        front = max(0, -math.sin(angle))**10
        y -= front * (0.021*p["nose"]*gaussian(x,z,0,1.658,.016,.042) +
                      .034*p["nose"]*gaussian(x,z,0,1.635,.021,.014) +
                      .012*gaussian(x,z,0,1.603,.035,.018) +
                      .008*gaussian(x,z,0,1.551,.03,.015))
        for sx in (-.038, .038):
            y += front * .01*gaussian(x,z,sx,1.684,.022,.012)
            y -= front * .009*p["brow"]*gaussian(x,z,sx,1.704,.028,.01)
            y -= front * .012*gaussian(x,z,sx*1.4,1.654,.031,.02)
        return x,y,z
    b.loft(smooth_rings(controls, 62), "Head", 0, SKIN, 96, sculpt)
    # Ears have an outer helix, inner concha and a lobe; they are not flat discs.
    for s in (-1,1):
        b.sphere((s*.092*width,.009,1.665),(.017,.017,.034),"Head",0,SKIN,28,18)
        pts=[(s*(.102*width+.004*math.cos(a)),.001+.011*math.sin(a),1.667+.027*math.cos(a)) for a in np.linspace(0,math.tau,30)]
        b.tube(pts,.0033,"Head",0,SKIN,8)
        b.sphere((s*.104*width,-.002,1.663),(.004,.009,.017),"Head",15,SKIN,16,12)
        # Eyeballs, iris and pupil are nested in the sculpted eye sockets.
        x=s*.037*width
        b.sphere((x,-.070,1.683),(.015,.012,.009),"Head",5,DARK,28,18)
        b.sphere((x,-.081,1.683),(.0068,.0015,.0068),"Head",6,DARK,24,14)
        b.sphere((x,-.0824,1.683),(.0031,.0007,.0036),"Head",4,DARK,20,10)
        # Top eyelid expands downward on its own blink bone.
        verts,faces,uv=[],[],[]
        for j in range(6):
            for k in range(25):
                t=k/24
                xx=(t-.5)*.032
                low=1.683+.002+math.sin(t*math.pi)*.005
                z=low+(1.698-low)*j/5
                verts.append((x+xx,-.0832-.001*math.sin(t*math.pi),z))
                uv.append((t,j/5))
                if j and k:
                    n=j*25+k
                    faces.append((n-26,n-25,n,n-1))
        b.add(verts,faces,uv,"Blink"+("L" if s>0 else "R"),0,SKIN)
        for upper in (False,True):
            pts=[]
            for a in np.linspace(0,math.pi,24):
                pts.append((x+.016*math.cos(a),-.0835,1.683+(.008 if upper else -.006)*math.sin(a)))
            b.tube(pts,.0013,"Head",0,SKIN,6)
        pts=[(x+s*(t-.5)*.041,-.081,1.706+.004*math.sin(t*math.pi)) for t in np.linspace(0,1,18)]
        b.tube(pts,[.001+math.sin(t*math.pi)*.002 for t in np.linspace(0,1,18)],"Head",4,DARK,8)
        # Nasal alae and recessed nostril detail.
        b.sphere((s*.015,-.099,1.630),(.010,.011,.007),"Head",0,SKIN,24,14)
        b.sphere((s*.011,-.106,1.626),(.004,.0016,.0026),"Head",4,DARK,16,10)
    # Vermilion contours, philtrum and mouth line are modeled rather than painted.
    for upper in (True,False):
        pts=[]
        for t in np.linspace(0,1,30):
            x=(t-.5)*.049
            z=1.599+(.002*math.cos(t*math.tau) if upper else -.003*math.sin(t*math.pi))
            pts.append((x,-.091-.002*math.sin(t*math.pi),z))
        b.tube(pts,[.0007+.0013*math.sin(t*math.pi) for t in np.linspace(0,1,30)],"Head",15,SKIN,8)
    if p["age"]>=55:
        for z in (1.725,1.735):
            pts=[(x,-.073-.006*(1-(x/.055)**2),z+.002*(x/.055)**2) for x in np.linspace(-.052,.052,22)]
            b.tube(pts,.00045,"Head",15,SKIN,5)
    if p["moustache"]:
        for s in (-1,1):
            pts=[(s*.003,-.093,1.612),(s*.013,-.098,1.610),(s*.024,-.096,1.606),(s*.034,-.087,1.605)]
            b.tube(pts,[.003,.0045,.004,.0009],"Head",4,DARK,12)
            for j in range(5):
                b.tube([(x,y-.0005,z+j*.0006) for x,y,z in pts],.0004,"Head",4,DARK,5)
    beard=p["beard"]
    if beard!="none":
        end=1.365 if beard=="long" else 1.525
        rings=[(end,.008,.009,0,-.068),((end+1.565)/2,.041,.022,0,-.066),(1.55,.065,.029,0,-.042),(1.581,.07,.027,0,-.025)]
        b.loft(smooth_rings(rings,20),"Head",4,DARK,48,
               lambda v,a,t:(v[0]+.0014*math.cos(a*17),v[1]-.0015*math.sin(a*19+t*11),v[2]))
        for j in range(25):
            x=(j/24-.5)*.115
            b.tube([(x,-.067,1.564),(x*.8,-.09,1.535),(x*.24,-.079,end+.014)],.0006,"Head",4,DARK,5)
    # Receding silver hair is specific to Lim Chong Eu; covered heads retain side hair.
    if p["headwear"]=="none":
        for s in (-1,1):
            b.sphere((s*.076,.014,1.743),(.022,.071,.046),"Head",4,DARK,32,20)
        b.sphere((0,.043,1.773),(.068,.047,.027),"Head",4,DARK,32,18)
        for s in (-1,1):
            x=s*.035
            pts=[(x+.022*math.cos(a),-.091,1.682+.014*math.sin(a)) for a in np.linspace(0,math.tau,40)]
            b.tube(pts,.0015,"Head",4,DARK,8)
            b.tube([(s*.014,-.091,1.686),(0,-.095,1.689),(-s*.014,-.091,1.686)],.0015,"Head",4,DARK,8)
            b.tube([(s*.057,-.089,1.684),(s*.092,.002,1.688)],.0014,"Head",4,DARK,8)


def cloth_fold(v,a,t):
    x,y,z=v
    fold=1+.012*math.sin(a*17+t*9)+.006*math.sin(a*29-t*13)
    return x*fold,y*fold,z


def star(b,x,y,z,r=.018,bone="Chest"):
    pts=[]
    for k in range(16):
        a=k*math.pi/8
        rad=r if k%2==0 else r*.47
        pts.append((x+rad*math.sin(a),y,z+rad*math.cos(a)))
    center=(x,y-.002,z)
    b.add([center]+pts,[(0,k+1,(k+1)%16+1) for k in range(16)],[(.5,.5)]+[(.5+.4*math.sin(k*math.pi/8),.5+.4*math.cos(k*math.pi/8)) for k in range(16)],bone,3,METAL)
    b.sphere((x,y-.003,z),(.005,.002,.005),bone,10,METAL,14,10)


def garments(b,p):
    outfit,w=p["outfit"],p["width"]
    torso=[(.91,.158*w,.101,0,.005),(1.03,.15*w,.108,0,.005),(1.15,.146*w,.103,0,0),
           (1.27,.177*w,.12,0,0),(1.38,.202*w,.112,0,0),(1.435,.188*w,.09,0,0),
           (1.46,.15*w,.08,0,0),(1.495,.065,.065,0,0)]
    if outfit=="robe":
        torso=[(.22,.19,.125,0,.012),(.64,.185,.124,0,.012),(.94,.168,.111,0,.007)]+torso[1:]
    if outfit!="iban":
        b.loft(smooth_rings(torso,38),torso_weights,1,CLOTH,64,cloth_fold)
        b.loft(smooth_rings([(.83,.145*w,.092,0,.01),(.99,.157*w,.108,0,.006)],12),"Hips",1 if outfit in ("uniform","suit") else 2,CLOTH,48)
    for s,side in ((-1,"Right"),(1,"Left")):
        def arm_weight(v,side=side):
            t=max(0,min(1,(v[2]-1.05)/.19))
            return {side+"UpperArm":t,side+"Forearm":1-t}
        if outfit!="iban":
            sleeve=[(.921,.034,.037,s*.31,-.012),(1.01,.044,.047,s*.30,-.003),
                    (1.13,.049,.053,s*.274,0),(1.28,.057,.061,s*.239,0),(1.44,.065,.068,s*.18*w,0)]
            b.loft(smooth_rings(sleeve,24),arm_weight,1,CLOTH,36,cloth_fold)
            cuff=[(.919,.036,.039,s*.311,-.012),(.955,.039,.042,s*.308,-.009)]
            b.loft(cuff,side+"Forearm",3 if outfit=="uniform" else 2,METAL if outfit=="uniform" else CLOTH,36)
        def leg_weight(v,side=side):
            t=max(0,min(1,(v[2]-.43)/.18))
            return {side+"UpperLeg":t,side+"LowerLeg":1-t}
        if outfit!="iban":
            leg=[(.12,.042,.044,s*.095,0),(.28,.052,.052,s*.095,.004),(.49,.056,.06,s*.095,-.003),
                 (.69,.077,.082,s*.095,.008),(.96,.085,.091,s*.095,.012)]
            b.loft(smooth_rings(leg,26),leg_weight,1 if outfit in ("uniform","suit") else 2,CLOTH,36,cloth_fold)
        else:
            # Iban baju burung-inspired beadwork and woven sirat; not generic fantasy armor.
            for dz in (0,.025,.05):
                pts=[(s*(.07+.105*t),-.1*math.sin(t*math.pi/2)-.01,1.405-dz-.17*t) for t in np.linspace(0,1,20)]
                b.tube(pts,.003,"Chest",8,CLOTH,8)
                for x,y,z in pts[::2]:
                    b.sphere((x,y-.003,z),(.004,.004,.006),"Chest",3,METAL,10,7)
        if outfit=="uniform":
            # Epaulette fringes, cuff braid and rows of fastenings have actual geometry.
            b.sphere((s*.18*w,-.012,1.448),(.05,.055,.011),side+"UpperArm",3,METAL,24,12)
            for k in range(11):
                a=math.tau*k/11
                x=s*.18*w+.042*math.cos(a)
                y=-.012+.047*math.sin(a)
                b.tube([(x,y,1.445),(x,y,1.417)],.0022,side+"UpperArm",3,METAL,6)
    if outfit in ("baju","royal_baju","silat","iban"):
        # A separate wrapped sampin has a layered front overlap and a woven hem.
        top=.995
        bottom=.61 if outfit=="iban" else .735
        b.loft(smooth_rings([(bottom,.174*w,.117,0,.006),(top,.167*w,.118,0,.008)],26),"Hips",2,CLOTH,64,cloth_fold)
        b.loft([(top-.032,.169*w,.12,0,.008),(top+.018,.168*w,.12,0,.008)],"Hips",9,CLOTH,64)
        b.patch([(-.08,-.119,top-.02),(.02,-.121,top-.02),(.017,-.121,bottom+.02),(-.06,-.12,bottom+.02)],"Hips",2,CLOTH)
        if outfit in ("silat","iban"):
            b.patch([(.05,-.125,.97),(.10,-.125,.97),(.12,-.126,.47),(.04,-.126,.5)],"Hips",9,CLOTH)
    if outfit=="suit":
        # Shirt and two tailored lapels sit above the jacket, with a separate tie.
        b.patch([(-.057,-.091,1.45),(.057,-.091,1.45),(.038,-.127,1.17),(-.038,-.127,1.17)],torso_weights,8,CLOTH)
        for s in (-1,1):
            b.patch([(s*.06,-.094,1.445),(s*.135,-.111,1.37),(s*.052,-.129,1.23),(s*.026,-.124,1.35)],torso_weights,1,CLOTH)
            b.patch([(s*.004,-.096,1.44),(s*.055,-.097,1.447),(s*.034,-.12,1.39)],"Chest",8,CLOTH)
        b.patch([(-.013,-.103,1.433),(.013,-.103,1.433),(.019,-.131,1.23),(0,-.132,1.20),(-.019,-.131,1.23)],torso_weights,9,CLOTH)
        for z in (1.19,1.11):
            b.sphere((.018,-.113,z),(.004,.002,.004),"Spine",4,DARK,12,8)
    elif outfit!="iban":
        collar=[(1.485,.067,.065,0,0),(1.531 if outfit=="uniform" else 1.52,.061,.06,0,0)]
        b.loft(smooth_rings(collar,5),"Chest",3 if outfit=="uniform" else 1,METAL if outfit=="uniform" else CLOTH,48)
        for z in np.linspace(1.36,1.03,7):
            b.sphere((0,-.124 if z>1.2 else -.11,z),(.004,.0025,.004),"Chest" if z>1.25 else "Spine",3,METAL,12,8)
    if outfit in ("uniform","royal_baju"):
        if outfit=="uniform":
            for s in (-1,1):
                for z in np.linspace(1.1,1.39,8):
                    pts=[(s*(.015+.07*t),-.125+.007*t,z+.012*math.sin(t*math.pi)) for t in np.linspace(0,1,15)]
                    b.tube(pts,.0017,"Chest" if z>1.25 else "Spine",3,METAL,6)
                for j in range(12):
                    z=1.12+j*.022
                    pts=[(s*(.105+.007*math.sin(t*math.tau)),-.117,z+.012*t) for t in np.linspace(0,1,12)]
                    b.tube(pts,.0011,torso_weights,3,METAL,5)
        for k in range(4):
            x=-.055+k*.028
            b.patch([(x-.009,-.127,1.335),(x+.009,-.127,1.335),(x+.009,-.13,1.307),(x-.009,-.13,1.307)],"Chest",9 if k%2 else 10,CLOTH)
            star(b,x,-.134,1.29,.015)
        star(b,.08,-.13,1.305,.031)
        # Diagonal sash is conformed to the chest instead of floating in front.
        verts=[]
        for j in range(28):
            t=j/27
            x=.15-.28*t
            z=1.43-.42*t
            y=-.095-.028*math.sin(t*math.pi)
            verts += [(x-.027,y-.003,z+.018),(x+.027,y-.003,z-.018)]
        faces=[(j*2,j*2+1,j*2+3,j*2+2) for j in range(27)]
        b.add(verts,faces,[(k%2,(k//2)/27) for k in range(56)],torso_weights,9,CLOTH)
        for s in (-1,1):
            pts=[(v[0]+s*.001,v[1]-.001,v[2]) for v in verts[0 if s<0 else 1::2]]
            b.tube(pts,.0011,torso_weights,3,METAL,6)
    if p["cape"]:
        verts,faces,uv=[],[],[]
        for j in range(42):
            t=j/41
            for k in range(49):
                a=(k/48-.5)*math.pi*1.17
                rx=.21+.08*t
                ry=.1+.035*t
                x=rx*math.sin(a)
                y=.045+ry*math.cos(a)+.007*math.sin(k*.9)*(t+.2)
                z=1.44-1.18*t+.025*math.cos(k*.4)*t
                verts.append((x,y,z))
                uv.append((k/48,t))
                if j and k:
                    n=j*49+k
                    faces.append((n-50,n-49,n,n-1))
        b.add(verts,faces,uv,torso_weights,2,CLOTH)
        for edge in (0,48):
            b.tube([verts[j*49+edge] for j in range(42)],.0035,torso_weights,3,METAL,8)
    if outfit in ("royal_baju","baju","silat"):
        # A sheathed ceremonial keris rests at the belt, with a bent hilt.
        b.tube([(.14,-.08,.95),(.165,-.08,.7),(.18,-.08,.54)],[.014,.010,.006],"Hips",14,DARK,12)
        b.tube([(.138,-.08,.945),(.13,-.085,1.01),(.106,-.085,1.03)],[.011,.012,.01],"Hips",3,METAL,14)
        b.sphere((.14,-.08,.945),(.045,.014,.009),"Hips",14,DARK,18,10)


def feather(b,base,height,lean=0):
    x,y,z=base
    points=[]
    for k in range(24):
        t=k/23
        points.append((x+lean*t,y+.028*math.sin(t*math.pi),z+height*t))
    b.tube(points,.0012,"Head",14,DARK,6)
    verts,faces,uv=[],[],[]
    for k,(x,y,z) in enumerate(points):
        t=k/23
        width=.018*math.sin(t*math.pi)**.65
        width*=1+.08*math.sin(k*3)
        verts += [(x-width,y,z),(x+width,y,z)]
        uv += [(0,t),(1,t)]
        if k:
            n=k*2
            faces.append((n-2,n-1,n+1,n))
    b.add(verts,faces,uv,"Head",8,CLOTH)


def hats(b,p):
    h=p["headwear"]
    if h=="none":
        return
    if h=="fez":
        b.loft(smooth_rings([(1.747,.086,.079,0,.008),(1.895,.069,.067,0,.012)],18),"Head",2,CLOTH,64)
        b.loft([(1.747,.088,.081,0,.008),(1.759,.088,.081,0,.008)],"Head",3,METAL,64)
        star(b,0,-.073,1.827,.025,"Head")
        for j in range(3):
            feather(b,(.014+j*.004,.01,1.883),.16+j*.016,-.04-j*.01)
    elif h in ("turban","royal_turban","headwrap"):
        tile=8 if h!="headwrap" else 2
        b.loft(smooth_rings([(1.737,.092,.082,0,.006),(1.78,.098,.086,0,.009),
                            (1.82,.087,.078,0,.014),(1.846,.047,.052,0,.016)],19),"Head",tile,CLOTH,64,cloth_fold)
        for j in range(7):
            pts=[]
            for a in np.linspace(0,math.tau,70):
                z=1.758+j*.01+.014*math.sin(a+.6)
                pts.append((.095*math.cos(a),.008+.085*math.sin(a),z))
            b.tube(pts,.003,"Head",tile,CLOTH,8)
        # A trailing cloth end is included on the back of the knot.
        b.patch([(.06,.07,1.8),(.09,.07,1.79),(.09,.093,1.55),(.055,.09,1.58)],"Head",tile,CLOTH)
        if h=="royal_turban":
            star(b,.006,-.079,1.792,.026,"Head")
            feather(b,(.024,.005,1.819),.17,-.045)
    elif h in ("tanjak","tengkolok"):
        b.loft(smooth_rings([(1.744,.089,.079,0,.007),(1.798,.086,.077,0,.008)],12),"Head",2,CLOTH,64,cloth_fold)
        # Folded diagonal sails are thickened by layered cloth strips and seams.
        sails=[([(-.08,-.055,1.782),(.067,-.065,1.804),(.028,-.037,1.92),(-.072,-.029,1.858)],2),
               ([(.065,-.063,1.79),(.108,.0,1.86),(.047,.05,1.845),(-.045,.01,1.79)],2)]
        for pts,tile in sails:
            b.patch(pts,"Head",tile,CLOTH)
            b.patch([(x,y+.003,z) for x,y,z in reversed(pts)],"Head",tile,CLOTH)
            b.tube(pts+[pts[0]],.0019,"Head",3,METAL,8)
        star(b,-.016,-.078,1.785,.018,"Head")
    elif h=="feathers":
        b.loft([(1.744,.091,.081,0,.008),(1.78,.091,.081,0,.008)],"Head",2,CLOTH,64)
        for j in range(7):
            feather(b,((j-3)*.025,.03,1.77),.19+.06*(1-abs(j-3)/3),(j-3)*.021)
        for s in (-1,1):
            pts=[(s*.108,-.003+.012*math.cos(a),1.638+.029*math.sin(a)) for a in np.linspace(0,math.tau,30)]
            b.tube(pts,.002,"Head",3,METAL,8)


def rig_mesh(obj,p):
    data=bpy.data.armatures.new(p["id"]+"_Rig")
    rig=bpy.data.objects.new(p["id"]+"_Rig",data)
    bpy.context.collection.objects.link(rig)
    bpy.context.view_layer.objects.active=rig
    rig.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    bones={}
    def bone(name,start,end,parent=None):
        eb=data.edit_bones.new(name)
        eb.head=start
        eb.tail=end
        if parent:
            eb.parent=bones[parent]
        bones[name]=eb
    bone("Root",(0,0,0),(0,0,.1))
    bone("Hips",(0,0,.9),(0,0,1.04),"Root")
    bone("Spine",(0,0,1.04),(0,0,1.25),"Hips")
    bone("Chest",(0,0,1.25),(0,0,1.45),"Spine")
    bone("Neck",(0,0,1.45),(0,0,1.56),"Chest")
    bone("Head",(0,0,1.56),(0,0,1.79),"Neck")
    for s,side in ((-1,"Right"),(1,"Left")):
        bone(side+"UpperArm",(s*.18*p["width"],0,1.43),(s*.275,0,1.13),"Chest")
        bone(side+"Forearm",(s*.275,0,1.13),(s*.311,-.015,.92),side+"UpperArm")
        bone(side+"Hand",(s*.311,-.015,.92),(s*.316,-.02,.83),side+"Forearm")
        bone(side+"UpperLeg",(s*.095,0,.94),(s*.095,0,.52),"Hips")
        bone(side+"LowerLeg",(s*.095,0,.52),(s*.095,0,.12),side+"UpperLeg")
        bone(side+"Foot",(s*.095,0,.12),(s*.095,-.15,.05),side+"LowerLeg")
        bone("Blink"+("L" if s>0 else "R"),(s*.037*p["width"],-.082,1.698),(s*.037*p["width"],-.082,1.718),"Head")
    bpy.ops.object.mode_set(mode="OBJECT")
    rig.show_in_front=True
    obj.parent=rig
    mod=obj.modifiers.new("Leader deformation","ARMATURE")
    mod.object=rig
    # One source take is split by the Unity importer into the two named clips.
    frames=[0,24,48,55,57,59,72,96,119,120,132,144,156,168,179]
    for frame in frames:
        t=min(frame,119)/119*math.tau
        for pb in rig.pose.bones:
            pb.rotation_mode="XYZ"
            pb.rotation_euler=(0,0,0)
            pb.location=(0,0,0)
            pb.scale=(1,1,1)
        rig.pose.bones["Chest"].scale=(1+.003*math.sin(t),1+.004*math.sin(t),1+.005*math.sin(t))
        rig.pose.bones["Head"].rotation_euler[1]=.022*math.sin(t)
        rig.pose.bones["Head"].rotation_euler[2]=.017*math.sin(t)
        if frame in (57,):
            rig.pose.bones["BlinkL"].scale.y=2.7
            rig.pose.bones["BlinkR"].scale.y=2.7
        if frame>=120:
            # Raise the right hand, briefly wave it and return to the idle pose.
            phases={120:0,132:.7,144:1,156:1,168:.65,179:0}
            strength=phases[frame]
            rig.pose.bones["RightUpperArm"].rotation_euler[2]=-.95*strength
            rig.pose.bones["RightForearm"].rotation_euler[0]=-.95*strength
            rig.pose.bones["RightHand"].rotation_euler[1]=(.18 if frame==144 else -.18 if frame==156 else 0)*strength
            rig.pose.bones["Head"].rotation_euler[0]=.05*strength
        for name in ("Chest","Head","BlinkL","BlinkR","RightUpperArm","RightForearm","RightHand"):
            pb=rig.pose.bones[name]
            pb.keyframe_insert("rotation_euler",frame=frame,group=name)
            pb.keyframe_insert("location",frame=frame,group=name)
            pb.keyframe_insert("scale",frame=frame,group=name)
    rig.animation_data.action.name="LeaderPerformance"
    rig.animation_data.action.use_fake_user=True
    scene=bpy.context.scene
    scene.render.fps=FPS
    scene.frame_start=0
    scene.frame_end=179
    for name,frame in (("Idle",0),("Greeting",120)):
        scene.timeline_markers.new(name,frame=frame)
    scene.frame_set(0)
    return rig


def lods(base,rig,p):
    result=[base]
    bpy.context.view_layer.objects.active=base
    base.select_set(True)
    tri=base.modifiers.new("Triangulated topology","TRIANGULATE")
    bpy.ops.object.modifier_apply(modifier=tri.name)
    n=len(base.data.polygons)
    # Bring the primary model close to the intended asset budget without subdivision inflation.
    if n>47000:
        dec=base.modifiers.new("Primary budget","DECIMATE")
        dec.ratio=45000/n
        bpy.ops.object.modifier_apply(modifier=dec.name)
    for level,target in ((1,15000),(2,5000)):
        obj=bpy.data.objects.new(p["id"]+"_LOD"+str(level),base.data.copy())
        bpy.context.collection.objects.link(obj)
        for vg in base.vertex_groups:
            obj.vertex_groups.new(name=vg.name)
        bpy.context.view_layer.objects.active=obj
        bpy.ops.object.select_all(action="DESELECT")
        obj.select_set(True)
        dec=obj.modifiers.new("LOD simplification","DECIMATE")
        dec.ratio=min(1,target/max(1,len(obj.data.polygons)))
        dec.use_collapse_triangulate=True
        bpy.ops.object.modifier_apply(modifier=dec.name)
        obj.parent=rig
        deform=obj.modifiers.new("Leader deformation","ARMATURE")
        deform.object=rig
        obj.hide_render=True
        result.append(obj)
    return result


def point_at(obj,position):
    direction=Vector(position)-obj.location
    obj.rotation_euler=direction.to_track_quat("-Z","Y").to_euler()


def stage(p):
    scene=bpy.context.scene
    scene.render.engine="CYCLES"
    scene.cycles.samples=32
    scene.cycles.use_denoising=True
    scene.render.image_settings.file_format="PNG"
    scene.render.film_transparent=False
    if scene.world is None:
        scene.world=bpy.data.worlds.new("Leader review world")
    scene.world.color=(.08,.08,.08)
    scene.view_settings.view_transform="AgX"
    try:
        scene.view_settings.look="AgX - Medium High Contrast"
    except TypeError:
        pass
    world=scene.world
    world.use_nodes=True
    world.node_tree.nodes["Background"].inputs[0].default_value=(.055,.08,.085,1)
    world.node_tree.nodes["Background"].inputs[1].default_value=.5
    for name,loc,energy,color,size in (("Key",(-3,-4,4),500,(1,.85,.69),3),
                                      ("Fill",(3,-2,2.5),350,(.67,.82,1),3),
                                      ("Rim",(1,2,3),650,(1,.75,.48),2)):
        ld=bpy.data.lights.new(name,"AREA")
        ld.energy=energy
        ld.color=color
        ld.shape="DISK"
        ld.size=size
        ob=bpy.data.objects.new(name,ld)
        bpy.context.collection.objects.link(ob)
        ob.location=loc
        point_at(ob,(0,0,1))
    camera=bpy.data.cameras.new("Character review camera")
    ob=bpy.data.objects.new("Character review camera",camera)
    bpy.context.collection.objects.link(ob)
    ob.location=(2.2,-5.3,2.3)
    point_at(ob,(0,0,1.01))
    camera.type="ORTHO"
    camera.ortho_scale=2.42
    scene.camera=ob
    bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,.005))
    ground=bpy.context.object
    ground.name="Review stage (not exported)"
    m=bpy.data.materials.new("Review stage")
    m.diffuse_color=(.035,.055,.06,1)
    ground.data.materials.append(m)
    return ob


def export(p,render):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    folder=ART/p["id"]
    ensure(folder)
    ensure(RES)
    ims=textures(p,folder/"Textures")
    mats=materials(p,ims,folder/"Materials")
    b=MeshBuilder()
    body(b,p)
    head(b,p)
    garments(b,p)
    hats(b,p)
    ob=b.finish(p["id"]+"_LOD0",mats)
    rig=rig_mesh(ob,p)
    objects=lods(ob,rig,p)
    for o in objects:
        o.hide_set(False)
    root=bpy.data.objects.new(p["id"],None)
    bpy.context.collection.objects.link(root)
    rig.parent=root
    bpy.ops.object.select_all(action="DESELECT")
    for o in [root,rig]+objects:
        o.select_set(True)
    fbx=folder/(p["id"]+".fbx")
    bpy.ops.export_scene.fbx(filepath=str(fbx),use_selection=True,object_types={"EMPTY","ARMATURE","MESH"},
                             apply_unit_scale=True,apply_scale_options="FBX_SCALE_UNITS",global_scale=1.0,
                             axis_forward="-Z",axis_up="Y",add_leaf_bones=False,use_armature_deform_only=True,
                             bake_anim=True,bake_anim_use_all_actions=False,bake_anim_use_nla_strips=False,
                             bake_anim_simplify_factor=0,path_mode="RELATIVE",use_mesh_modifiers=False)
    meta(fbx)
    # A model-prefab variant is usable on import; the Editor helper also rebuilds it
    # with explicit LOD and legacy-animation references after all assets import.
    prefab=RES/(p["id"]+".prefab")
    prefab.write_text("%YAML 1.1\n%TAG !u! tag:unity3d.com,2011:\n--- !u!1001 &100100000\nPrefabInstance:\n  m_ObjectHideFlags: 0\n  serializedVersion: 2\n  m_Modification:\n    serializedVersion: 3\n    m_TransformParent: {fileID: 0}\n    m_Modifications: []\n    m_RemovedComponents: []\n    m_RemovedGameObjects: []\n    m_AddedGameObjects: []\n    m_AddedComponents: []\n  m_SourcePrefab: {fileID: 100100000, guid: "+guid(fbx.relative_to(PROJECT))+", type: 3}\n",encoding="utf-8")
    meta(prefab,"PrefabImporter:\n  externalObjects: {}\n  userData: \n  assetBundleName: \n  assetBundleVariant: \n")
    for o in objects[1:]:
        o.hide_set(True)
    camera=stage(p)
    source=folder/(p["id"]+".blend")
    # Keep images external and alongside the editable source to avoid duplicate
    # packed 2K textures in thirteen files. Relative paths survive clean checkouts.
    for im in ims.values():
        im.filepath="//Textures/"+Path(im.filepath_raw).name
    bpy.ops.wm.save_as_mainfile(filepath=str(source),compress=True)
    meta(source)
    outputs={"id":p["id"],"name":p["name"],"state":p["state"],"referenceType":p["referenceType"],
             "sources":p["sources"],"resource": "Leaders/"+p["id"],
             "portraitResource":"Leaders/"+p["id"]+"_portrait",
             "source":str(source.relative_to(PROJECT)).replace("\\","/"),
             "fbx":str(fbx.relative_to(PROJECT)).replace("\\","/"),
             "materialSlots":len(mats),"textureSize":2048,
             "triangles":[len(o.data.polygons) for o in objects],
             "bones":len(rig.data.bones),"animations":[{"name":"Idle","firstFrame":0,"lastFrame":119,"loop":True},
                                                      {"name":"Greeting","firstFrame":120,"lastFrame":179,"loop":False}],
             "blink":"Weighted upper-eyelid bones BlinkL/BlinkR, frames 55–59 of Idle",
             "quality":"Procedurally authored semi-realistic interpretation; not a scanned historical likeness"}
    (folder/"manifest.json").write_text(json.dumps(outputs,indent=2,ensure_ascii=False)+"\n",encoding="utf-8")
    meta(folder/"manifest.json")
    if render:
        scene=bpy.context.scene
        scene.render.resolution_x=768
        scene.render.resolution_y=1024
        scene.render.resolution_percentage=100
        scene.render.filepath=str(folder/(p["id"]+"_fullbody.png"))
        bpy.ops.render.render(write_still=True)
        meta(Path(scene.render.filepath))
        camera.location=(.6,-3,1.9)
        point_at(camera,(0,-.015,1.60))
        camera.data.ortho_scale=.76
        scene.render.resolution_x=512
        scene.render.resolution_y=512
        scene.render.filepath=str(RES/(p["id"]+"_portrait.png"))
        bpy.ops.render.render(write_still=True)
        meta(Path(scene.render.filepath),"TextureImporter:\n  internalIDToNameTable: []\n  externalObjects: {}\n  serializedVersion: 13\n  mipmaps:\n    enableMipMap: 0\n    sRGBTexture: 1\n  isReadable: 0\n  maxTextureSize: 512\n  textureType: 0\n  textureShape: 1\n  alphaIsTransparency: 1\n  userData: \n  assetBundleName: \n  assetBundleVariant: \n")
    print("LEADER_BUILT "+json.dumps(outputs),flush=True)
    return outputs


def main():
    args=sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else []
    parser=argparse.ArgumentParser()
    parser.add_argument("--only",default="")
    parser.add_argument("--all",action="store_true")
    parser.add_argument("--no-render",action="store_true")
    a=parser.parse_args(args)
    profiles=json.loads((HERE/"profiles.json").read_text(encoding="utf-8"))["profiles"]
    selected=profiles if a.all else [p for p in profiles if p["id"] in a.only.split(",")]
    if not selected:
        parser.error("Pass --all or --only leader_id")
    for p in selected:
        export(p,not a.no_render)
    entries=[]
    for p in profiles:
        manifest=ART/p["id"]/"manifest.json"
        if manifest.exists():
            entries.append(json.loads(manifest.read_text(encoding="utf-8")))
    ensure(ART)
    out=ART/"leaders_manifest.json"
    out.write_text(json.dumps({"format":"tamadun-leader-art-v1","generator":"scripts/leaders/build_leaders.py",
                              "blender":bpy.app.version_string,"items":entries},indent=2,ensure_ascii=False)+"\n",encoding="utf-8")
    meta(out)


if __name__=="__main__":
    main()
