# HARVESTER

A small machine. A vast desert.

A playable desert RTS vertical slice: one autonomous tracked harvester, one refinery, five finite cyan mineral deposits, and an editable Blender-authored world. The harvester finds resources, follows A* routes, mines, docks, unloads, and repeats without input.

## Run

Use Node.js 22.12+ (Node 24 LTS recommended), npm, and a modern browser with WebGL 2.

```sh
npm install
npm run dev
```

Open <http://127.0.0.1:5173>. Ready-to-use GLBs are included; Blender is only needed to regenerate or edit assets. Fonts are bundled locally. No accounts, keys, or external services are required.

## Controls

| Input                           | Action                                         |
| ------------------------------- | ---------------------------------------------- |
| WASD / arrow keys               | Pan camera                                     |
| Mouse wheel                     | Smooth zoom                                    |
| Middle-button drag / touch drag | Pan camera                                     |
| Click harvester                 | Select                                         |
| Click empty terrain / Esc       | Deselect                                       |
| F / Locate / minimap            | Select and center harvester                    |
| Space / pause button            | Pause or resume simulation                     |
| 1× button                       | Cycle 1×, 2×, 4× simulation speed              |
| Hold / Autopilot                | Stop unit, or resume autonomous work           |
| Return arrow                    | Deliver current cargo                          |
| G                               | Toggle logical grid; blocked cells appear red  |
| P                               | Toggle remaining navigation path               |
| Sliders button                  | Developer controls and postprocessing settings |

The simulation starts when assets are ready and pauses in hidden tabs. The camera stays usable while the simulation is paused. Manual MOVE and targeted HARVEST commands are supported by the tested command API; right-click movement is deliberately not exposed in the default UI.

## Development

```sh
npm run test                # Node-only deterministic tests
npm run test:watch
npm run typecheck
npm run lint
npm run format
npm run format:check
npm run architecture:check  # Simulation/rendering and Blender boundaries
npm run assets:check        # GLB structure, pivots, and exact terrain-height checks
npm run build
npm run preview
npm run validate            # All static, simulation, asset, and production checks
```

## Assets

All visible game-world meshes, including particle shapes and the selection ring, originate in Blender. No runtime world models are assembled from Three.js primitives. Debug lines are the only code-generated geometry.

```sh
npm run assets:generate             # Recreate all .blend, GLB, terrain metadata; optimize
npm run assets:export -- harvester  # Export an edited .blend without regenerating it
npm run assets:export -- terrain    # Also update navigation heights from the edited grid
npm run assets:optimize             # Lossless deduplication/welding/pruning
npm run assets:check
```

Blender is detected from PATH, the standard macOS application, or `BLENDER_BIN`. Authoring was verified with Blender 5.2.3 LTS. **Generation replaces the generated .blend sources; use `assets:export` to preserve manual edits.** See [the asset workflow](docs/assets.md).

## Structure

```text
assets/world.json       Shared map layout and generation seed
assets/blender/         Editable .blend sources
public/models/          Optimized runtime GLBs
scripts/blender/        Reproducible Blender authoring/export scripts
src/game/               Pure TypeScript gameplay; no React, Three.js, or Zustand
  navigation/           Logical grid, occupancy, exact height sampling, deterministic A*
  simulation/           World ownership and explicit harvester state machine
  commands/             Validated command queue, executed at tick boundaries
  economy/              Resource balances and reservable refinery receiver
  core/                 Bounded 20 Hz fixed-step clock
src/app/                Browser scheduling, runtime ownership, low-frequency Zustand bridge
src/rendering/          R3F scene, GLB instances, interpolation, camera, visual effects
src/ui/                 DOM HUD, selection information, minimap, developer controls
docs/                   Specification, architecture, asset workflow, validation evidence
```

Gameplay tuning lives in `src/game/config.ts`. Grid dimensions and scene layout live in `assets/world.json`; regenerate assets after changing map dimensions. The default navigation grid is 64 × 64 at 2 m per cell. Terrain triangles and navigation share one exported heightfield.

See [architecture and extension points](docs/architecture.md), [validation](docs/validation.md), and the [original specification](docs/specification.md).

## Scope and limits

This is a one-unit, one-building desktop browser prototype. All 3,660 minerals are finite; after mining and delivering everything, the harvester safely idles. Reload to start a new shift. There is no combat, construction, save/load, physics, or multi-unit avoidance. Dock reservation supports one active unit; a future fleet will need queueing and per-unit navigation clearance.

Portrait layouts and touch panning are supported, but multi-touch pinch zoom and full mobile controls are not implemented. Performance has been smoke-tested in Chromium; cross-browser and large-fleet performance are not yet benchmarked. The Three.js production chunk exceeds Vite's default 500 KB warning threshold; the canvas code is lazy-loaded separately from the HUD.
