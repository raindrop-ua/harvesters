"""HARVESTER 0.1 — all world geometry is authored here, inside Blender.

Helpers accept runtime coordinates (X right, Y up, +Z vehicle forward).
Blender uses (X, -Z, Y); the standard Y-up GLB export reverses this mapping.
No external Python dependencies. Seed and world layout live in assets/world.json.
"""
import bpy
import json
import math
import random
import sys
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
WORLD = json.loads((ROOT / "assets/world.json").read_text())
OUT = ROOT / "public/models"
SOURCE = ROOT / "assets/blender"
OUT.mkdir(parents=True, exist_ok=True)
SOURCE.mkdir(parents=True, exist_ok=True)
(ROOT / "src/game/data").mkdir(parents=True, exist_ok=True)
random.seed(WORLD["seed"])


def xyz(p):
    return (p[0], -p[2], p[1])


def reset(name):
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for data in list(bpy.data.materials):
        bpy.data.materials.remove(data)
    bpy.context.scene.collection.children[0].name = name
    bpy.context.scene.unit_settings.system = "METRIC"
    bpy.context.scene.unit_settings.scale_length = 1


def material(name, color, emission=0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*color, 1)
    shader.inputs["Roughness"].default_value = 0.78
    shader.inputs["Emission Color"].default_value = (*color, 1)
    shader.inputs["Emission Strength"].default_value = emission
    return mat


def palette():
    return {
        "ivory": material("Armor / warm porcelain", (0.70, 0.65, 0.48)),
        "light": material("Armor / edge highlight", (0.88, 0.83, 0.65)),
        "orange": material("Faction / vermilion", (0.68, 0.19, 0.07)),
        "dark": material("Mechanics / graphite", (0.075, 0.10, 0.095)),
        "steel": material("Mechanics / sage steel", (0.24, 0.30, 0.25)),
        "rubber": material("Tracks / rubber", (0.045, 0.065, 0.059)),
        "glass": material("Cabin / smoked teal", (0.045, 0.20, 0.21)),
        "cyan": material("Mineral / turquoise", (0.035, 0.58, 0.64), 0.18),
        "blue": material("Mineral / blue", (0.025, 0.29, 0.43), 0.08),
        "mint": material("Mineral / sunlit facets", (0.23, 0.87, 0.86), 0.2),
        "lamp": material("Lights / warm white", (1.0, 0.78, 0.38), 1.4),
    }


def finish(obj, name, mat):
    obj.name = name
    if mat:
        obj.data.materials.append(mat)
    return obj


def block(name, p, size, mat, bevel=0.1):
    bpy.ops.mesh.primitive_cube_add(size=1, location=xyz(p))
    obj = bpy.context.object
    obj.dimensions = (size[0], size[2], size[1])
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        mod = obj.modifiers.new("Soft manufactured edges", "BEVEL")
        mod.width = bevel
        mod.segments = 2
        bpy.ops.object.modifier_apply(modifier=mod.name)
        normal = obj.modifiers.new("Weighted corner normals", "WEIGHTED_NORMAL")
        bpy.ops.object.modifier_apply(modifier=normal.name)
    return finish(obj, name, mat)


def cylinder(name, p, radius, depth, mat, axis="y", vertices=16):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=xyz(p))
    obj = bpy.context.object
    if axis == "x":
        obj.rotation_euler[1] = math.pi / 2
    elif axis == "z":
        obj.rotation_euler[0] = math.pi / 2
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    mod = obj.modifiers.new("Rolled edges", "BEVEL")
    mod.width = min(radius * 0.12, 0.12)
    mod.segments = 2
    bpy.ops.object.modifier_apply(modifier=mod.name)
    return finish(obj, name, mat)


