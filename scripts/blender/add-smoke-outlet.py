"""Add the emitter marker to an existing refinery without regenerating its meshes."""
import bpy
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from generate import ROOT, add_smoke_outlet

source = ROOT / "assets/blender/refinery.blend"
bpy.ops.wm.open_mainfile(filepath=str(source), load_ui=False)
add_smoke_outlet()
bpy.ops.wm.save_as_mainfile(filepath=str(source), compress=True, check_existing=False)
bpy.ops.export_scene.gltf(filepath=str(ROOT / "public/models/refinery.glb"), export_format="GLB",
                          export_yup=True, export_apply=True, export_animations=False,
                          export_cameras=False, export_lights=False, export_extras=True, check_existing=False)
print("Refinery emitter marker added; existing geometry preserved.")
