# Architecture

## Authoritative simulation

`World` owns mutable gameplay state: the grid, units, deposits, resource economy, and refinery receiver. Every application instance creates its own `GameRuntime` and `World`. There is no global mutable gameplay singleton.

`Simulation.step(dt)` is framework-independent. `FixedLoop` runs it at 20 Hz with a bounded accumulator, eight maximum catch-up steps, and a floating-point tolerance at tick boundaries. Rendering speed cannot change harvesting or travel outcomes. Excess hidden-tab time is discarded rather than replayed. Unit tests compare 30 and 144 FPS host schedules.

Each harvester owns a `HarvesterBehavior`. `Simulation` owns deterministic tick ordering and dispatches commands by entity ID. After applying commands, `MineralRegeneration` restores resting fields before the unit behaviors run. Both behaviors share the world, capacity-limited renewable deposits, FIFO receiver, and economy. Each uses an explicit state machine:

```text
IDLE → FIND_RESOURCE → MOVE_TO_RESOURCE → HARVEST → CARGO_FULL
                                                   ↓
              MOVE_TO_QUEUE → WAIT_FOR_DOCK → MOVE_TO_REFINERY
                                                   ↓
                      FIND_RESOURCE ← LEAVE_REFINERY ← UNDOCK ← UNLOAD ← DOCK
```

Missing resources, unavailable refineries, and inaccessible docks produce bounded retries with cargo retained. Autonomous units wait for a configured useful reserve, then resume when a field recovers. Paths are checked before each movement step. A changed path triggers replanning. Resource transfer preserves the sum of remaining deposits, cargo, and stored minerals, with actual regrowth tracked in `World.regenerated`. The conserved total equals initial reserves plus regenerated minerals. A full-map fleet test with regrowth disabled checks finite completion; renewable-map tests cover repeated deliveries from a completely exhausted map, conservation, and unit separation.

## Navigation and terrain

The visible terrain and navigation metadata are generated together in Blender from `assets/world.json`. `Grid.heightAt` uses barycentric sampling of exactly the exported mesh's two triangles per cell. `assets:check` compares every navigation vertex against its actual optimized GLB position.

Grid cells expose terrain height, movement cost, buildability, walkability, and occupancy. Layered occupancy preserves a rock when an overlapping finite deposit disappears and restores original terrain restrictions on release. Renewable deposits keep their footprint while empty, preventing regrowth under a vehicle or inside an active route. The refinery reserves a 6 × 5 footprint; its dock is a separate, walkable cell outside that footprint. Rock footprints include a conservative clearance margin.

Courtyard reserves an 8 × 7 cell footprint west of the refinery, with four clear grid columns (8 m) between the building footprints. Its level foundation is placed at the highest existing terrain point under the footprint. Terrain/navigation heights are unchanged. Static building position and footprint also drive its world label and minimap marker. Courtyard currently supplies the authored building and navigation obstacle, without a production or building-placement system.

A* uses a binary min-heap, deterministic neighbor order and tie-breaking, movement costs, optional diagonals, and no diagonal corner-cutting. It returns `null` for invalid or unreachable goals and an empty path when already at the goal. Mining approaches are chosen outside deposit occupancy and within extraction range. Routes also avoid the other unit and the reserved dock corridor. A first-step predicate checks the continuous segment from an off-center unit position after replanning, preventing nose-to-nose deadlocks. Nearby units yield and replan; occupied mining approach positions are kept separate. `NavigationService` is the replacement boundary for future navigation methods.

## Commands and receiving resources

`CommandBus` validates orders, copies their input data, bounds its queue, and executes only at simulation tick boundaries. MOVE, HARVEST, RETURN_CARGO, STOP, and AUTO have real implementations. The UI enqueues orders; it never writes unit transforms or cargo. Autonomous work and targeted orders use the same routing, extraction, and delivery methods.

`Simulation.previewMove` is a read-only reachability query shared by cursor feedback and MOVE validation. It uses the same pathfinding, vehicle separation, reserved dock corridor, and safe first-segment checks as movement execution. Commands are checked again when the queue flushes; a newly obstructed destination does not interrupt autonomous work. Manual movement retains cargo, disables autonomy, and ends in STOPPED until the player selects Autopilot.