def mesh(name, vertices, faces, mat):
    data = bpy.data.meshes.new(name)
    data.from_pydata([xyz(p) for p in vertices], [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    if mat:
        obj.data.materials.append(mat)
    return obj


def join_group(name, objects, pivot=(0, 0, 0)):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    obj = bpy.context.object
    obj.name = name
    bpy.context.scene.cursor.location = xyz(pivot)
    bpy.ops.object.origin_set(type="ORIGIN_CURSOR")
    return obj


def label(text, p, size, mat):
    bpy.ops.object.text_add(location=xyz(p))
    obj = bpy.context.object
    obj.data.body = text
    obj.data.size = size
    obj.data.align_x = "CENTER"
    # Flat roof stencil, legible from the RTS camera.
    obj.data.extrude = 0.002
    bpy.ops.object.convert(target="MESH")
    return finish(bpy.context.object, "Stencil / " + text, mat)


def export(name):
    # Apply transforms without destroying the component pivots.
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    bpy.context.scene.cursor.location = (0, 0, 0)
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE / (name + ".blend")), compress=True, check_existing=False)
    bpy.ops.export_scene.gltf(filepath=str(OUT / (name + ".glb")), export_format="GLB", export_yup=True,
                              export_apply=True, export_animations=False, export_cameras=False,
                              export_lights=False, export_extras=True, check_existing=False)


def add_smoke_outlet():
    """An editable marker at the taller stack lip; no runtime chimney offsets."""
    if bpy.data.objects.get("SmokeOutlet"):
        return
    outlet = bpy.data.objects.new("SmokeOutlet", None)
    bpy.context.collection.objects.link(outlet)
    outlet.location = xyz((-4.1, 8.65, -3.0))
    outlet.empty_display_size = 0.35
    outlet["purpose"] = "Refinery unloading smoke emitter"


def harvester():
    reset("Harvester / modular industrial crawler")
    m = palette()
    body = [
        block("Underbody", (0, 0.95, 0), (3.5, 0.65, 4.7), m["dark"], 0.24),
        block("Armored hull", (0, 1.55, 0), (3.4, 0.9, 4.25), m["ivory"], 0.28),
        block("Front power pack", (0, 2.03, 1.05), (3.05, 0.35, 1.55), m["light"], 0.15),
        block("Orange hood stripe", (0.8, 2.22, 1.05), (0.48, 0.045, 1.45), m["orange"], 0.025),
        block("Cabin shell", (-0.76, 2.5, 0.1), (1.35, 1.25, 1.5), m["light"], 0.18),
        block("Windshield", (-0.76, 2.64, 0.87), (1.08, 0.63, 0.04), m["glass"], 0.05),
        block("Cabin side glass", (-1.45, 2.65, 0.1), (0.04, 0.62, 1.1), m["glass"], 0.04),
        block("Cabin top", (-0.76, 3.15, 0.1), (1.5, 0.18, 1.68), m["orange"], 0.07),
    ]
    for x in (-1.3, 1.3):
        body.append(block("Headlamp", (x, 1.83, 2.15), (0.34, 0.25, 0.14), m["lamp"], 0.05))
        body.append(block("Fender", (x * 1.3, 1.88, 0), (0.6, 0.18, 4.4), m["orange"], 0.06))
    for z in (-0.45, -0.2, 0.05, 0.3):
        body.append(block("Radiator fin", (0.78, 2.1, z), (0.78, 0.12, 0.1), m["dark"], 0.02))
    body.append(cylinder("Exhaust", (1.1, 2.4, -1.5), 0.14, 1.8, m["dark"]))
    body.append(cylinder("Beacon base", (-0.8, 3.3, 0.1), 0.18, 0.22, m["dark"]))
    body.append(cylinder("Amber beacon", (-0.8, 3.5, 0.1), 0.14, 0.2, m["lamp"]))
    join_group("MainChassis", body)
    for side in (-1, 1):
        x = side * 1.85
        track = [block("Continuous track belt", (x, 0.8, 0), (0.8, 1.35, 4.8), m["rubber"], 0.52)]
        for z in (-1.65, -0.55, 0.55, 1.65):
            track.append(cylinder("Road wheel", (x + side * 0.42, 0.78, z), 0.47, 0.12, m["steel"], "x", 12))
            track.append(cylinder("Wheel hub", (x + side * 0.5, 0.78, z), 0.19, 0.13, m["ivory"], "x", 10))
        join_group("LeftTrackAssembly" if side < 0 else "RightTrackAssembly", track)
        tread = []
        for i in range(16):
            z = -2.05 + i * 0.27
            tread.append(block("Track shoe", (x, 1.42, z), (0.87, 0.1, 0.16), m["steel"], 0.025))
        join_group("LeftTrackTreads" if side < 0 else "RightTrackTreads", tread)
    cargo = [block("Cargo bed", (0, 1.97, -1.3), (2.65, 0.2, 1.5), m["dark"], 0.08)]
    for x in (-1.36, 1.36):
        cargo.append(block("Cargo sidewall", (x, 2.3, -1.33), (0.16, 0.7, 1.7), m["ivory"], 0.07))
    cargo.append(block("Cargo tailgate", (0, 2.3, -2.12), (2.8, 0.7, 0.16), m["orange"], 0.05))
    join_group("CargoContainer", cargo)
    fill = block("CargoFill", (0, 2.12, -1.3), (2.4, 0.62, 1.37), m["cyan"], 0.12)
    bpy.context.scene.cursor.location = xyz((0, 1.99, -1.3))
    bpy.ops.object.origin_set(type="ORIGIN_CURSOR")
    arms = []
    for x in (-1.2, 1.2):
        arms.append(block("Mining support arm", (x, 0.9, 2.5), (0.25, 0.3, 1.5), m["steel"], 0.07))
    join_group("MiningArms", arms)
    cutter = [cylinder("Cutter barrel", (0, 0.85, 3.05), 0.57, 3.15, m["orange"], "x", 12)]
    for x in (-1.25, -0.75, -0.25, 0.25, 0.75, 1.25):
        for a in range(6):
            theta = a * math.pi / 3
            tooth = block("Mining tooth", (x, 0.85 + math.sin(theta) * 0.57, 3.05 + math.cos(theta) * 0.57),
                          (0.18, 0.22, 0.3), m["light"], 0.025)
            cutter.append(tooth)
    join_group("MiningRotor", cutter, (0, 0.85, 3.05))
    export("harvester")


