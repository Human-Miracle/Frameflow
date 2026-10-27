"""Renders one pre-rendered device view for Frameflow (pipeline v2) with Blender Cycles.

The device rests on a surface and the camera orbits it, so every view has
physically grounded contact and cast shadows. Geometry comes from
asset-pipeline/export-geometry.mjs, the same outlines the app uses.

Outputs, in <out_dir>:
  beauty.webp   device and shadow, transparent background (delivery)
  matte.png     antialiased coverage of the device alone, without its shadow, 8-bit grey;
                lets the app scale shadow strength without touching the device
  mask.png      antialiased coverage of the visible screen, 8-bit grey
  asset.json    projected screen corners, device bounds, view, render
                settings, provenance, file sizes and quality-gate results
and in <master_dir>: beauty.png, the lossless master (not committed).

Quality gate, every check must pass or the view is rejected (exit 1):
  homography   UV pass vs homography of the projected corners, 99.9th
               percentile error <= 0.5 screen px
  mask         rendered mask vs the analytically projected screen polygon minus
               the cutout; pixels that disagree (outside antialiased edges)
               <= 0.01 % of the screen area
  framing      beauty alpha at the image border <= 2 %: nothing clipped
  size         longest side >= 3000 px

Usage:
  python -I render_device.py <geometry.json> <out_dir> <master_dir> '<view json>'
view json: {"id","label","yaw","pitch","roll","fov","finish","lighting","longest","samples"}
  yaw   camera orbit towards the device's right side (degrees)
  pitch camera orbit towards the device's bottom edge (degrees)
  roll  camera roll (degrees)
"""

import json
import math
import os
import sys
import time

import bpy  # must load before bmesh and bpy_extras, which it registers
import bmesh
import numpy as np
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Matrix, Vector
from PIL import Image, ImageDraw

PIPELINE_VERSION = "2.1.0"
MAX_HOMOGRAPHY_ERROR_PX = 0.5
MAX_MASK_MISMATCH = 0.0001
MAX_BORDER_ALPHA = 0.02
MIN_LONGEST_SIDE = 3000

geometry_path, out_dir, master_dir, view_json = sys.argv[1:5]
view = json.loads(view_json)
with open(geometry_path) as fh:
    geo = json.load(fh)
hw = geo["hardware"]
if not hw:
    sys.exit("Device geometry has no hardware details; pipeline v2 needs them")
os.makedirs(out_dir, exist_ok=True)
os.makedirs(master_dir, exist_ok=True)
started = time.time()

W, H = geo["body"]["width"], geo["body"]["height"]
SCREEN_UNITS_MM = 65.1 / geo["screen"]["width"]
UNIT = SCREEN_UNITS_MM / 1000  # metres per device unit
T = hw["thickness"]
GLASS_Z = T + 1.0  # bottom of the cover glass slab
GLASS_TOP = T + 5.0
SCREEN_Z = T + 2.0  # display plane under the glass top
CUTOUT_Z = GLASS_TOP + 0.4


def P(px, py, z):
    """Device units (x right, y down from the top-left, z up from the back) to world metres."""
    return Vector(((px - W / 2) * UNIT, (H / 2 - py) * UNIT, z * UNIT))


# --- Scene ---------------------------------------------------------------------------
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = int(view.get("samples", 96))
scene.cycles.use_adaptive_sampling = True
scene.cycles.adaptive_threshold = 0.008
scene.cycles.use_denoising = True
scene.render.film_transparent = True
# AgX rolls off metal highlights; the screenshot is composited later and never tone mapped.
scene.view_settings.view_transform = "AgX"
scene.view_settings.look = "None"
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"
scene.render.image_settings.color_depth = "8"


def principled(name, **inputs):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    for key, value in inputs.items():
        bsdf.inputs[key].default_value = value
    return mat


