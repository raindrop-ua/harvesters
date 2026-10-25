# Project Specification: Desert RTS — Vertical Slice 0.1

## 1. Project Overview

Build a browser-based, isometric 3D real-time strategy (RTS) prototype inspired by classic desert RTS games such as _Dune II_, with a visual style inspired by Unity's _Tanks!_ sample project.

The project must use **React, React Three Fiber, TypeScript, and Blender-authored 3D assets**.

The initial prototype is deliberately small. It should feature a stylized desert environment, one Refinery building, one autonomous Harvester vehicle, and several blue/cyan mineral deposits.

The Harvester must automatically travel to mineral deposits, collect resources, return to the Refinery, unload its cargo, and repeat.

This is the foundation of a potentially much larger RTS game. Architecture, modularity, maintainability, and extensibility are first-class requirements.

**Primary objective:** Deliver a visually appealing, fully functional, extensible RTS foundation rather than a disposable technical demo.

---

## 2. Technology Stack

### Core

- TypeScript (strict mode)
- React
- React Three Fiber (`@react-three/fiber`)
- Three.js
- `@react-three/drei`
- Vite
- Zustand for UI/application state where appropriate

### Supporting libraries

- `@react-three/postprocessing` and compatible postprocessing dependencies
- A lightweight pathfinding implementation using A*
- Vitest for unit and simulation tests
- ESLint and Prettier

Use a deterministic, framework-independent simulation layer rather than React state for gameplay logic.

Avoid unnecessary dependencies.

The game must run locally using:

```bash
npm install
npm run dev
```

Provide build, lint, typecheck, and test scripts.

---

## 3. Art Direction

### 3.1 Visual Style

The art direction should resemble the playful, polished, stylized low-poly aesthetic of Unity's _Tanks!_ sample.

Key characteristics:

- Stylized low-poly to lightweight mid-poly geometry
- Strong, readable silhouettes
- Soft beveled edges
- Simplified but recognizable mechanical details
- Clean geometric shapes
- Slightly exaggerated proportions
- Bright but controlled colors
- Matte materials with subtle roughness variation
- Soft shadows and warm directional lighting
- No photorealistic textures
- No excessive surface detail

The overall look should feel like a professionally designed miniature tabletop battlefield.

Avoid making the models look like placeholder cubes, cylinders, and cones.

Low-poly does not mean visually unfinished.

### 3.2 Color Palette

Environment:

- Warm golden sand
- Muted orange
- Sandy beige
- Terracotta
- Brown rocks

Industrial assets:

- Light beige armor
- Dark gray mechanical parts
- Muted red/orange faction accents
- Dark rubber tracks
- Subtle emissive lights

Resources:

- Bright cyan
- Electric blue
- Turquoise
- Subtle blue emission

Use consistent materials and colors across all assets.

### 3.3 Visual Readability

All assets must be recognizable from an elevated RTS camera.

Prioritize silhouettes over small details.

The Harvester should look like a heavy industrial mining vehicle.

The Refinery should immediately communicate its purpose as a processing facility.

---

## 4. Blender-First Asset Pipeline

**This is a strict requirement.**

All visible game-world geometry must originate from Blender.

Do not construct game models using Three.js primitives such as `BoxGeometry`, `CylinderGeometry`, `SphereGeometry`, or similar.

Do not procedurally assemble the Harvester, Refinery, rocks, crystals, or terrain meshes using React Three Fiber.

Instead:

1. Create the assets in Blender.
2. Save the original `.blend` files.
3. Export assets to `.glb`.
4. Import the GLB files into React Three Fiber.
5. Render and animate the imported models.

Blender may be used through Python scripting to generate the initial models.

The asset-generation scripts must be included in the repository so the models can be regenerated.

### 4.1 Required Assets

Create the following Blender assets:

- `harvester.blend` / `harvester.glb`
- `refinery.blend` / `refinery.glb`
- `terrain.blend` / `terrain.glb`
- `rocks.blend` / `rocks.glb`
- `minerals.blend` / `minerals.glb`

Additional reusable asset files are allowed.

### 4.2 Modeling Requirements

Models must have:

- Correct transforms and scale
- Consistent world-unit conventions
- Meaningful object names
- Appropriate origins/pivots
- Reusable materials
- Organized collections
- Reasonable polygon counts
- No unnecessary hidden geometry

Use a consistent axis convention between Blender and Three.js.