def refinery():
    reset("Refinery / K-01 mineral processing station")
    m = palette()
    static = [
        block("Foundation", (0, 0.25, 0), (11.8, 0.5, 9.8), m["steel"], 0.22),
        block("Processing hall", (-1.9, 2.9, -0.7), (6.6, 5.1, 6.9), m["ivory"], 0.32),
        block("Dark roof rim", (-1.9, 5.48, -0.7), (6.85, 0.3, 7.15), m["dark"], 0.12),
        block("Roof slab", (-1.9, 5.7, -0.7), (6.65, 0.3, 6.95), m["light"], 0.16),
        block("Roof faction band", (-3.8, 5.87, -0.7), (0.85, 0.04, 6.8), m["orange"], 0.02),
        block("Dock entrance / dark recess", (-1.0, 1.9, 2.79), (3.9, 3.1, 0.13), m["dark"], 0.15),
        block("Dock lintel", (-1.0, 3.58, 3.01), (4.5, 0.5, 0.55), m["orange"], 0.08),
        block("Dock canopy", (-1.0, 4.02, 3.6), (4.7, 0.25, 2.2), m["light"], 0.12),
        block("Dock apron", (-1.0, 0.12, 6.2), (4.5, 0.24, 3.4), m["dark"], 0.12),
    ]
    # Apron and entrance share runtime X=-17; the vehicle faces -Z at the dock.
    for x in (-3.15, 1.15):
        static.append(block("Dock guide rail", (x, 0.29, 6.2), (0.12, 0.16, 3.2), m["lamp"], 0.025))
    for z in (4.9, 5.65, 6.4, 7.15):
        static.append(block("Apron guide marking", (-1.0, 0.25, z), (0.38, 0.035, 0.3), m["light"], 0.01))
    for x in (-4.6, 0.9):
        static.append(block("Hall rib", (x, 2.8, 2.9), (0.3, 4.6, 0.35), m["light"], 0.06))
    for z in (-2.8, 0.5):
        static += [cylinder("Storage vessel", (3.5, 2.8, z), 1.48, 4.9, m["light"], vertices=20),
                   cylinder("Tank cap", (3.5, 5.32, z), 1.5, 0.25, m["steel"], vertices=20),
                   cylinder("Tank lower collar", (3.5, 0.75, z), 1.51, 0.3, m["orange"], vertices=20),
                   cylinder("Tank upper collar", (3.5, 4.3, z), 1.5, 0.32, m["orange"], vertices=20),
                   cylinder("Transfer pipe", (2.2, 3.6, z), 0.22, 3.1, m["steel"], "x")]
    for x, h in ((-4.1, 8.5), (-2.8, 7.2)):
        static += [cylinder("Vent stack", (x, h / 2, -3.0), 0.48, h, m["steel"], vertices=12),
                   cylinder("Chimney orange collar", (x, h - 0.6, -3.0), 0.5, 0.65, m["orange"], vertices=12),
                   cylinder("Chimney lip", (x, h, -3.0), 0.62, 0.22, m["dark"], vertices=12)]
    for z in (-1.6, -0.9, -0.2):
        static.append(block("Roof heat exchanger", (-0.8, 6.05, z), (2.4, 0.3, 0.22), m["steel"], 0.06))
    static.append(label("K—01", (-1.2, 5.88, 1.5), 0.9, m["dark"]))
    join_group("ProcessingStructure", static)
    lamp = block("DockStatusLight", (-1.0, 3.6, 3.31), (1.3, 0.13, 0.08), m["cyan"], 0.02)
    add_smoke_outlet()
    export("refinery")


