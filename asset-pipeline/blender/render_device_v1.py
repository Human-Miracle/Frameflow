"""Renders a pre-rendered device asset for Frameflow with Blender Cycles.

Builds the device from geometry exported by asset-pipeline/export-geometry.mjs
(the same outlines the app uses), renders it from one fixed view, and writes:

  beauty.png  device and its shadow on a transparent background; the screen is
              black cover glass, so any reflections on it form an optional glare layer
  mask.png    antialiased coverage of the visible screen (8-bit grey)
  asset.json  projected screen corners (sub-pixel), device bounds, view, render
              settings, licence, and the measured homography error

The screen is planar, so its projection is an exact homography of its corners.
That is verified, not assumed: a UV pass is rendered and compared with the
homography at sampled pixels, and the asset is rejected above a tolerance.

Usage:
  python -I render_device.py <geometry.json> <out_dir> '<view json>'
view json: {"id","style":"minimal"|"cinematic","finish":"silver"|"graphite",
            "yaw","pitch","roll","fov","size","samples"}
"""

import json
import math
import os
import sys

import bpy  # must load before bmesh and bpy_extras, which it registers
import bmesh
import numpy as np
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Matrix, Vector

MAX_HOMOGRAPHY_ERROR_PX = 0.5

geometry_path, out_dir, view_json = sys.argv[1], sys.argv[2], sys.argv[3]
view = json.loads(view_json)
with open(geometry_path) as fh:
    geo = json.load(fh)
os.makedirs(out_dir, exist_ok=True)

W, H = geo["body"]["width"], geo["body"]["height"]
UNIT = 70.6e-3 / W  # metres per device unit, sized like a 6.1-inch phone
THICK = 150 * UNIT
SIZE = int(view.get("size", 1600))


def to_world(px, py, z=0.0):
    return Vector(((px - W / 2) * UNIT, (H / 2 - py) * UNIT, z))


# --- Scene --------------------------------------------------------------------------
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = int(view.get("samples", 96))
scene.cycles.use_denoising = True
scene.render.resolution_x = SIZE
scene.render.resolution_y = SIZE
scene.render.film_transparent = True
# AgX rolls off highlights on polished metal; the screen is composited later, so UI colours are unaffected.
scene.view_settings.view_transform = "AgX"
scene.view_settings.look = "None"
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"
scene.render.image_settings.color_depth = "8"


def material(name, **inputs):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    for key, value in inputs.items():
        bsdf.inputs[key].default_value = value
    return mat


finish = view.get("finish", "silver")
metal = material(
    "metal",
    **{
        "Base Color": (0.80, 0.81, 0.83, 1) if finish == "silver" else (0.11, 0.115, 0.125, 1),
        "Metallic": 1.0,
        "Roughness": 0.13 if finish == "silver" else 0.17,
        "Coat Weight": 0.25,
        "Coat Roughness": 0.05,
    },
)
glass = material(
    "glass",
    **{
        "Base Color": (0, 0, 0, 1),  # cover glass shows only reflections
        "Roughness": 0.02,
        "Coat Weight": 0.0,
    },
)


def polygon_object(name, points, z, mat, extrude=0.0, uv_rect=None):
    bm = bmesh.new()
    verts = [bm.verts.new(to_world(x, y, z)) for x, y in points]
    face = bm.faces.new(verts)
    if face.normal.z < 0:
        face.normal_flip()
    if extrude:
        result = bmesh.ops.extrude_face_region(bm, geom=[face])
        moved = [e for e in result["geom"] if isinstance(e, bmesh.types.BMVert)]
        bmesh.ops.translate(bm, verts=moved, vec=(0, 0, -extrude))
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    if uv_rect:
        sx, sy, sw, sh = uv_rect
        uv_layer = bm.loops.layers.uv.new("UVMap")
        for f in bm.faces:
            for loop in f.loops:
                px = loop.vert.co.x / UNIT + W / 2
                py = H / 2 - loop.vert.co.y / UNIT
                loop[uv_layer].uv = ((px - sx) / sw, 1 - (py - sy) / sh)
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    obj.data.materials.append(mat)
    scene.collection.objects.link(obj)
    return obj