For example, use Y-up in the runtime and handle Blender's Z-up coordinate system during export.

### 4.3 Animation-Ready Structure

The Harvester model should contain logically separated components:

- Main chassis
- Left track assembly
- Right track assembly
- Mining equipment
- Cargo container
- Optional mechanical attachments

The Refinery should contain:

- Main processing structure
- Harvester docking entrance
- Storage tanks
- Chimneys or ventilation structures
- Optional animated machinery

Components that may need animation later must be separate Blender objects or nodes.

Avoid merging everything into one unmodifiable mesh.

### 4.4 Asset Modification Workflow

It must be possible to modify the Harvester or Refinery in Blender, re-export the GLB, and see the updated asset in the game without rewriting rendering code.

Keep Blender source files under version control.

Provide a repeatable asset-export workflow.

If Blender is unavailable in the execution environment, do not silently replace assets with Three.js primitives. Clearly report the limitation and preserve the Blender-first requirement.

---

## 5. Environment

### 5.1 Desert Map

Create a small desert battlefield approximately 64×64 logical grid cells.

Use a configurable grid cell size, initially 2 world units.

The environment should contain:

- A large sandy playable area
- Several gently elevated hills
- A few rocky formations
- Subtle terrain elevation changes
- Several blue/cyan mineral deposits
- One Refinery
- One Harvester

The terrain should feel natural but remain visually readable.

Avoid extreme height differences or complicated terrain.

### 5.2 Terrain Modeling

Create the terrain mesh in Blender.

It may be generated procedurally using Blender Python scripts.

Use:

- Low-poly triangulated terrain
- Gentle elevation variation
- Flat or subtly faceted shading
- Smooth visual transitions where appropriate
- Natural hill placement

The terrain must be compatible with the gameplay navigation grid.

Do not generate the visible terrain mesh using Three.js geometry APIs.

### 5.3 Logical Grid

Implement a logical grid independent of the visual terrain.

Each cell should support metadata such as:

```ts
interface GridCell {
  x: number
  z: number
  height: number
  walkable: boolean
  buildable: boolean
  terrainType: TerrainType
  movementCost: number
  occupiedBy?: EntityId
}
```

The grid should support:

- World-to-grid conversion
- Grid-to-world conversion
- Occupancy checks
- Pathfinding
- Terrain height sampling
- Building footprints
- Movement restrictions
- Future construction placement
- Future unit navigation

The grid must not need to be visually displayed during normal gameplay.

Add a developer/debug option to display it.

### 5.4 Terrain and Navigation Consistency

Terrain elevation and navigation metadata must remain synchronized.

Prefer generating both the Blender terrain and grid metadata from a shared terrain definition or deterministic generation seed.

Do not manually maintain two unrelated representations of the same terrain.

---

## 6. Camera

Use an orthographic RTS camera.

### Requirements

- Elevated isometric-like perspective
- Approximately 45–60 degrees downward
- Default angle around 55 degrees
- Smooth movement
- Smooth zoom
- WASD movement
- Mouse wheel zoom
- Optional edge scrolling
- Configurable movement and zoom speeds
- Reasonable camera bounds

The camera should show the Refinery, Harvester, and nearby mineral deposits clearly.

Camera behavior must be implemented as a reusable controller, independent of gameplay entities.

Do not implement unrestricted free-flight camera movement.

---

## 7. Harvester

### 7.1 Appearance

Create a stylized industrial tracked mining vehicle.

Visual characteristics:

- Wide, heavy chassis
- Large continuous tracks
- Front-mounted mining mechanism
- Rear cargo compartment
- Beige industrial armor
- Dark mechanical components
- Red/orange accent panels
- Small lights
- Readable silhouette from above

The model should be visually interesting but reasonably lightweight.

Target a modest polygon budget appropriate for an RTS with potentially many units.

### 7.2 Movement

The Harvester must:

- Navigate using the logical grid
- Follow computed paths
- Turn smoothly
- Accelerate and decelerate
- Respect terrain obstacles
- Avoid entering blocked cells
- Follow terrain elevation
- Maintain correct orientation on gentle slopes

Movement must be time-step based and independent of rendering frame rate.

The visual transform should interpolate between simulation states.

### 7.3 Autonomous Resource Cycle

Implement the following behavior:

```text
IDLE
  ↓
FIND_RESOURCE
  ↓
MOVE_TO_RESOURCE
  ↓
HARVEST
  ↓
CARGO_FULL
  ↓
MOVE_TO_REFINERY
  ↓
DOCK
  ↓
UNLOAD
  ↓
FIND_RESOURCE
  ↺
```

Use a clean state machine or equivalent explicit behavior model.

The Harvester must:

1. Find a suitable mineral deposit.
2. Calculate a valid path.
3. Travel to the deposit.
4. Stop within harvesting range.
5. Collect resources over time.
6. Increase its cargo amount.
7. Return to the Refinery when full or when the deposit is depleted.
8. Navigate to a valid docking location.
9. Unload resources over time.
10. Increase the player's stored resources.
11. Repeat automatically.

All speeds, capacities, and timings must be configurable.

Handle edge cases such as:

- No available minerals
- Depleted mineral deposits
- Unreachable deposits
- Blocked docking locations
- Invalidated paths
- Harvester already carrying cargo
- No available Refinery

Avoid infinite retry loops.

### 7.4 Harvester Visual Feedback

Add simple visual effects:

- Moving track animation or texture scrolling
- Subtle dust particles while driving
- Mining equipment animation while harvesting
- Cyan particles or glow near active mineral extraction
- Visible cargo fill indicator or simple cargo representation
- Brief unloading feedback at the Refinery

Keep effects lightweight and suitable for browser performance.

---

## 8. Refinery

### 8.1 Appearance

Create a stylized industrial processing building.

The Refinery should include:

- A large central structure
- An obvious Harvester entrance
- A docking/unloading area
- Processing tanks
- Pipes
- Ventilation structures
- One or two chimneys
- Small orange or red accent panels

The silhouette should be distinctive and recognizable from an RTS camera.

### 8.2 Grid Footprint

The Refinery must occupy multiple logical grid cells.

For example:

```ts
footprint: {
  width: 6,
  height: 5
}
```

Its occupied cells must be marked as non-walkable.

The docking location must be represented separately from the building's occupied footprint.

A Harvester must never need to pathfind through blocked building cells to reach the docking location.

### 8.3 Docking and Unloading

The Refinery must expose a docking interface.

Example:

```ts
interface ResourceReceiver {
  canAccept(unitId: EntityId): boolean
  getDockingPosition(): GridPosition
  receiveResources(resourceType: ResourceType, amount: number): number
}
```

The exact interface may differ if a better design is justified.

The Refinery must:

- Accept the Harvester
- Receive cargo
- Update the resource economy
- Provide unloading feedback
- Allow the Harvester to resume its autonomous cycle

Design docking to support multiple Harvesters in the future, even though only one exists initially.

Do not implement a complex queueing system unless necessary.

---

## 9. Mineral Deposits

Create visually attractive blue/cyan crystal clusters in Blender.

### Appearance

- Angular crystalline formations
- Several crystal sizes
- Bright cyan and turquoise surfaces
- Subtle emissive highlights
- Faceted geometry
- Small clusters distributed across the sand

Avoid excessive bloom.

The minerals should look valuable and immediately recognizable.

### Gameplay

Each mineral deposit must have:

- Unique ID
- Grid position
- Resource amount
- Resource type
- Harvesting radius
- Depletion state

Harvesting must decrease the deposit's available resources.

When depleted, the deposit should visually disappear, shrink, or switch to a depleted appearance.

The resource system must support additional resource types in the future.

---

## 10. Simulation Architecture

**The simulation must not depend on React, React Three Fiber, or Three.js.**

Separate gameplay state from rendering.

The simulation should be independently testable in Node.js.

### Suggested Architecture

```text
src/
├── app/
│   ├── App.tsx
│   └── providers/
│
├── game/
│   ├── core/
│   │   ├── Game.ts
│   │   ├── GameLoop.ts
│   │   ├── EntityId.ts
│   │   └── GameConfig.ts
│   │
│   ├── simulation/
│   │   ├── World.ts
│   │   ├── Simulation.ts
│   │   ├── systems/
│   │   └── components/
│   │
│   ├── entities/
│   │   ├── units/
│   │   ├── buildings/
│   │   └── resources/
│   │
│   ├── navigation/
│   │   ├── Grid.ts
│   │   ├── Pathfinder.ts
│   │   └── NavigationService.ts
│   │
│   ├── commands/
│   │   ├── GameCommand.ts
│   │   ├── CommandBus.ts
│   │   └── handlers/
│   │
│   ├── economy/
│   │   ├── ResourceTypes.ts
│   │   └── ResourceSystem.ts
│   │
│   └── ai/
│       └── HarvesterBehavior.ts
│
├── rendering/
│   ├── GameScene.tsx
│   ├── camera/
│   ├── terrain/
│   ├── entities/
│   ├── effects/
│   ├── materials/
│   └── postprocessing/
│
├── input/
│   ├── InputController.ts
│   ├── SelectionController.ts
│   └── CommandController.ts
│
├── ui/
│   ├── HUD.tsx
│   ├── ResourceCounter.tsx
│   └── DebugPanel.tsx
│
├── assets/
│   ├── models/
│   └── materials/
│
└── utils/
```

