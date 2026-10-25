"""Find Blender and run the reproducible authoring pipeline."""
import os
import argparse
import shutil
import subprocess
from pathlib import Path

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument("--existing", nargs="*", choices=["terrain", "harvester", "refinery", "minerals", "rocks", "effects"])
parser.add_argument("--generate", nargs="*", choices=["terrain", "harvester", "refinery", "minerals", "rocks", "effects"])
args = parser.parse_args()
blender = os.environ.get("BLENDER_BIN") or shutil.which("blender")
if not blender and Path("/Applications/Blender.app/Contents/MacOS/Blender").exists():
    blender = "/Applications/Blender.app/Contents/MacOS/Blender"
if not blender:
    raise SystemExit("Blender is required. Install it or set BLENDER_BIN; no runtime geometry substitutes are used.")
script = "generate.py" if args.existing is None else "export-existing.py"
command = [blender, "--background", "--factory-startup", "--python", str(root / "scripts/blender" / script)]
if args.existing is not None:
    command += ["--"] + args.existing
elif args.generate:
    command += ["--"] + args.generate
subprocess.run(command, cwd=root, check=True)
if args.existing is not None:
    subprocess.run(["node", "scripts/optimize-assets.mjs"], cwd=root, check=True)