finish = view.get("finish", "silver")
METAL_COLOUR = {"silver": (0.78, 0.79, 0.81, 1), "graphite": (0.10, 0.104, 0.112, 1)}[finish]
metal = principled("metal", **{"Base Color": METAL_COLOUR, "Metallic": 1.0, "Coat Weight": 0.15, "Coat Roughness": 0.04})
# Fine, low-contrast roughness variation so large rails do not look like perfect mirrors.
nodes, links = metal.node_tree.nodes, metal.node_tree.links
noise = nodes.new("ShaderNodeTexNoise")
noise.inputs["Scale"].default_value = 900.0
noise.inputs["Detail"].default_value = 6.0
ramp = nodes.new("ShaderNodeMapRange")
ramp.inputs["To Min"].default_value = 0.11
ramp.inputs["To Max"].default_value = 0.17
links.new(noise.outputs["Fac"], ramp.inputs["Value"])
links.new(ramp.outputs["Result"], nodes["Principled BSDF"].inputs["Roughness"])

glass = principled("glass", **{"Base Color": (0, 0, 0, 1), "Roughness": 0.015, "IOR": 1.52})
plastic = principled(
    "plastic",
    # Close to the metal's apparent value so the breaks read as detail, not as bright marks.
    **{"Base Color": (0.26, 0.27, 0.28, 1) if finish == "silver" else (0.035, 0.035, 0.04, 1), "Roughness": 0.45},
)
port_dark = principled("port", **{"Base Color": (0.01, 0.01, 0.012, 1), "Roughness": 0.7})
lens = principled("lens", **{"Base Color": (0.003, 0.004, 0.008, 1), "Roughness": 0.12, "Coat Weight": 0.6, "Coat Roughness": 0.08})


def link(obj):
    scene.collection.objects.link(obj)
    return obj


def prism(name, outline, z0, z1, mat):
    """Closed prism from a device-unit outline between heights z0 and z1."""
    bm = bmesh.new()
    bottom = [bm.verts.new(P(x, y, z0)) for x, y in outline]
    top = [bm.verts.new(P(x, y, z1)) for x, y in outline]
    bm.faces.new(top)
    bm.faces.new(list(reversed(bottom)))
    n = len(outline)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new([bottom[i], bottom[j], top[j], top[i]])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    obj = link(bpy.data.objects.new(name, mesh))
    obj.data.materials.append(mat)
    return obj


def flat(name, outline, z, mat, uv_rect=None):
    bm = bmesh.new()
    face = bm.faces.new([bm.verts.new(P(x, y, z)) for x, y in outline])
    if face.normal.z < 0:
        face.normal_flip()
    if uv_rect:
        sx, sy, sw, sh = uv_rect
        layer = bm.loops.layers.uv.new("UVMap")
        for loop in face.loops:
            px = loop.vert.co.x / UNIT + W / 2
            py = H / 2 - loop.vert.co.y / UNIT
            loop[layer].uv = ((px - sx) / sw, 1 - (py - sy) / sh)
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    obj = link(bpy.data.objects.new(name, mesh))
    obj.data.materials.append(mat)
    return obj


def smooth(obj, angle=35):
    bpy.context.view_layer.objects.active = obj
    for o in scene.objects:
        o.select_set(o is obj)
    bpy.ops.object.shade_smooth_by_angle(angle=math.radians(angle))


def box(name, centre, size, mat, bevel=0.0, segments=6):
    bpy.ops.mesh.primitive_cube_add(size=1, location=centre)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = size
    bpy.ops.object.transform_apply(scale=True)
    if bevel:
        mod = obj.modifiers.new("round", "BEVEL")
        mod.width = bevel
        mod.segments = segments
        mod.limit_method = "NONE"
    obj.data.materials.append(mat)
    return obj


# --- Device ---------------------------------------------------------------------------
body = prism("body", geo["bodyOutline"], 0, T, metal)
rail = body.modifiers.new("rounded edge", "BEVEL")
rail.width = hw["edgeRadius"] * UNIT
rail.segments = 14
rail.profile = 0.5
rail.limit_method = "ANGLE"
rail.angle_limit = math.radians(40)

# Port and speaker holes, cut with real geometry so they have depth and shading.
cutters = bpy.data.collections.new("cutters")
scene.collection.children.link(cutters)
bottom_y = H
port = hw["bottomPort"]


def cutter(obj):
    for c in obj.users_collection:
        c.objects.unlink(obj)
    cutters.objects.link(obj)
    obj.hide_render = True
    obj.display_type = "WIRE"


