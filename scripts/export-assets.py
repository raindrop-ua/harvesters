"""Find Blender and run the reproducible authoring pipeline."""
import os
import argparse
import shutil
import subprocess
from pathlib import Path

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
asset_names = ["terrain", "harvester", "refinery", "courtyard", "smoke", "minerals", "rocks", "effects"]
parser.add_argument("--existing", nargs="*", choices=asset_names)
parser.add_argument("--generate", nargs="*", choices=asset_names)
parser.add_argument("--add-smoke-outlet", action="store_true")
args = parser.parse_args()
blender = os.environ.get("BLENDER_BIN") or shutil.which("blender")
if not blender and Path("/Applications/Blender.app/Contents/MacOS/Blender").exists():
    blender = "/Applications/Blender.app/Contents/MacOS/Blender"
if not blender:
    raise SystemExit("Blender is required. Install it or set BLENDER_BIN; no runtime geometry substitutes are used.")
script = "generate.py" if args.existing is None else "export-existing.py"
if args.add_smoke_outlet:
    script = "add-smoke-outlet.py"
command = [blender, "--background", "--factory-startup", "--python", str(root / "scripts/blender" / script)]
if args.existing is not None:
    command += ["--"] + args.existing
elif args.generate:
    command += ["--"] + args.generate
subprocess.run(command, cwd=root, check=True)
if args.existing is not None or args.add_smoke_outlet:
    names = ["refinery"] if args.add_smoke_outlet else args.existing
    subprocess.run(["node", "scripts/optimize-assets.mjs"] + names, cwd=root, check=True)