device = bpy.data.objects.new("device", None)
scene.collection.objects.link(device)

body = polygon_object("body", geo["bodyOutline"], THICK / 2, metal, extrude=THICK)
bevel = body.modifiers.new("rails", "BEVEL")
bevel.width = geo["frameWidth"] * 0.5 * UNIT
bevel.segments = 12
bevel.limit_method = "ANGLE"
bevel.angle_limit = math.radians(40)
bpy.context.view_layer.objects.active = body
body.select_set(True)
bpy.ops.object.shade_smooth_by_angle(angle=math.radians(35))
body.parent = device

front = polygon_object("glass", geo["glassOutline"], THICK / 2 + 0.3 * UNIT, glass)
front.parent = device
s = geo["screen"]
screen = polygon_object(
    "screen", geo["screenOutline"], THICK / 2 + 0.6 * UNIT, glass, uv_rect=(s["x"], s["y"], s["width"], s["height"])
)
screen.parent = device

for i, button in enumerate(geo["buttons"]):
    x = -W / 2 * UNIT if button["side"] == "left" else W / 2 * UNIT
    bpy.ops.mesh.primitive_cube_add(size=1)
    cube = bpy.context.active_object
    cube.name = f"button{i}"
    cube.scale = (button["depth"] * 2 * UNIT, button["length"] * UNIT, THICK * 0.42)
    cube.location = (x, (H / 2 - button["y"] - button["length"] / 2) * UNIT, 0)
    mod = cube.modifiers.new("round", "BEVEL")
    mod.width = button["depth"] * 0.45 * UNIT
    mod.segments = 6
    cube.data.materials.append(metal)
    cube.parent = device

# Orientation: same convention as the WebGL spike (three.js Euler order YXZ).
yaw, pitch, roll = (math.radians(view.get(k, 0)) for k in ("yaw", "pitch", "roll"))
device.matrix_world = (
    Matrix.Rotation(yaw, 4, "Y") @ Matrix.Rotation(pitch, 4, "X") @ Matrix.Rotation(-roll, 4, "Z")
)
bpy.context.view_layer.update()

# --- Camera --------------------------------------------------------------------------
fov = math.radians(view.get("fov", 18))
cam_data = bpy.data.cameras.new("camera")
cam_data.sensor_fit = "VERTICAL"
cam_data.angle = fov
camera = bpy.data.objects.new("camera", cam_data)
scene.collection.objects.link(camera)
scene.camera = camera
distance = (H * UNIT / 2) / math.tan(fov / 2) / 0.8
camera.location = (0, 0, distance)
cam_data.clip_start = distance * 0.2
cam_data.clip_end = distance * 4

# --- Shadow catcher just below the lowest point of the device ----------------------------
lowest = min((device.matrix_world @ to_world(x, y, z)).z for x, y in geo["bodyOutline"] for z in (-THICK / 2, THICK / 2))
bpy.ops.mesh.primitive_plane_add(size=4, location=(0, 0, lowest - 0.004))
floor = bpy.context.active_object
floor.is_shadow_catcher = True
# The catcher only collects shadows: if reflections could see it, every rail and the glass would
# mirror a brightly lit white floor.
floor.visible_glossy = False
floor.visible_diffuse = False
floor.visible_transmission = False

# --- Lighting --------------------------------------------------------------------------
world = bpy.data.worlds.new("world")
world.use_nodes = True
background = world.node_tree.nodes["Background"]
scene.world = world


def area_light(name, size_x, size_y, energy, location, color=(1, 1, 1), glossy=True, shadows=False):
    data = bpy.data.lights.new(name, "AREA")
    data.use_shadow = shadows
    data.shape = "RECTANGLE"
    data.size, data.size_y = size_x, size_y
    data.energy = energy
    data.color = color
    obj = bpy.data.objects.new(name, data)
    obj.location = location
    direction = -Vector(location).normalized()
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    obj.visible_glossy = glossy
    scene.collection.objects.link(obj)