port_cutter = box("port", P(W / 2, bottom_y, T / 2), (port["width"] * UNIT, 120 * UNIT, port["height"] * UNIT), port_dark, bevel=port["height"] * 0.49 * UNIT, segments=8)
cutter(port_cutter)
holes = hw["speakerHoles"]
for side in (-1, 1):
    for i in range(holes["count"]):
        x = W / 2 + side * (port["width"] / 2 + holes["gapFromPort"] + i * holes["spacing"])
        bpy.ops.mesh.primitive_cylinder_add(radius=holes["diameter"] / 2 * UNIT, depth=80 * UNIT, location=P(x, bottom_y, T / 2), rotation=(math.pi / 2, 0, 0), vertices=24)
        cutter(bpy.context.active_object)
cut = body.modifiers.new("ports", "BOOLEAN")
cut.operation = "DIFFERENCE"
cut.operand_type = "COLLECTION"
cut.collection = cutters
cut.solver = "EXACT"
smooth(body)

# Antenna breaks across the flat part of the band, flush with the metal: a 0.3-unit lip
# (sub-pixel at 3200 px) so they read on the side without notching the rail seen from the front.
band = T - 2 * hw["edgeRadius"]
LIP = 0.3
for i, line in enumerate(hw["antennaLines"]):
    e, o, w = line["edge"], line["offset"], line["width"]
    if e in ("left", "right"):
        x = -LIP / 2 + 0.5 if e == "left" else W + LIP / 2 - 0.5
        obj = box(f"antenna{i}", P(x, o, T / 2), ((1 + LIP) * UNIT, w * UNIT, band * UNIT), plastic)
    else:
        y = -LIP / 2 + 0.5 if e == "top" else H + LIP / 2 - 0.5
        obj = box(f"antenna{i}", P(o, y, T / 2), (w * UNIT, (1 + LIP) * UNIT, band * UNIT), plastic)

# Buttons: rounded pills on the flat band.
for i, b in enumerate(geo["buttons"]):
    x = -b["depth"] / 2 if b["side"] == "left" else W + b["depth"] / 2
    obj = box(
        f"button{i}",
        P(x, b["y"] + b["length"] / 2, T / 2),
        ((b["depth"] * 2) * UNIT, b["length"] * UNIT, band * 0.62 * UNIT),
        metal,
        bevel=b["depth"] * 0.9 * UNIT,
        segments=8,
    )
    smooth(obj, 60)

# Cover glass: a thin slab with a softly rounded edge that catches a highlight line.
glass_outline = geo["glassOutline"]
cover = prism("cover glass", glass_outline, GLASS_Z, GLASS_TOP, glass)
lip = cover.modifiers.new("edge", "BEVEL")
lip.width = 2.2 * UNIT
lip.segments = 6
lip.limit_method = "ANGLE"
smooth(cover)

s = geo["screen"]
screen = flat("screen", geo["screenOutline"], SCREEN_Z, glass, uv_rect=(s["x"], s["y"], s["width"], s["height"]))

# Cutout and front lens sit just above the glass so they read as hardware.
cutout = geo["cutouts"][0]
pill = prism("cutout", cutout["outline"], GLASS_TOP + 0.05, CUTOUT_Z, principled("cutout", **{"Base Color": (0, 0, 0, 1), "Roughness": 0.08}))
lens_d = hw["frontLens"]["diameter"]
lx = s["x"] + cutout["x"] + cutout["width"] - cutout["height"] / 2
ly = s["y"] + cutout["y"] + cutout["height"] / 2
bpy.ops.mesh.primitive_cylinder_add(radius=lens_d / 2 * UNIT, depth=0.6 * UNIT, location=P(lx, ly, CUTOUT_Z + 0.2), vertices=48)
lens_obj = bpy.context.active_object
lens_obj.data.materials.append(lens)

# --- Surface: shadows only ---------------------------------------------------------------
bpy.ops.mesh.primitive_plane_add(size=6, location=(0, 0, 0))
floor = bpy.context.active_object
floor.is_shadow_catcher = True
floor.visible_glossy = False
floor.visible_diffuse = False
floor.visible_transmission = False

# --- Lighting: restrained studio --------------------------------------------------------
world = bpy.data.worlds.new("world")
world.use_nodes = True
scene.world = world
bg = world.node_tree.nodes["Background"]