def courtyard():
    reset("Courtyard / CY-01 construction yard")
    m = palette()
    # The entire model fits its 16 x 14 m navigation footprint. A deep plinth
    # accommodates the existing sand slope without changing the terrain mesh.
    structure = [
        block("Reinforced foundation", (0, -0.35, 0), (15.6, 1.3, 13.6), m["steel"], 0.15),
        block("Workshop hall", (0.6, 2.5, -1.8), (9.4, 4.4, 7.8), m["ivory"], 0.24),
        block("Roof shadow rim", (0.6, 4.75, -1.8), (9.8, 0.25, 8.1), m["dark"], 0.08),
        block("Left workshop roof", (-1.8, 5.01, -1.8), (4.9, 0.3, 8.05), m["light"], 0.09),
        block("Right workshop roof", (3.0, 5.01, -1.8), (4.9, 0.3, 8.05), m["light"], 0.09),
        block("Roof faction stripe", (-2.8, 5.18, -1.8), (0.65, 0.035, 7.95), m["orange"], 0.01),
        block("Front apron", (0, 0.34, 4.3), (12.4, 0.08, 3.65), m["dark"], 0.08),
        block("Command tower", (-5.55, 3.0, -2.9), (3.3, 5.4, 4.5), m["ivory"], 0.22),
        block("Command glazing", (-5.55, 5.05, -0.57), (2.85, 1.05, 0.12), m["glass"], 0.06),
        block("Side glazing", (-7.24, 5.05, -2.8), (0.1, 1.05, 2.7), m["glass"], 0.03),
        block("Command roof", (-5.55, 5.84, -2.9), (3.65, 0.28, 4.8), m["light"], 0.1),
        block("Command faction band", (-7.25, 3.4, -2.9), (0.09, 0.4, 4.25), m["orange"], 0.015),
        block("Office door", (-5.6, 1.65, -0.57), (1.25, 2.5, 0.13), m["dark"], 0.04),
    ]
    for x in (-1.75, 2.95):
        structure += [
            block("Workshop bay recess", (x, 2.15, 2.16), (3.75, 3.55, 0.18), m["dark"], 0.06),
            block("Armored rolling door", (x, 2.1, 2.3), (3.4, 3.25, 0.13), m["steel"], 0.04),
            block("Bay lintel", (x, 4.12, 2.37), (4.05, 0.45, 0.44), m["orange"], 0.06),
        ]
        for y in (0.8, 1.3, 1.8, 2.3, 2.8, 3.3):
            structure.append(block("Door slat", (x, y, 2.4), (3.35, 0.07, 0.06), m["dark"], 0.01))
        for side in (-1, 1):
            structure.append(block("Apron bay marking", (x + side * 1.85, 0.39, 4.25), (0.1, 0.025, 3.2), m["light"], 0.01))
    for z in (-4.8, -3.8, -2.8):
        structure.append(block("Roof ventilation", (2.5, 5.25, z), (2.0, 0.22, 0.25), m["steel"], 0.04))
    structure.append(label("CY—01", (0.1, 5.19, -0.25), 0.95, m["dark"]))
    join_group("CourtyardStructure", structure)

    crane = []
    for x in (-5.0, 6.4):
        crane += [
            block("Gantry foot", (x, 0.55, 3.8), (1.1, 0.4, 1.3), m["dark"], 0.08),
            block("Gantry column", (x, 3.9, 3.8), (0.6, 6.5, 0.65), m["orange"], 0.07),
            block("Gantry column collar", (x, 1.5, 3.8), (0.73, 0.7, 0.78), m["light"], 0.04),
        ]
    crane += [
        block("Gantry bridge lower", (0.7, 6.75, 3.8), (12.1, 0.26, 0.75), m["orange"], 0.04),
        block("Gantry bridge upper", (0.7, 7.65, 3.8), (12.1, 0.26, 0.75), m["orange"], 0.04),
        block("Hoist carriage", (2.35, 6.9, 3.8), (1.6, 0.6, 1.1), m["dark"], 0.12),
        cylinder("Hoist drum", (2.35, 6.5, 3.8), 0.27, 1.0, m["steel"], "x", vertices=12),
        cylinder("Hoist cable", (2.35, 4.9, 3.8), 0.055, 2.8, m["dark"], vertices=8),
        block("Hoist hook block", (2.35, 3.42, 3.8), (0.55, 0.6, 0.48), m["orange"], 0.08),
    ]
    for i in range(8):
        a = Vector(xyz((-5.1 + i * 1.45, 6.85 if i % 2 == 0 else 7.55, 3.8)))
        b = Vector(xyz((-5.1 + (i + 1) * 1.45, 7.55 if i % 2 == 0 else 6.85, 3.8)))
        bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=0.1, depth=(b-a).length, location=(a+b)/2)
        rod = bpy.context.object
        rod.rotation_mode = "QUATERNION"
        rod.rotation_quaternion = (b-a).to_track_quat("Z", "Y")
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
        crane.append(finish(rod, "Gantry diagonal brace", m["light"]))
    join_group("GantryCrane", crane)

    supplies = []
    for x, z, h in [(-6.0, 2.3, 0.75), (-6.0, 4.35, 0.75), (-6.0, 4.35, 1.65)]:
        supplies.append(block("Supply crate", (x, h + 0.3, z), (1.35, 0.85, 1.5), m["ivory"], 0.08))
        for dx in (-0.45, 0.45):
            supplies.append(block("Crate strap", (x + dx, h + 0.3, z), (0.11, 0.9, 1.56), m["orange"], 0.02))
    for z in (-4.2, -3.4, -2.6):
        supplies.append(cylinder("Spare beam bundle", (6.25, 0.7, z), 0.22, 1.7, m["steel"], "x", vertices=10))
    join_group("SupplyStacks", supplies)
    antenna = [
        cylinder("Radio mast", (-5.6, 7.1, -3.6), 0.07, 2.4, m["dark"], vertices=8),
        cylinder("Radio crossbar", (-5.6, 7.8, -3.6), 0.045, 1.8, m["steel"], "x", vertices=8),
        cylinder("Mast beacon", (-5.6, 8.36, -3.6), 0.13, 0.2, m["lamp"], vertices=8),
    ]
    join_group("CommandAntenna", antenna)
    export("courtyard")