if view["style"] == "minimal":
    background.inputs["Color"].default_value = (0.8, 0.8, 0.8, 1)
    background.inputs["Strength"].default_value = 0.35
    # Large frontal softbox lights the device evenly; it is hidden from reflections so the glass stays dark.
    area_light("key", 0.6, 0.45, 25, (-0.12, 0.22, 0.6), glossy=False, shadows=True)
    # Narrow strips draw the bright highlight lines along the rails.
    area_light("strip_left", 0.025, 0.6, 18, (-0.34, 0.02, 0.12))
    area_light("strip_right", 0.025, 0.6, 14, (0.34, 0.06, 0.14))
else:
    background.inputs["Color"].default_value = (0.02, 0.02, 0.025, 1)
    background.inputs["Strength"].default_value = 1.0
    area_light("key", 0.5, 0.35, 10, (-0.15, 0.24, 0.6), glossy=False, shadows=True)
    area_light("strip_left", 0.03, 0.6, 30, (-0.32, 0.04, 0.12))
    area_light("rim_right", 0.025, 0.6, 26, (0.32, 0.12, 0.0), color=(0.85, 0.9, 1.0))
    area_light("top_bar", 0.35, 0.025, 10, (0.0, 0.34, 0.16))


def render(path):
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


# --- Pass 1: beauty -------------------------------------------------------------------
render(os.path.join(out_dir, "beauty.png"))

# --- Pass 2: screen coverage mask --------------------------------------------------------
white = bpy.data.materials.new("mask")
white.use_nodes = True
nodes, links = white.node_tree.nodes, white.node_tree.links
nodes.remove(nodes["Principled BSDF"])
emit = nodes.new("ShaderNodeEmission")
emit.inputs["Color"].default_value = (1, 1, 1, 1)
links.new(emit.outputs["Emission"], nodes["Material Output"].inputs["Surface"])
screen.data.materials[0] = white
for obj in scene.objects:
    if obj.type == "MESH" and obj is not screen and obj is not floor:
        obj.is_holdout = True
floor.hide_render = True
scene.cycles.samples = 32
scene.cycles.use_denoising = False
render(os.path.join(out_dir, "mask-rgba.png"))

# --- Pass 3: UV verification (float, raw) ------------------------------------------------
uv_mat = bpy.data.materials.new("uv")
uv_mat.use_nodes = True
nodes, links = uv_mat.node_tree.nodes, uv_mat.node_tree.links
nodes.remove(nodes["Principled BSDF"])
coords = nodes.new("ShaderNodeTexCoord")
emit = nodes.new("ShaderNodeEmission")
links.new(coords.outputs["UV"], emit.inputs["Color"])
links.new(emit.outputs["Emission"], nodes["Material Output"].inputs["Surface"])
screen.data.materials[0] = uv_mat
scene.view_settings.view_transform = "Raw"
scene.cycles.samples = 1
scene.cycles.pixel_filter_type = "BOX"
scene.cycles.filter_width = 0.01
scene.render.image_settings.file_format = "OPEN_EXR"
scene.render.image_settings.color_depth = "32"
uv_path = os.path.join(out_dir, "uv-check.exr")
render(uv_path)

# --- Corners, bounds and verification -------------------------------------------------------


def to_pixels(point):
    p = world_to_camera_view(scene, camera, device.matrix_world @ point)
    return [p.x * SIZE, (1 - p.y) * SIZE]


corners = [
    to_pixels(to_world(s["x"], s["y"], THICK / 2 + 0.6 * UNIT)),
    to_pixels(to_world(s["x"] + s["width"], s["y"], THICK / 2 + 0.6 * UNIT)),
    to_pixels(to_world(s["x"] + s["width"], s["y"] + s["height"], THICK / 2 + 0.6 * UNIT)),
    to_pixels(to_world(s["x"], s["y"] + s["height"], THICK / 2 + 0.6 * UNIT)),
]
outline_px = [to_pixels(to_world(x, y, z)) for x, y in geo["bodyOutline"] for z in (-THICK / 2, THICK / 2)]
bounds = {
    "x": min(p[0] for p in outline_px),
    "y": min(p[1] for p in outline_px),
    "width": max(p[0] for p in outline_px) - min(p[0] for p in outline_px),
    "height": max(p[1] for p in outline_px) - min(p[1] for p in outline_px),
}