# Highlight strips light only the metal parts (light linking): they draw lines along the
# rails but never reflect in the cover glass, where they would read as glare over the UI.
metal_parts = bpy.data.collections.new("metal parts")
for obj in scene.objects:
    if obj.type == "MESH" and (obj is body or obj.name.startswith(("button", "antenna"))):
        metal_parts.objects.link(obj)


def area(name, size, energy, location, glossy=True, shadows=False, color=(1, 1, 1), metal_only=False):
    data = bpy.data.lights.new(name, "AREA")
    data.shape = "RECTANGLE"
    data.size, data.size_y = size
    data.energy = energy
    data.color = color
    data.use_shadow = shadows
    obj = link(bpy.data.objects.new(name, data))
    obj.location = location
    obj.rotation_euler = (-Vector(location)).normalized().to_track_quat("-Z", "Y").to_euler()
    obj.visible_glossy = glossy
    if metal_only:
        obj.light_linking.receiver_collection = metal_parts


if view.get("lighting", "studio") == "studio":
    bg.inputs["Color"].default_value = (0.78, 0.78, 0.79, 1)
    bg.inputs["Strength"].default_value = 0.32
    # Large soft key from the upper left casts the only shadow; hidden from reflections.
    area("key", (0.9, 0.7), 34, (-0.42, 0.42, 0.75), glossy=False, shadows=True)
    # Long narrow strips draw controlled highlight lines along the rails and glass edge.
    area("strip left", (0.025, 0.8), 14, (-0.46, 0.05, 0.16), metal_only=True)
    area("strip right", (0.025, 0.8), 10, (0.46, 0.1, 0.2), metal_only=True)
    area("strip top", (0.7, 0.025), 7, (0.0, 0.5, 0.22), metal_only=True)
else:
    bg.inputs["Color"].default_value = (0.02, 0.02, 0.024, 1)
    bg.inputs["Strength"].default_value = 1.0
    area("key", (0.8, 0.6), 16, (-0.42, 0.42, 0.75), glossy=False, shadows=True)
    area("strip left", (0.03, 0.8), 26, (-0.46, 0.05, 0.16), metal_only=True)
    area("strip right", (0.025, 0.8), 22, (0.46, 0.1, 0.18), color=(0.88, 0.92, 1.0), metal_only=True)
    area("strip top", (0.7, 0.025), 8, (0.0, 0.5, 0.22), metal_only=True)

# --- Camera orbiting the resting device ------------------------------------------------
fov = math.radians(view.get("fov", 18))
cam_data = bpy.data.cameras.new("camera")
camera = link(bpy.data.objects.new("camera", cam_data))
scene.camera = camera
target = P(W / 2, H / 2, T / 2)
distance = (H * UNIT / 2) / math.tan(fov / 2) / 0.8
orbit = Matrix.Rotation(math.radians(view.get("pitch", 0)), 4, "X") @ Matrix.Rotation(math.radians(view.get("yaw", 0)), 4, "Y")
camera.matrix_world = Matrix.Translation(target) @ orbit @ Matrix.Translation((0, 0, distance)) @ Matrix.Rotation(math.radians(view.get("roll", 0)), 4, "Z")
cam_data.clip_start = distance * 0.1
cam_data.clip_end = distance * 10
cam_data.sensor_fit = "AUTO"
cam_data.angle = fov
scene.render.resolution_x = scene.render.resolution_y = 1000
bpy.context.view_layer.update()

# Frame the device plus room for its shadow, then size so the longest side is `longest`.
body_points = [P(x, y, z) for x, y in geo["bodyOutline"] for z in (0, T)]
proj = [world_to_camera_view(scene, camera, p) for p in body_points]
x0, x1 = min(p.x for p in proj), max(p.x for p in proj)
y0, y1 = min(p.y for p in proj), max(p.y for p in proj)
margin = view.get("margin", 0.22)
w, h = (x1 - x0) * (1 + 2 * margin), (y1 - y0) * (1 + 2 * margin)
largest = max(w, h)
longest = int(view.get("longest", 3200))
scene.render.resolution_x = round(longest * w / largest)
scene.render.resolution_y = round(longest * h / largest)
cam_data.angle = 2 * math.atan(math.tan(fov / 2) * largest)
cam_data.shift_x = ((x0 + x1) / 2 - 0.5) / largest
cam_data.shift_y = ((y0 + y1) / 2 - 0.5) / largest
bpy.context.view_layer.update()
RX, RY = scene.render.resolution_x, scene.render.resolution_y


