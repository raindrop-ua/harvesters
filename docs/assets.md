# Blender asset workflow

## Source of truth

| Editable source                  | Runtime export                | Important nodes                                                                                                                                             |
| -------------------------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `assets/blender/harvester.blend` | `public/models/harvester.glb` | `MainChassis`, `LeftTrackAssembly`, `RightTrackAssembly`, `LeftTrackTreads`, `RightTrackTreads`, `MiningRotor`, `MiningArms`, `CargoContainer`, `CargoFill` |
| `assets/blender/refinery.blend`  | `public/models/refinery.glb`  | `ProcessingStructure`, `DockStatusLight`, `SmokeOutlet`                                                                                                     |
| `assets/blender/terrain.blend`   | `public/models/terrain.glb`   | `DesertHeightfield`, `DesertHorizon`, `ScatteredPebbles`                                                                                                    |
| `assets/blender/rocks.blend`     | `public/models/rocks.glb`     | `RockFormation`                                                                                                                                             |
| `assets/blender/minerals.blend`  | `public/models/minerals.glb`  | `Crystal00` … `Crystal06`                                                                                                                                   |
| `assets/blender/effects.blend`   | `public/models/effects.glb`   | `DustParticle`, `ExtractionParticle`, `SelectionRing`                                                                                                       |

`.blend` and `.glb` files belong in version control. Blender backup files (`.blend1`) do not. No imported commercial assets or textures are used. Materials are authored with a shared palette, matte roughness, restrained emission, and no image textures.

## Base expansion assets

`assets/blender/courtyard.blend` exports `public/models/courtyard.glb`, with `CourtyardStructure`, `GantryCrane`, `SupplyStacks`, and `CommandAntenna`. `assets/blender/smoke.blend` exports the reusable `SmokeParticle` mesh in `public/models/smoke.glb`.

Courtyard uses a ground-centered origin and a 16 × 14 m footprint from `assets/world.json`. Its solid foundation extends 1 m below the origin, seating the level workshop on existing sloping terrain. Runtime placement uses the maximum terrain height under the footprint; no terrain vertices are edited. Keep all meshes, including the crane and supplies, inside this footprint. The asset check verifies transformed GLB bounds against the dimensions.

Generate only the new assets, leaving the other sources alone:

```sh
python3 scripts/export-assets.py --generate courtyard smoke
node scripts/optimize-assets.mjs courtyard smoke
```

Add the editable chimney marker to an existing refinery without regenerating geometry:

```sh
python3 scripts/export-assets.py --add-smoke-outlet
```

This is idempotent and preserves an existing marker position. Move `SmokeOutlet` with the chimney when editing the source. New refinery generation includes it automatically. The current upgrade preserves every refinery mesh position, normal, and triangle index.

## Regenerate the initial art

```sh
npm run assets:generate
```

This runs `scripts/blender/generate.py` inside Blender, saves all original sources, exports GLB, writes the shared terrain heightfield, then runs glTF Transform. The world seed and layout are in `assets/world.json`. Generation **replaces** the generated sources: preserve your manual work before regenerating.

Set a custom Blender binary when required:

```sh
BLENDER_BIN=/path/to/blender npm run assets:generate
```

The script works without a GUI or external Python packages. If Blender is absent, it stops with a clear message. It never substitutes runtime primitives.

## Edit an existing asset

1. Open its `.blend` in Blender.
2. Edit geometry/materials. Keep the scene origin, units, component names, and animation pivots.
3. Save the `.blend` source.
4. Run `npm run assets:export -- harvester` (replace the asset name as needed).
5. Run `npm run assets:check`, then reload the game so the GLTF loader fetches the updated file.

For static appearance changes, rendering code does not change. Adding or removing optional visual details is supported. Renaming a node used by animation requires updating that node reference in rendering; the asset check protects the required harvester structure.

You may also export manually using glTF 2.0 → GLB, +Y up, apply modifiers, no cameras or lights, then optimize with `npm run assets:optimize`. Keep separate animation nodes and all seven ground-pivoted crystal objects for staged depletion. Avoid joining the entire vehicle into one mesh.

## Units and pivots

One unit is one meter. Runtime coordinates are X right, Y up, +Z vehicle forward. The authoring helpers accept runtime coordinates and map them to Blender `(X, -Z, Y)`. Blender's standard Y-up export maps them back.

Vehicle and building origins are ground-centered. The mining rotor origin is its axle. The cargo fill origin is at the bottom of its container so scaling does not move the floor. Static subassemblies are joined by purpose to reduce nodes/draw calls while preserving editable components and material slots.

## Terrain editing

The playable surface is a 65 × 65 vertex mesh for a 64 × 64 navigation grid. The exact triangle diagonal is part of the navigation contract. `DesertHorizon` is decorative, non-playable sand outside the grid, so wide camera views do not reveal a cut edge.

For manual sculpting, edit `DesertHeightfield` vertex heights while preserving X/Z positions, vertex count, and triangle topology. Keep the refinery pad level. Export with:

```sh
npm run assets:export -- terrain
npm run assets:check
```

The exporter extracts the edited heights into `src/game/data/terrain.json` and rejects incompatible topology. Moving X/Z vertices or changing topology requires updating the logical surface sampler first. Modify the deterministic generation script when you want a reproducible, differently shaped map.

## Optimization and checks

glTF Transform deduplicates reusable data, welds identical vertices, and prunes unused data. It preserves the node hierarchy, animation pivots, emission extensions, and full-precision terrain positions. No lossy simplification, Draco, or texture decoding dependency is needed for this asset size. Provenance is retained in GLB extras as `sourceGenerator` and `sourceFile`.

`npm run assets:check` validates GLB headers, Blender provenance, required animation/effect nodes, courtyard footprint bounds, and every terrain/navigation vertex. The eight optimized GLBs total approximately 2 MB. The harvester is around 14k triangles, refinery around 6k, courtyard around 9k, and each smoke puff 240 triangles; a future large fleet should add LODs and measure draw calls before increasing detail.

Selective export and optimization touch only the requested assets.