Map input lives in `src/rendering/input/`. The nearest terrain, unit, or obstacle consumes R3F pointer events, preventing click-through orders. Left clicks with at most five pixels of pointer travel issue MOVE; unit clicks select, and camera drags are ignored by orders. Hover targets are transient runtime input data, outside the React store. The cursor refreshes raycasting and reachability at 10 Hz, including under a moving camera. Accepted/rejected feedback uses a short-lived DOM reticle projected to its world position; it adds no game-world geometry. Public SVG cursors indicate movement and blocked destinations. Speech is triggered synchronously only after enqueue succeeds, using one channel shared with selection voices.

`ResourceReceiver` is the docking/economy boundary. The refinery can reserve the dock for a stable entity ID, reject another unit, release a reservation, and accept a typed resource amount. Requests enter a FIFO queue and retain stable, distinct waiting bays. The owner drives via the approach cell, reaches the exact dock point, stops, and aligns to the configured heading before transferring. Only the owner may credit the economy. Reservation remains held during reverse undocking and departure; either side of the apron can be used if the primary exit is blocked. STOP cancels a waiting request, but retains the lock for a unit physically inside the port.

## Presentation and scheduling

The browser host owns requestAnimationFrame scheduling in `GameRuntime.start`. It advances the fixed clock independently of R3F and publishes compact HUD snapshots through a scoped Zustand store about eight times per second. Scene readiness only gates startup; it never supplies gameplay rules.

R3F `useFrame` callbacks interpolate previous/current simulation positions and headings, align the vehicle with terrain, animate imported model components, move authored particles, and control the camera. React does not rerender units every frame. GLB hierarchies are cloned per entity while geometries and materials stay shared. Particles use instancing. Cached model resources are not disposed by individual instances; temporary debug geometry is explicitly disposed.

`HarvesterSuspension` samples signed forward velocity from consecutive authoritative positions and heading. Acceleration drives a restrained damped pitch spring, integrated with bounded render-time substeps. Positive acceleration lifts the nose, braking dips it, and reverse travel mirrors both. The target is capped at 0.04 radians, with a small settling overshoot. A retained presentation group pivots the five authored body/attachment nodes around a 1.25 m suspension height; track assemblies and tread nodes remain outside this pivot and follow terrain. Pause freezes the spring, and simulation speed scales its elapsed time. No gameplay state is changed by this animation. Tuning lives in `src/rendering/entities/harvesterMotion.ts`.

Dust uses the same signed movement measurement rather than the state name: it trails behind forward travel and ahead of reverse travel, including the tick that transitions out of UNDOCK. The two track plumes use the vehicle's interpolated position and heading. Existing Blender-authored particle meshes and the fixed instance budget are retained.

`RefinerySmoke` emits only while a unit with cargo is in UNLOAD and owns the receiver. Its source position is the refinery GLB's `SmokeOutlet` marker. A pool of 14 meshes shares the authored smoke geometry, with separately cloned transparent materials for independent fading. Simulation timestamps drive emission, rise, wind drift, expansion, and 3.8-second lifetimes; pause freezes all of them. Emission stops after unloading while live puffs finish dissipating. Owned materials are disposed on cleanup; cached GLB geometry remains shared. The initial camera frames both buildings, with compact views centered on the base midpoint.

World labels use one DOM overlay; `LabelProjection` updates its element transforms from the camera and interpolated unit positions without per-frame React state or additional React roots. Mineral geometry retains seven named Blender prisms. They shorten and disappear sequentially as the remaining amount decreases, then grow back as it recovers; the HUD snapshot provides percentage, grade, and regrowth indicators.

Postprocessing combines fine temporal noise, radially modulated chromatic separation, and a subtle vignette. Settings can be changed or disabled without affecting gameplay. The orthographic camera controller owns bounds, zoom, keyboard state, drag input, and smoothing independently of entities.

## Adding content

Spawn definitions live in `assets/world.json` under `harvesters`. Each gets a stable ID, independent state and behavior, shared GLB geometry/materials, particle instances, HUD selection, and minimap marker. The two-unit slice has two waiting slots; adding a larger fleet also requires additional slots and performance/traffic validation. Do not introduce an ECS framework before an actual capability needs it.

For a building, define a footprint and a separate accessible interaction point. Implement `ResourceReceiver` only if it accepts cargo. Rendering uses an imported GLB at the entity's world transform.

For a resource, extend `ResourceType` and economy balances, define extraction/storage compatibility, then add a Blender-authored visual. Keep resource amounts and depletion authoritative in the simulation.

`npm run architecture:check` enforces the framework-free gameplay boundary and disallows runtime primitive world geometry. It is a lightweight regression guard, not a general static-analysis engine.