def to_px(p):
    c = world_to_camera_view(scene, camera, p)
    return [c.x * RX, (1 - c.y) * RY]


def render(path):
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


# --- Pass 1: beauty ----------------------------------------------------------------------
render_started = time.time()
master_png = os.path.join(master_dir, "beauty.png")
render(master_png)
beauty_seconds = time.time() - render_started

# --- Pass 1b: device matte (device coverage only, no floor, so no shadow) -------------------
floor.hide_render = True
scene.cycles.samples = 64
scene.cycles.use_adaptive_sampling = False
scene.cycles.use_denoising = False
matte_rgba = os.path.join(master_dir, "matte-rgba.png")
render(matte_rgba)
floor.hide_render = False

# --- Pass 2: screen coverage mask (glass hidden, everything else held out) ----------------
white = bpy.data.materials.new("mask white")
white.use_nodes = True
wn, wl = white.node_tree.nodes, white.node_tree.links
wn.remove(wn["Principled BSDF"])
emit = wn.new("ShaderNodeEmission")
emit.inputs["Color"].default_value = (1, 1, 1, 1)
wl.new(emit.outputs["Emission"], wn["Material Output"].inputs["Surface"])
screen.data.materials[0] = white
for obj in scene.objects:
    if obj.type == "MESH" and obj not in (screen, floor, cover):
        obj.is_holdout = True
cover.hide_render = True
floor.hide_render = True
scene.cycles.samples = 64
scene.cycles.use_adaptive_sampling = False
scene.cycles.use_denoising = False
mask_rgba = os.path.join(master_dir, "mask-rgba.png")
render(mask_rgba)

# --- Pass 3: UV verification (float, raw) --------------------------------------------------
uv_mat = bpy.data.materials.new("uv")
uv_mat.use_nodes = True
un, ul = uv_mat.node_tree.nodes, uv_mat.node_tree.links
un.remove(un["Principled BSDF"])
coords = un.new("ShaderNodeTexCoord")
emit = un.new("ShaderNodeEmission")
ul.new(coords.outputs["UV"], emit.inputs["Color"])
ul.new(emit.outputs["Emission"], un["Material Output"].inputs["Surface"])
screen.data.materials[0] = uv_mat
scene.view_settings.view_transform = "Raw"
scene.cycles.samples = 1
scene.cycles.pixel_filter_type = "BOX"
scene.cycles.filter_width = 0.01
scene.render.image_settings.file_format = "OPEN_EXR"
scene.render.image_settings.color_depth = "32"
uv_path = os.path.join(master_dir, "uv-check.exr")
render(uv_path)

# --- Measurements ----------------------------------------------------------------------------
corners = [to_px(P(x, y, SCREEN_Z)) for x, y in ((s["x"], s["y"]), (s["x"] + s["width"], s["y"]), (s["x"] + s["width"], s["y"] + s["height"]), (s["x"], s["y"] + s["height"]))]
outline_px = [to_px(p) for p in body_points]
bounds = {
    "x": min(p[0] for p in outline_px),
    "y": min(p[1] for p in outline_px),
    "width": max(p[0] for p in outline_px) - min(p[0] for p in outline_px),
    "height": max(p[1] for p in outline_px) - min(p[1] for p in outline_px),
}


def homography(src, dst):
    rows, rhs = [], []
    for (x, y), (u, v) in zip(src, dst):
        rows += [[x, y, 1, 0, 0, 0, -u * x, -u * y], [0, 0, 0, x, y, 1, -v * x, -v * y]]
        rhs += [u, v]
    return np.append(np.linalg.solve(np.array(rows), np.array(rhs)), 1).reshape(3, 3)


def pixels(path):
    img = bpy.data.images.load(path)
    data = np.array(img.pixels[:], dtype=np.float32).reshape(img.size[1], img.size[0], 4)[::-1]
    bpy.data.images.remove(img)
    return data


mask = pixels(mask_rgba)[:, :, 3]
matte = pixels(matte_rgba)[:, :, 3]
uv = pixels(uv_path)

