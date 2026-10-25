# Architecture

## Authoritative simulation

`World` owns mutable gameplay state: the grid, unit, deposits, resource economy, and refinery receiver. Every application instance creates its own `GameRuntime` and `World`. There is no global mutable gameplay singleton.

`Simulation.step(dt)` is framework-independent. `FixedLoop` runs it at 20 Hz with a bounded accumulator, eight maximum catch-up steps, and a floating-point tolerance at tick boundaries. Rendering speed cannot change harvesting or travel outcomes. Excess hidden-tab time is discarded rather than replayed. Unit tests compare 30 and 144 FPS host schedules.

The harvester uses an explicit state machine:

```text
IDLE → FIND_RESOURCE → MOVE_TO_RESOURCE → HARVEST → CARGO_FULL
                 ↑                                    ↓
                 └──────── UNLOAD ← DOCK ← MOVE_TO_REFINERY
```

Missing resources, unavailable refineries, and inaccessible docks produce bounded retries with cargo retained. Paths are checked before each movement step. A changed path triggers replanning. Resource transfer preserves the sum of remaining deposits, cargo, and stored minerals. There is also a full-map depletion test.

## Navigation and terrain

The visible terrain and navigation metadata are generated together in Blender from `assets/world.json`. `Grid.heightAt` uses barycentric sampling of exactly the exported mesh's two triangles per cell. `assets:check` compares every navigation vertex against its actual optimized GLB position.

Grid cells expose terrain height, movement cost, buildability, walkability, and occupancy. Layered occupancy preserves a rock when an overlapping deposit disappears and restores original terrain restrictions on release. The refinery reserves a 6 × 5 footprint; its dock is a separate, walkable cell outside that footprint. Rock footprints include a conservative clearance margin.

A* uses a binary min-heap, deterministic neighbor order and tie-breaking, movement costs, optional diagonals, and no diagonal corner-cutting. It returns `null` for invalid or unreachable goals and an empty path when already at the goal. Mining approaches are chosen outside deposit occupancy and within extraction range. `NavigationService` is the replacement boundary for future navigation methods.

## Commands and receiving resources

`CommandBus` validates orders, copies their input data, bounds its queue, and executes only at simulation tick boundaries. MOVE, HARVEST, RETURN_CARGO, STOP, and AUTO have real implementations. The UI enqueues orders; it never writes unit transforms or cargo. Autonomous work and targeted orders use the same routing, extraction, and delivery methods.

`ResourceReceiver` is the docking/economy boundary. The refinery can reserve the dock for a stable entity ID, reject another unit, release a reservation, and accept a typed resource amount. A fleet queue is deliberately absent.

## Presentation and scheduling

The browser host owns requestAnimationFrame scheduling in `GameRuntime.start`. It advances the fixed clock independently of R3F and publishes compact HUD snapshots through a scoped Zustand store about eight times per second. Scene readiness only gates startup; it never supplies gameplay rules.

R3F `useFrame` callbacks interpolate previous/current simulation positions and headings, align the vehicle with terrain, animate imported model components, move authored particles, and control the camera. React does not rerender units every frame. GLB hierarchies are cloned per entity while geometries and materials stay shared. Particles use instancing. Cached model resources are not disposed by individual instances; temporary debug geometry is explicitly disposed.

Postprocessing combines fine temporal noise, radially modulated chromatic separation, and a subtle vignette. Settings can be changed or disabled without affecting gameplay. The orthographic camera controller owns bounds, zoom, keyboard state, drag input, and smoothing independently of entities.

## Adding content

For another unit definition, add typed tuning and capability data, instantiate it with a stable ID, and give it authoritative state owned by the world. Extract systems from the current one-unit simulation as an actual second unit needs them; do not introduce a speculative ECS framework. Add command routing by unit ID, receiver scheduling, and navigation clearance before enabling simultaneous units.

For a building, define a footprint and a separate accessible interaction point. Implement `ResourceReceiver` only if it accepts cargo. Rendering uses an imported GLB at the entity's world transform.

For a resource, extend `ResourceType` and economy balances, define extraction/storage compatibility, then add a Blender-authored visual. Keep resource amounts and depletion authoritative in the simulation.

`npm run architecture:check` enforces the framework-free gameplay boundary and disallows runtime primitive world geometry. It is a lightweight regression guard, not a general static-analysis engine.