This is a suggested structure, not a requirement to create dozens of empty files.

Favor cohesive modules and meaningful abstractions.

### 10.1 Core Principles

- Separation of concerns
- Composition over inheritance
- Data-driven entity definitions
- Explicit ownership of mutable state
- Dependency injection where useful
- Minimal coupling between systems
- No circular dependencies
- Strict TypeScript types
- No global mutable gameplay state
- Avoid giant manager classes
- Avoid unnecessary design patterns

Do not overengineer.

Create abstractions when they represent real boundaries or known extension points.

### 10.2 Game Loop

Use a fixed-step simulation.

Suggested simulation frequency:

```ts
const SIMULATION_TICK_RATE = 20
const FIXED_DELTA_TIME = 1 / SIMULATION_TICK_RATE
```

Rendering should run independently using `requestAnimationFrame`, managed by React Three Fiber.

Use interpolation to avoid visibly stepped movement.

Handle accumulated time and limit catch-up steps to prevent spiral-of-death behavior.

### 10.3 Entity Architecture

Use a lightweight entity-component approach or a similarly extensible composition-based model.

Do not introduce a heavyweight ECS framework unless it provides a clear benefit.

Entities should have stable IDs.

Examples of future entity capabilities:

- Position
- Rotation
- Movement
- Health
- Cargo
- Resource extraction
- Resource storage
- Production
- Ownership
- Selectability
- Command execution

Entity definitions should be data-driven where practical.

---

## 11. Unit Commands and Future Player Control

Although the Harvester operates autonomously in this prototype, the architecture must support player-issued commands from the beginning.

Implement a command abstraction such as:

```ts
type UnitCommand =
  | {
      type: 'MOVE'
      unitId: EntityId
      destination: GridPosition
    }
  | {
      type: 'HARVEST'
      unitId: EntityId
      resourceId: EntityId
    }
  | {
      type: 'RETURN_CARGO'
      unitId: EntityId
    }
  | {
      type: 'STOP'
      unitId: EntityId
    }
```

Autonomous behavior and future player input should use compatible command execution pathways.

Avoid directly changing unit positions from UI components.

The system must support future features such as:

- Unit selection
- Right-click movement
- Multiple selected units
- Command queues
- Attack commands
- Patrol commands
- Hold position
- Rally points

### Initial Interaction

Implement at least:

- Click to select the Harvester
- Visual selection indicator
- Basic information panel showing current state and cargo

The Harvester should continue operating autonomously.

Manual movement can remain disabled in the default gameplay mode, but the command infrastructure must be functional and testable.

---

## 12. Pathfinding

Implement A* pathfinding over the logical grid.

Requirements:

- Blocked cells
- Building footprints
- Terrain movement costs
- Optional diagonal movement
- Valid start and destination handling
- Path reconstruction
- Unreachable destination handling
- Configurable unit movement rules

Use deterministic tie-breaking where practical.

Keep the navigation API independent of Three.js.

The architecture should allow replacing A* with flow fields or hierarchical navigation later.

Do not implement advanced multi-agent collision avoidance yet.

---

## 13. Rendering Architecture

React Three Fiber should act as a presentation layer.

Gameplay simulation must remain authoritative.

Rendering components should consume simulation snapshots or observable view data.

Avoid putting core gameplay logic inside `useFrame`.

`useFrame` may handle:

- Visual interpolation
- Camera updates
- Particle animation
- Animation playback
- Rendering-only effects

Do not use React state updates every frame for every unit.

Prefer efficient subscriptions or a dedicated simulation-to-rendering bridge.

Design the rendering layer to eventually support many units.

---

## 14. Postprocessing and Shaders