# Gate 1: homography exactness.
to_uv = homography(corners, [(0, 1), (1, 1), (1, 0), (0, 0)])
ys, xs = np.nonzero((mask > 0.999) & (uv[:, :, 3] > 0.999))
pick = np.random.default_rng(1).choice(len(xs), size=min(20000, len(xs)), replace=False)
pts = np.stack([xs[pick] + 0.5, ys[pick] + 0.5, np.ones(len(pick))])
pred = to_uv @ pts
pred = pred[:2] / pred[2]
err = np.abs(pred - uv[ys[pick], xs[pick], :2].T) * np.array([[s["nativeWidth"]], [s["nativeHeight"]]])
homography_gate = {
    "samples": int(len(pick)),
    "meanErrorScreenPx": round(float(err.mean()), 4),
    "p999ErrorScreenPx": round(float(np.percentile(err, 99.9)), 4),
    "tolerance": MAX_HOMOGRAPHY_ERROR_PX,
}
homography_gate["passed"] = homography_gate["p999ErrorScreenPx"] <= MAX_HOMOGRAPHY_ERROR_PX

# Gate 2: mask vs analytic geometry (screen polygon minus the cutout), 4x supersampled.
SS = 4
analytic = Image.new("L", (RX * SS, RY * SS), 0)
draw = ImageDraw.Draw(analytic)
draw.polygon([tuple(c * SS for c in to_px(P(x, y, SCREEN_Z))) for x, y in geo["screenOutline"]], fill=255)
draw.polygon([tuple(c * SS for c in to_px(P(x, y, CUTOUT_Z))) for x, y in cutout["outline"]], fill=0)
draw.ellipse(
    [tuple(c * SS for c in to_px(P(lx - lens_d / 2, ly - lens_d / 2, CUTOUT_Z))), tuple(c * SS for c in to_px(P(lx + lens_d / 2, ly + lens_d / 2, CUTOUT_Z)))],
    fill=0,
)
expected = np.asarray(analytic.resize((RX, RY), Image.BOX), dtype=np.float32) / 255
solid = (expected < 0.02) | (expected > 0.98)
disagree = solid & (np.abs(expected - mask) > 0.5)
screen_area = float((expected > 0.5).sum())
mask_gate = {
    "screenAreaPx": int(screen_area),
    "disagreeingPx": int(disagree.sum()),
    "disagreeingFraction": round(float(disagree.sum()) / screen_area, 7),
    "meanAbsDifference": round(float(np.abs(expected - mask).mean()), 6),
    "tolerance": MAX_MASK_MISMATCH,
}
mask_gate["passed"] = mask_gate["disagreeingFraction"] <= MAX_MASK_MISMATCH

# Gate 3: framing. The soft key light leaves a faint shadow tail; it is faded out over the
# outer FEATHER of the frame so no rectangular edge shows when composited. The device itself
# must lie entirely inside the unfeathered area, and nothing may remain at the border.
FEATHER = 0.08


def border_max(alpha):
    edges = [alpha[:2].ravel(), alpha[-2:].ravel(), alpha[:, :2].ravel(), alpha[:, -2:].ravel()]
    return float(np.concatenate(edges).max())


rgba = np.asarray(Image.open(master_png).convert("RGBA"), dtype=np.float32)
raw_border = border_max(rgba[:, :, 3] / 255)


def ramp(n):
    t = np.clip(np.minimum(np.arange(n) + 0.5, n - np.arange(n) - 0.5) / (FEATHER * n), 0, 1)
    return 0.5 - 0.5 * np.cos(np.pi * t)


rgba[:, :, 3] *= ramp(RY)[:, None] * ramp(RX)[None, :]
Image.fromarray(np.round(rgba).astype(np.uint8), "RGBA").save(master_png)
device_inside = (
    bounds["x"] >= FEATHER * RX
    and bounds["y"] >= FEATHER * RY
    and bounds["x"] + bounds["width"] <= (1 - FEATHER) * RX
    and bounds["y"] + bounds["height"] <= (1 - FEATHER) * RY
)
framing_gate = {
    "rawMaxBorderAlpha": round(raw_border, 4),
    "maxBorderAlpha": round(border_max(rgba[:, :, 3] / 255), 4),
    "feather": FEATHER,
    "deviceInsideUnfeatheredArea": device_inside,
    "tolerance": MAX_BORDER_ALPHA,
}
framing_gate["passed"] = device_inside and framing_gate["maxBorderAlpha"] <= MAX_BORDER_ALPHA