def homography(src, dst):
    rows, rhs = [], []
    for (x, y), (u, v) in zip(src, dst):
        rows.append([x, y, 1, 0, 0, 0, -u * x, -u * y])
        rhs.append(u)
        rows.append([0, 0, 0, x, y, 1, -v * x, -v * y])
        rhs.append(v)
    h = np.linalg.solve(np.array(rows), np.array(rhs))
    return np.append(h, 1).reshape(3, 3)


# Maps output pixel -> screen UV (u right, v up, as rendered).
to_uv = homography(corners, [(0, 1), (1, 1), (1, 0), (0, 0)])
uv_image = bpy.data.images.load(uv_path)
uv = np.array(uv_image.pixels[:], dtype=np.float32).reshape(SIZE, SIZE, 4)[::-1]  # top row first
mask_image = bpy.data.images.load(os.path.join(out_dir, "mask-rgba.png"))
mask = np.array(mask_image.pixels[:], dtype=np.float32).reshape(SIZE, SIZE, 4)[::-1][:, :, 3]

ys, xs = np.nonzero((mask > 0.999) & (uv[:, :, 3] > 0.999))
rng = np.random.default_rng(1)
pick = rng.choice(len(xs), size=min(20000, len(xs)), replace=False)
px = np.stack([xs[pick] + 0.5, ys[pick] + 0.5, np.ones(len(pick))])
predicted = to_uv @ px
predicted = predicted[:2] / predicted[2]
rendered = uv[ys[pick], xs[pick], :2].T
error = np.abs(predicted - rendered) * np.array([[s["nativeWidth"]], [s["nativeHeight"]]])
mean_error, max_error = float(error.mean()), float(np.percentile(error, 99.9))

# Write the mask as a single 8-bit grey PNG.
grey = bpy.data.images.new("mask", SIZE, SIZE, alpha=False)
flat = np.repeat(mask[::-1][:, :, None], 4, axis=2)
flat[:, :, 3] = 1
grey.pixels.foreach_set(flat.ravel())
grey.filepath_raw = os.path.join(out_dir, "mask.png")
grey.file_format = "PNG"
grey.save()
os.remove(os.path.join(out_dir, "mask-rgba.png"))
os.remove(uv_path)

asset = {
    "formatVersion": 1,
    "deviceAssetId": geo["id"],
    "deviceAssetVersion": geo["version"],
    "view": view,
    "image": {"width": SIZE, "height": SIZE, "beauty": "beauty.png", "mask": "mask.png"},
    "screenCorners": corners,
    "screenNative": {"width": s["nativeWidth"], "height": s["nativeHeight"]},
    "deviceBounds": bounds,
    "verification": {
        "method": "UV pass vs homography of projected corners",
        "samples": int(len(pick)),
        "meanErrorScreenPx": round(mean_error, 4),
        "p999ErrorScreenPx": round(max_error, 4),
        "toleranceScreenPx": MAX_HOMOGRAPHY_ERROR_PX,
        "passed": max_error <= MAX_HOMOGRAPHY_ERROR_PX,
    },
    "render": {"engine": "Blender Cycles", "blender": bpy.app.version_string, "samples": int(view.get("samples", 96))},
    "license": {
        "kind": "original",
        "holder": geo["license"]["holder"],
        "terms": "Rendered by the Frameflow asset pipeline from original geometry; no third-party models, textures or HDR images.",
    },
}
with open(os.path.join(out_dir, "asset.json"), "w") as fh:
    json.dump(asset, fh, indent=2)
print(json.dumps(asset["verification"]))
if not asset["verification"]["passed"]:
    sys.exit(f"Homography error {max_error:.3f}px exceeds {MAX_HOMOGRAPHY_ERROR_PX}px: asset rejected")