Implement a subtle, stylized postprocessing pipeline.

### 14.1 Film Grain / Noise

Add a lightweight screen-space noise effect.

Requirements:

- Fine-grained noise
- Low intensity
- Subtle temporal variation
- Configurable strength
- Minimal impact on visual clarity

The effect should give the scene a slightly textured, cinematic appearance without looking like heavy film grain.

### 14.2 Chromatic Aberration

Add subtle chromatic aberration near the edges of the screen.

Requirements:

- Minimal distortion in the center
- Gradually increasing RGB separation toward screen edges
- Very low default intensity
- No distracting color fringes
- Configurable strength

Prefer a custom radial chromatic aberration shader if the available library effect does not provide sufficient control.

The result should be barely noticeable during gameplay.

### 14.3 Effect Controls

Expose settings for:

```ts
interface PostProcessingSettings {
  enabled: boolean
  grainIntensity: number
  chromaticAberrationIntensity: number
  vignetteIntensity: number
}
```

Add a small developer settings panel for adjusting these values.

Allow all postprocessing effects to be disabled.

Avoid expensive effects unless justified.

### 14.4 Lighting

Use:

- Warm directional sunlight
- Ambient or hemisphere lighting
- Soft shadows
- Consistent tone mapping
- Correct color-space handling

Optional ambient occlusion may be used if performance allows.

Do not rely on postprocessing to compensate for poor asset design or lighting.

---

## 15. UI / HUD

Keep the initial UI minimal.

Required elements:

- Current stored mineral amount
- Harvester cargo amount
- Harvester current state
- Selected entity information
- Optional debug controls

Use React HTML components for the HUD.

The interface should be clean, compact, and unobtrusive.

Avoid implementing a full RTS construction menu.

---

## 16. Performance Requirements

Target smooth performance on a modern desktop browser.

Design with future expansion to dozens or hundreds of units in mind.

Important considerations:

- Reuse materials and geometries where practical
- Avoid excessive draw calls
- Use instancing for repeated static assets when appropriate
- Avoid unnecessary React rerenders
- Keep simulation independent of rendering FPS
- Avoid per-frame allocations in hot paths
- Dispose of GPU resources correctly
- Use reasonable shadow settings
- Keep postprocessing lightweight

Do not prematurely optimize every subsystem.

Establish sensible architectural foundations and measure before adding complexity.

---

## 17. Configuration and Data-Driven Design

Avoid hardcoding gameplay parameters throughout the source code.

Create centralized configuration for:

- Grid size
- Cell size
- Camera settings
- Movement speeds
- Harvester cargo capacity
- Harvesting rate
- Unloading rate
- Mineral deposit quantities
- Simulation tick rate
- Visual effect intensities

Prefer typed configuration objects.

The architecture should eventually support multiple unit and building definitions without duplicating implementation logic.

---

## 18. Testing

Add meaningful automated tests for core simulation behavior.

At minimum, test:

1. World-to-grid and grid-to-world conversion.
2. Grid occupancy.
3. A* pathfinding around obstacles.
4. Unreachable destinations.
5. Harvester state transitions.
6. Resource collection.
7. Cargo capacity enforcement.
8. Refinery unloading.
9. Resource economy updates.
10. Resource depletion.
11. Handling unavailable resource deposits.
12. Command validation and execution.

Tests must run without a browser or WebGL context.

Prefer deterministic tests with controlled simulation ticks.

---

## 19. Developer Experience

Provide:

- Clear README
- Setup instructions
- Development commands
- Asset-generation instructions
- Architecture overview
- Explanation of the simulation/rendering boundary
- Instructions for adding a new unit
- Instructions for replacing Blender assets
- Known limitations

Add a debug panel with useful options:

- Show/hide logical grid
- Show/hide navigation paths
- Pause/resume simulation
- Adjust simulation speed
- Toggle postprocessing
- Inspect Harvester state

Debug visualization may use rendering primitives such as lines and overlays. The Blender-only geometry rule applies to actual game-world assets, not developer visualization helpers.

---

## 20. Initial Scene Setup

When the application launches:

1. The desert terrain is loaded.
2. The camera focuses on the playable area.
3. The Refinery is placed on suitable terrain.
4. The Harvester is placed near the Refinery.
5. Several mineral deposits are distributed around the map.
6. The simulation starts automatically.
7. The Harvester finds a mineral deposit.
8. The Harvester travels to it.
9. Mining begins.
10. Cargo gradually fills.
11. The Harvester returns to the Refinery.
12. Resources are unloaded.
13. The player's mineral balance increases.
14. The cycle repeats.

