# Two harvesters, one refinery

Both H-01 and H-02 operate automatically. Select either vehicle in the world or use the two fleet buttons above the unit card. Locate, Hold, Autopilot, and Return affect only the selected unit. Both markers appear on the minimap; debug paths show both routes.

## Shared port

A returning vehicle requests a place in the refinery's FIFO queue, then travels to its assigned waiting bay. The unit at the front receives exclusive access when the previous owner has fully cleared the approach. Waiting keeps its cargo unchanged. The status below the sector label shows the owner and number waiting; the selected unit's message shows its place.

The owner follows the shared approach to one exact grid-cell center, stops, turns nose first toward the entrance, and holds the correct pose for the docking interval. Cargo transfer requires all of these conditions on every simulation tick:

- The refinery reservation belongs to this unit.
- The dock is walkable.
- Position error is at most 0.08 m.
- Heading error is at most 0.025 radians (about 1.4 degrees).
- The unit has stopped.

The entrance, apron, and lane markings in `refinery.blend` align with this point. After unloading, the vehicle reverses out while facing the refinery and then drives to either clear exit. Only then is the reservation released. Nearby units keep a configured separation, yield, and replan from their actual positions.

Holding a waiting unit removes its request while retaining cargo. Holding a unit inside the port retains its reservation so another vehicle cannot drive into it. Autopilot resumes docking or departure as appropriate. A physically obstructed waiting bay is skipped when assigning a new request.

## Mineral depletion

Each deposit retains seven named Blender crystal meshes. Depletion progressively removes prisms and scales the currently depleted prism between whole stages. The remaining cluster also shrinks slightly. The labels show exact remaining percentages and five grades:

| Remaining            | Grade    |
| -------------------- | -------- |
| Above 75%            | RICH     |
| Above 50%, up to 75% | WORKED   |
| Above 25%, up to 50% | LOW      |
| Above 0%, up to 25%  | TRACE    |
| 0%                   | DEPLETED |

Both units withdraw from the same authoritative amount. Resource availability, cargo capacity, and economy conservation remain independent of rendering. When practical, units prefer separate deposits and avoid claiming overlapping mining positions.

The grid layout defines the dock, approach, primary exit, heading, and waiting slots in `assets/world.json`. Movement, separation, alignment tolerances, transfer rates, and resource preferences live in `src/game/config.ts`. This is a small two-unit traffic model, not a general solution for hundreds of agents.
