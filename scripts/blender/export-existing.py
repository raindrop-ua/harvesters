"""Export edited .blend files without rerunning the procedural authoring script."""
import bpy
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
names = sys.argv[sys.argv.index("--") + 1:]
if not names:
    names = ["terrain", "harvester", "refinery", "courtyard", "smoke", "minerals", "rocks", "effects", "tank-light", "tank-medium", "tank-heavy"]

for name in names:
    bpy.ops.wm.open_mainfile(filepath=str(ROOT / "assets/blender" / (name + ".blend")), load_ui=False)
    if name == "terrain":
        # Keep edited terrain heights synchronized with navigation, too.
        world = json.loads((ROOT / "assets/world.json").read_text())
        n, cell = world["width"], world["cellSize"]
        obj = bpy.data.objects.get("DesertHeightfield")
        if obj is None or obj.type != "MESH" or obj.modifiers:
            raise RuntimeError("Terrain needs an unmodified DesertHeightfield grid mesh; apply modifiers first.")
        heights = [None] * ((n + 1)**2)
        indices = {}
        for vertex in obj.data.vertices:
            p = obj.matrix_world @ vertex.co
            gx, gz = (p.x + n * cell / 2) / cell, (-p.y + n * cell / 2) / cell
            x, z = round(gx), round(gz)
            if abs(gx - x) > 0.0001 or abs(gz - z) > 0.0001 or not 0 <= x <= n or not 0 <= z <= n:
                raise RuntimeError("Edit terrain heights only; preserve X/Z grid coordinates.")
            index = z * (n + 1) + x
            heights[index] = round(p.z, 5)
            indices[vertex.index] = index
        expected_faces = set()
        for z in range(n):
            for x in range(n):
                a = z * (n + 1) + x
                expected_faces.update([tuple(sorted([a, a + n + 1, a + 1])), tuple(sorted([a + 1, a + n + 1, a + n + 2]))])
        actual_faces = {tuple(sorted(indices[i] for i in face.vertices)) for face in obj.data.polygons}
        if None in heights or expected_faces != actual_faces:
            raise RuntimeError("Preserve terrain vertex count and triangle topology for the shared height sampler.")
        (ROOT / "src/game/data/terrain.json").write_text(json.dumps({"width": n, "cellSize": cell, "heights": heights}, separators=(",", ":")))
    bpy.ops.export_scene.gltf(filepath=str(ROOT / "public/models" / (name + ".glb")), export_format="GLB",
                              export_yup=True, export_apply=True, export_animations=False,
                              export_cameras=False, export_lights=False, export_extras=True, check_existing=False)
    print("Exported edited Blender source:", name)