size_gate = {"longestSidePx": max(RX, RY), "minimum": MIN_LONGEST_SIDE, "passed": max(RX, RY) >= MIN_LONGEST_SIDE}

# Gate 5: the device matte must sit inside the beauty alpha (beyond edge noise), or scaling the
# shadow would change the device.
beauty_alpha_final = rgba[:, :, 3] / 255
device_px = float((matte > 0.98).sum())
matte_excess = float((matte > beauty_alpha_final + 0.1).sum())
matte_gate = {"devicePx": int(device_px), "excessPx": int(matte_excess), "fraction": round(matte_excess / device_px, 6), "tolerance": 0.001}
matte_gate["passed"] = matte_gate["fraction"] <= matte_gate["tolerance"]

# --- Delivery files ----------------------------------------------------------------------------
beauty_webp = os.path.join(out_dir, "beauty.webp")
Image.open(master_png).save(beauty_webp, "WEBP", quality=92, alpha_quality=100, method=6, exact=True)
mask_png = os.path.join(out_dir, "mask.png")
Image.fromarray(np.round(mask * 255).astype(np.uint8), "L").save(mask_png, optimize=True)
matte_png = os.path.join(out_dir, "matte.png")
Image.fromarray(np.round(matte * 255).astype(np.uint8), "L").save(matte_png, optimize=True)
os.remove(mask_rgba)
os.remove(matte_rgba)
os.remove(uv_path)

gates = {"homography": homography_gate, "mask": mask_gate, "framing": framing_gate, "size": size_gate, "matte": matte_gate}
asset = {
    "formatVersion": 2,
    "pipelineVersion": PIPELINE_VERSION,
    "deviceAssetId": geo["id"],
    "deviceAssetVersion": geo["version"],
    "view": view,
    "image": {
        "width": RX,
        "height": RY,
        "beauty": "beauty.webp",
        "mask": "mask.png",
        "matte": "matte.png",
        "beautyBytes": os.path.getsize(beauty_webp),
        "maskBytes": os.path.getsize(mask_png),
        "matteBytes": os.path.getsize(matte_png),
        "masterPngBytes": os.path.getsize(master_png),
    },
    "screenPlane": {"corners": corners, "native": {"width": s["nativeWidth"], "height": s["nativeHeight"]}},
    "screenCorners": corners,
    "deviceBounds": bounds,
    "gates": gates,
    "verification": {"passed": all(g["passed"] for g in gates.values()), "p999ErrorScreenPx": homography_gate["p999ErrorScreenPx"]},
    "render": {
        "engine": "Blender Cycles (CPU)",
        "blender": bpy.app.version_string,
        "maxSamples": int(view.get("samples", 96)),
        "denoiser": "OpenImageDenoise",
        "viewTransform": "AgX",
        "beautySeconds": round(beauty_seconds, 1),
        "totalSeconds": round(time.time() - started, 1),
    },
    "provenance": {
        "geometry": "src/devices/frameflow-phone-v2.ts via asset-pipeline/export-geometry.mjs (original)",
        "materials": "Procedural Blender shaders defined in asset-pipeline/blender/render_device.py (original)",
        "lighting": "Procedural area lights and uniform world colour (original); no HDR images",
        "textures": "None",
        "thirdPartyAssets": [],
    },
    "license": {
        "kind": "original",
        "holder": geo["license"]["holder"],
        "terms": "Rendered by the Frameflow asset pipeline from original geometry; no third-party models, textures or HDR images.",
    },
}
with open(os.path.join(out_dir, "asset.json"), "w") as fh:
    json.dump(asset, fh, indent=2)
print(json.dumps({"id": view["id"], "size": [RX, RY], "gates": {k: v["passed"] for k, v in gates.items()}, "seconds": asset["render"]["totalSeconds"]}))
if not asset["verification"]["passed"]:
    sys.exit(f"View {view['id']} rejected: " + json.dumps(gates))