def smoke():
    reset("Smoke / authored refinery plume")
    mat = material("Smoke / warm ash", (0.42, 0.43, 0.39))
    puffs = []
    for p, radius in [((0, 0, 0), 0.7), ((0.38, 0.18, 0.04), 0.52), ((-0.3, 0.12, -0.16), 0.46)]:
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=radius, location=xyz(p))
        obj = finish(bpy.context.object, "Smoke lobe", mat)
        for polygon in obj.data.polygons:
            polygon.use_smooth = True
        puffs.append(obj)
    join_group("SmokeParticle", puffs)
    export("smoke")


def minerals():
    reset("Minerals / cyan quartz cluster")
    m = palette()
    cluster = []
    for i, (x, z, h, r, tilt) in enumerate([
        (0, 0, 3.9, 0.65, 0.05), (-0.9, 0.1, 2.7, 0.5, -0.22),
        (0.7, 0.6, 2.6, 0.55, 0.18), (0.7, -0.8, 2.1, 0.45, 0.23),
        (-0.5, -0.9, 1.8, 0.4, -0.18), (1.3, -0.2, 1.4, 0.35, 0.35),
        (-1.3, -0.4, 1.1, 0.3, -0.3),
    ]):
        verts = []
        for y, radius in ((0, r * 0.85), (h * 0.72, r)):
            for k in range(6):
                a = k * math.pi / 3 + i * 0.45
                verts.append((x + math.cos(a) * radius + y * tilt, y, z + math.sin(a) * radius))
        verts.append((x + h * tilt + r * 0.17, h, z - r * 0.16))
        faces = [(k, (k + 1) % 6, (k + 1) % 6 + 6, k + 6) for k in range(6)]
        faces += [(k + 6, (k + 1) % 6 + 6, 12) for k in range(6)]
        faces.append(tuple(reversed(range(6))))
        obj = mesh("Quartz prism %02d" % i, verts, [tuple(reversed(f)) for f in faces], m["cyan"])
        obj.data.materials.append(m["blue"])
        obj.data.materials.append(m["mint"])
        for j, face in enumerate(obj.data.polygons):
            face.material_index = [0, 2, 0, 1, 1, 0][j % 6]
        cluster.append(obj)
    # Preserve individual, ground-pivoted prisms for staged depletion.
    for i, obj in enumerate(cluster):
        obj.name = "Crystal%02d" % i
    # Geometry vertices already use ground-level origins; Y scaling sinks no tips.
    export("minerals")