The entire process should be observable without user interaction.

The default scene should look intentionally composed and aesthetically pleasing.

---

## 21. Acceptance Criteria

The prototype is complete when:

- [ ] The project starts successfully with `npm run dev`.
- [ ] The application builds without TypeScript errors.
- [ ] All visible game-world models are authored in Blender.
- [ ] Original `.blend` files are included.
- [ ] GLB exports load correctly.
- [ ] The desert contains several hills and rock formations.
- [ ] The Refinery and Harvester have recognizable stylized models.
- [ ] Blue/cyan mineral deposits are visible.
- [ ] The world uses a functioning logical grid.
- [ ] The Refinery blocks navigation across its footprint.
- [ ] The Harvester navigates around obstacles.
- [ ] The Harvester automatically mines minerals.
- [ ] The Harvester returns to the Refinery.
- [ ] Cargo unloading increases the player's resource balance.
- [ ] Depleted deposits are handled correctly.
- [ ] The Harvester can be selected.
- [ ] Its current state and cargo are visible in the HUD.
- [ ] The command infrastructure exists and is tested.
- [ ] The camera supports movement and zoom.
- [ ] Subtle noise/grain postprocessing is implemented.
- [ ] Subtle edge-based chromatic aberration is implemented.
- [ ] Core gameplay logic is independent of React and Three.js.
- [ ] Core simulation tests pass.
- [ ] README and asset workflow documentation are provided.

---

## 22. Explicitly Out of Scope

Do not implement:

- Combat
- Enemy AI
- Additional unit types
- Additional buildings
- Base construction
- Multiplayer
- Fog of war
- Tech trees
- Unit production
- Save/load functionality
- Advanced physics
- Complex collision avoidance
- Full RTS command UI
- Campaign missions
- Procedural infinite worlds

Do not add features simply because they are common in RTS games.

Focus on making this small vertical slice polished, stable, and architecturally sound.

---

## 23. Implementation Strategy

Implement the project in logical stages:

**Stage 1 — Foundation**

Set up the project, TypeScript configuration, game loop, logical grid, simulation interfaces, and test infrastructure.

**Stage 2 — Blender Assets**

Create and export the terrain, Refinery, Harvester, rocks, and mineral deposits.

Ensure Blender source files and repeatable export scripts are included.

**Stage 3 — Rendering**

Load the GLB assets, implement the camera, lighting, shadows, and basic scene composition.

**Stage 4 — Simulation**

Implement entity state, pathfinding, Harvester behavior, resource extraction, and Refinery unloading.

**Stage 5 — Interaction**

Add entity selection, HUD, debug visualization, and command infrastructure.

**Stage 6 — Visual Polish**

Add dust, mining effects, basic mechanical animations, film grain, chromatic aberration, and final lighting adjustments.

**Stage 7 — Validation**

Run tests, type checking, linting, and production build. Verify the full autonomous harvesting loop in the running application.

Do not leave critical functionality as TODOs or pseudocode.

---

## 24. Final Engineering Instructions

Treat this project as the beginning of a long-lived RTS codebase.

Make pragmatic architectural decisions that will remain useful as the game grows.

Prioritize:

1. Correct gameplay behavior.
2. Clean separation between simulation and rendering.
3. Blender-based, editable art assets.
4. Grid-based navigation and world representation.
5. Maintainable TypeScript architecture.
6. Visually coherent stylized graphics.
7. Smooth browser performance.
8. Ease of adding future content.

Do not build an unnecessarily elaborate engine before the first gameplay loop works.

Avoid speculative abstractions and premature optimization.

Use interfaces and modularity to isolate meaningful responsibilities, not to increase the number of files.

**Most importantly: build a working game prototype, not merely an attractive static scene.**

The finished application should show a charming low-poly desert RTS world where a small industrial Harvester continuously mines glowing blue crystals and delivers them to a Refinery.

The scene should already feel like the beginning of a real strategy game.

### Delivery Expectations

Complete the implementation, not just the architecture proposal.

Provide the source code, Blender assets, generated GLB files, automated tests, and documentation.

Run the available validation commands and report their results.

If a requirement cannot be completed, clearly identify the limitation rather than silently substituting an incompatible implementation.