def rocks():
    reset("Rocks / wind-worn sandstone")
    mats = [material("Sandstone / " + str(i), c) for i, c in enumerate([
        (0.43, 0.24, 0.12), (0.56, 0.33, 0.17), (0.64, 0.40, 0.23), (0.71, 0.47, 0.28)])]
    objects = []
    for i, (x, z, h, r) in enumerate([(0, 0, 2.9, 1.7), (1.6, 0.4, 1.8, 1.1), (-1.5, -0.1, 1.3, 0.95)]):
        verts = []
        n = 7
        for y, factor in ((-0.1, 1), (h * 0.33, 1.06), (h * 0.9, 0.66), (h, 0.54)):
            for k in range(n):
                a = k * 2 * math.pi / n + 0.2 * i
                rr = r * factor * (0.88 + random.random() * 0.22)
                verts.append((x + math.cos(a) * rr + y * 0.11, y, z + math.sin(a) * rr * 0.8))
        faces = []
        for j in range(3):
            for k in range(n):
                faces.append((j * n + k, j * n + (k + 1) % n, (j + 1) * n + (k + 1) % n, (j + 1) * n + k))
        faces.append(tuple(range(3 * n, 4 * n)))
        obj = mesh("Stratified sandstone %d" % i, verts, [tuple(reversed(f)) for f in faces], mats[0])
        for mat in mats[1:]:
            obj.data.materials.append(mat)
        for j, poly in enumerate(obj.data.polygons):
            poly.material_index = min(3, j // n)
        objects.append(obj)
    join_group("RockFormation", objects)
    export("rocks")


def terrain():
    reset("Terrain / shared navigation heightfield")
    n, cell = WORLD["width"], WORLD["cellSize"]
    half = n * cell / 2

    def height(x, z):
        # Flat industrial clearing; larger dunes sit around its perimeter.
        value = 0.10 + 0.1 * math.sin(x * 0.16) * math.sin(z * 0.13)
        for cx, cz, h, spread in [(-37, -24, 4.5, 15), (33, -24, 5.2, 15),
                                   (17, 35, 3.5, 13), (-38, 27, 3.8, 16), (0, -44, 4, 16)]:
            value += h * math.exp(-((x - cx)**2 + (z - cz)**2) / spread**2)
        # Level the building foundation, with a broad smooth transition.
        flatten = math.exp(-(((x + 16) / 10)**4 + ((z + 7) / 9)**4))
        return round(value * (1 - flatten) + 0.12 * flatten, 5)

    vertices = []
    heights = []
    for z in range(n + 1):
        for x in range(n + 1):
            wx, wz = x * cell - half, z * cell - half
            h = height(wx, wz)
            heights.append(h)
            vertices.append((wx, h, wz))
    faces = []
    for z in range(n):
        for x in range(n):
            a = z * (n + 1) + x
            b, c, d = a + 1, a + n + 1, a + n + 2
            # Upward normals in runtime. Must match Grid.heightAt's diagonal.
            faces.extend([(a, c, b), (b, c, d)])
    sand = [material("Sand / tone %d" % i, (0.67 + i * 0.009, 0.445 + i * 0.008, 0.235 + i * 0.005)) for i in range(6)]
    obj = mesh("DesertHeightfield", vertices, faces, sand[0])
    for mat in sand[1:]:
        obj.data.materials.append(mat)
    for face in obj.data.polygons:
        face.material_index = random.choices(range(6), weights=[1, 2, 5, 8, 4, 1])[0]
        face.use_smooth = True
    # Non-playable sand skirt keeps the finite grid from exposing a hard map edge
    # during wide zooms and portrait layouts. Its inner edge shares grid vertices.
    skirt_vertices, skirt_faces = [], []
    for side in range(4):
        for i in range(n):
            a, b = -half + i * cell, -half + (i + 1) * cell
            if side == 0:
                corners = [(a, -half), (b, -half), (b * 3.5, -half * 3.5), (a * 3.5, -half * 3.5)]
            elif side == 1:
                corners = [(half, a), (half, b), (half * 3.5, b * 3.5), (half * 3.5, a * 3.5)]
            elif side == 2:
                corners = [(b, half), (a, half), (a * 3.5, half * 3.5), (b * 3.5, half * 3.5)]
            else:
                corners = [(-half, b), (-half, a), (-half * 3.5, a * 3.5), (-half * 3.5, b * 3.5)]
            base = len(skirt_vertices)
            skirt_vertices.extend((x, height(x, z) if k < 2 else -1, z) for k, (x, z) in enumerate(corners))
            skirt_faces.extend([(base, base + 1, base + 2), (base, base + 2, base + 3)])
    mesh("DesertHorizon", skirt_vertices, skirt_faces, sand[3])
    # Scattered pebbles authored into this asset, outside navigation obstacles.
    pebble_mat = material("Scattered sandstone", (0.48, 0.31, 0.17))
    pebbles = []
    for i in range(180):
        x, z = random.uniform(-52, 52), random.uniform(-52, 52)
        if -24 < x < -8 and -15 < z < 4:
            continue
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=random.uniform(0.12, 0.35), location=xyz((x, height(x, z), z)))
        p = bpy.context.object
        p.scale = (1.4, 0.9, 0.65)
        finish(p, "Desert pebble", pebble_mat)
        pebbles.append(p)
    join_group("ScatteredPebbles", pebbles)
    (ROOT / "src/game/data/terrain.json").write_text(json.dumps({"width": n, "cellSize": cell, "heights": heights}, separators=(",", ":")))
    export("terrain")


def effects():
    reset("Effects / reusable authored meshes")
    m = palette()
    dust = material("Dust / warm sand", (0.74, 0.54, 0.32))
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=1)
    finish(bpy.context.object, "DustParticle", dust)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=1)
    finish(bpy.context.object, "ExtractionParticle", m["mint"])
    bpy.ops.mesh.primitive_torus_add(major_radius=2.8, minor_radius=0.045, major_segments=64, minor_segments=6)
    finish(bpy.context.object, "SelectionRing", m["mint"])
    export("effects")


if __name__ == "__main__":
    generators = {"harvester": harvester, "refinery": refinery, "courtyard": courtyard, "smoke": smoke, "minerals": minerals, "rocks": rocks, "terrain": terrain, "effects": effects}
    names = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else list(generators)
    for name in names:
        generators[name]()
    print("HARVESTER: requested Blender sources, GLBs and shared terrain metadata generated.")
