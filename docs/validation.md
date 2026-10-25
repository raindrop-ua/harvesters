# Validation — 25 October 2026

Validated locally with Node 24.18.0, Blender 5.2.3 LTS, React 19.3.1, R3F 9.8.2, Vite 7.3.7, and Vitest 5.0.5.

## Automated checks

`npm run validate` passes:

- Prettier formatting.
- Strict TypeScript type checking.
- ESLint.
- Simulation/rendering import boundaries and Blender-only world-geometry guard.
- **79 Node-only tests**, including grid conversions, exact triangle heights, overlapping occupancy, A* obstacles/costs/unreachable goals, construction-yard occupancy and passage traversal, all harvesting states, capacity, partial-load depletion, mineral regeneration, economy conservation, missing refineries, blocked docks, invalidated paths, player movement orders, dock reservations, FPS-independent scheduling, bounded catch-up, harvester suspension, smoke lifecycle, selection/movement speech, and background music.
- Music coverage includes all seven local MP3 assets, ordered playback and wraparound, initial activation, pause intent, hidden-tab resume, track selection, stale play promises, blocked playback retry, bounded failure handling, volume, and cleanup.
- With regeneration disabled, a full-map fleet simulation mines and delivers all **3,660 minerals**, then both units idle with no resource loss or overlapping centers.
- Regeneration tests cover 12 M/min per resting field, original-capacity limits, no growth during harvesting, dispatch reserve, automatic repeated deliveries after total exhaustion, conserved initial + regenerated resources, unchanged navigation reservations, Hold/Autopilot, small-capacity fields, pause, speed, and identical 30/144 FPS results.
- Presentation motion tests cover signed forward/reverse travel at four headings, acceleration/braking pitch, reverse symmetry, restrained peaks, settling, 30/144 FPS response, pause, and bounded integration after a large frame gap.
- Base tests verify the 56-cell courtyard footprint, eight-meter passage, rejection of MOVE orders into the yard, and an actual vehicle trip through the passage. Smoke tests cover activation, bounded pooling, no extra emission on frozen timestamps, stop/drain, repeated activation, and no burst after a long clock gap.
- Player-order tests cover walkable-but-unreachable goals, other units, reserved refinery approaches, revalidation after new obstacles, cargo retention, waiting at the destination, and Autopilot resumption. Audio tests verify all six distinct movement takes, complete random-pool coverage, separate repeat histories, one shared speech channel, and accepted-only acknowledgements.
- All eleven GLBs pass structure, required-node and Blender-provenance checks. Courtyard geometry fits its reserved footprint, and all **4,225 terrain vertex heights** match navigation data.
- Contextual-order tests cover per-unit capabilities, mining the clicked field, partial-load delivery, a field order received during unloading, rejection of empty/depleted/unreachable requests, all three tank classes moving/stopping, parked-unit clearance, shared collision previews, and smooth staggered idle scans. Voice tests cover harvesting/unloading confirmations and tank movement while rejected clicks remain silent.
- Production build.

`npm install` reported **0 dependency vulnerabilities** after updating Vitest to a patched release. This is a dependency advisory check, not an application security audit.

Both the full generation pipeline (`npm run assets:generate`) and export of existing sources (`npm run assets:export -- harvester terrain`) were executed successfully. The latter validates terrain topology and updates navigation heights without replacing the edited source files.

## Browser playtest

Chromium at 1440 × 1000 and 390 × 844:

- Actual GLBs load and render correctly.
- Autonomous travel, extraction, return, docking, unloading, and the next trip were observed; the mineral balance increased across successive deliveries.
- Pause freezes cargo/time; Hold retains cargo and Autopilot resumes work.
- Repeated deselection/reselection works; clicking the actual 3D vehicle selects it.
- WASD camera panning and mouse-wheel zoom visibly change the rendered scene.
- Grid/path debug controls and postprocessing settings work; disabling effects retains a visible canvas.
- Developer panel fits the narrow viewport; document width does not exceed the viewport.
- No JavaScript errors in the final clean playtest.
- Two-unit selection, independent Hold/Autopilot commands, real FIFO waiting with cargo retained, fixed nose-first unloading, reverse departure, and continued work by both units were observed.
- Mineral labels showed intermediate percentages and grades; individual authored prisms visibly receded.
- Music stays silent before user interaction, then starts at 25% volume. All seven files decoded and played; seeking near each track's end exercised native `ended` transitions through the playlist and back to the first track.
- Radio pause, Next while paused, Play, direct playlist selection, and volume changes work. Selecting harvesters still plays voices independently, without resuming intentionally paused music.
- The radio and expanded seven-track playlist fit both viewport sizes with no horizontal overflow. Music screenshots are saved as `artifacts/music-player-desktop.png` and `artifacts/music-playlist-mobile.png`.
- An instrumented browser run began with all five fields empty. At 119 simulation seconds both units still waited and each field held 23.8 M; after crossing the 24 M reserve both units resumed automatically. By 304 seconds each had completed four deliveries and the balance reached 221 M. Remaining deposits + cargo + stored minerals matched actual regrowth. Pausing froze growth; labels showed grade and REGROWING.
- With both units held for a further ten simulation minutes, the authored crystal clusters visibly returned to 15–25% capacity. Desktop and portrait screenshots verify growing geometry and regrowth labels; the document stays within the 390 px viewport. This uses temporary browser instrumentation to advance the real simulation, without changing production code or the configured regeneration rate.
- In a real MOVE trip, body pitch ranged from -0.043 to +0.045 radians and settled to approximately 0.00014 radians within 0.9 seconds of stopping. The track node retained zero local pitch while the five body nodes rocked independently. Pausing froze body pitch exactly; repeated fleet selection and clicking the actual body still worked.
- During actual reverse UNDOCK at 2.75 m/s, all 22 visible dust instances lay 1.52–3.62 m ahead of the vehicle's nose-relative origin; during forward travel they lay behind it. Reverse acceleration tilted the body in the opposite direction. The 4× speed control and 390 px portrait layout remained functional with no console errors. Screenshots are stored as `artifacts/harvester-forward-dust.png`, `artifacts/harvester-reverse-dust.png`, and `artifacts/harvester-motion-mobile.png`.

The built application was also served with `npm run preview -- --port 4173`. It completed a delivery of 120 minerals, retained a working canvas through repeated selection and postprocessing toggles, and made no external resource requests. Final desktop and portrait screenshots were captured from this production preview.

The music update was additionally checked in the production preview: no playback before interaction, successful MP3 decoding at 25% volume, direct selection of the seventh track, native end-of-track wraparound to the first, and working Pause. No console errors were recorded. All seven built MP3 files match their source assets byte for byte.

Screenshots from the local run are stored under ignored `artifacts/`, including the desktop scene, portrait scene, and navigation grid. They are local evidence rather than source assets.

Courtyard and refinery render together in the initial wide and portrait views. The yard has its own minimap marker and world label, and the page has no horizontal overflow at 390 px. A harvester visibly traversed the passage from world (-25, -9) to (-25, 11).

Real unloading produced smoke at the authored chimney outlet (-20.1, 8.77, -10). Pausing froze puff transforms and opacity exactly. After unloading, existing puffs remained briefly and then all dissipated; no smoke was visible in the initial idle state. Refinery mesh positions, normals, and triangle indices match the pre-upgrade GLB exactly. Local screenshots include `artifacts/courtyard-refinery-smoke.png`, `artifacts/courtyard-passage.png`, and `artifacts/courtyard-mobile.png`.

The final production preview additionally served the courtyard, refinery, and smoke GLBs successfully, completed autonomous unloading with visible chimney smoke, and rendered both buildings in portrait after a fresh load. No console errors were recorded. The final smoke and portrait screenshots come from this production build without temporary instrumentation.

Left-click movement was additionally exercised through actual pointer input at 1440 × 1000. Reachable ground uses the move SVG cursor and accepted reticle; the vehicle arrives at its selected grid center and retains selection. Clicking the Courtyard roof or a walkable-but-isolated goal shows rejection, plays no confirmation, and leaves the active move intact. Middle-button camera panning and left-button dragging emit no orders. Clicking the second vehicle selects it and uses its selection voice; Esc followed by a ground click issues no order.

All six movement MP3s decoded and played natively through real accepted clicks at 75% volume, using one media element. Paused orders retained the unit's position until resuming; Autopilot restarted harvesting afterwards. In a separate 390 × 844 touch context, a native touch swipe panned without issuing an order and a native tap issued MOVE. No horizontal overflow or console errors were observed. Screenshots include `artifacts/move-order-desktop.png`, `artifacts/move-order-blocked.png`, and `artifacts/move-order-mobile.png`.

The final production build was also served on port 4173 and checked without temporary game instrumentation: the move cursor, accepted reticle, native voice playback, paused-order execution, arrival, and Autopilot button all worked. All six built MP3s match the source assets byte for byte. The production screenshot is `artifacts/move-order-production.png`.

## Remaining limits

The build emits Vite's advisory warning for the approximately 704 KB minified Three.js chunk (about 182 KB gzip). The scene is lazy-loaded and the engine is separately cached; the warning is retained rather than hidden by increasing the budget.

This pass is not a large-fleet benchmark or a Safari/Firefox certification. Desktop controls are primary. Touch panning and a responsive HUD exist, but pinch zoom, multi-unit collision avoidance, and large-fleet crowd navigation are outside this slice. The two-unit FIFO dock queue is implemented and tested.

## Contextual orders and tank playtest

At 1440 × 1000, native pointer clicks selected the actual light-tank mesh, issued a ground MOVE, kept it queued while paused, and drove it to the exact target cell after resuming. All five fleet buttons select the appropriate unit; tank cards show class/mobility and MOVE/HOLD controls rather than cargo/autopilot controls.

A real crystal click showed the harvest cursor and HARVEST reticle, assigned H-01 to that exact field, and produced a partial load. A real Refinery-roof click showed the unload cursor and UNLOAD reticle, entered the shared dock flow, delivered that load, and retained the refinery lock through reverse departure. Accepted contextual orders used the existing voice pool. Light-tank clicks on the same crystals and refinery showed a blocked cursor/rejection, emitted no order voice, retained selection and left its position unchanged.

The heavy-tank render node followed authoritative turret yaw while the hull stayed fixed. A paused sample retained identical time, turret yaw and hull yaw; resuming produced another smooth scan. The nested muzzle marker followed the moving turret. Full-map simulation with all three parked tanks still delivered all 3,660 finite minerals; separation checks include every pair of vehicles.

At 390 × 844, all five fleet buttons and the selected tank controls remained visible with no horizontal overflow. Screenshots: `artifacts/tanks-staging.png`, `artifacts/tank-blocked.png`, `artifacts/tanks-desktop.png`, and `artifacts/tanks-mobile.png`. Browser-only runtime/scene inspection was injected through test routes, not shipped in application code.

A clean production preview on port 4173 loaded all three tank GLBs, exposed no test instrumentation, completed its first delivery, and produced no JavaScript errors. `artifacts/tanks-production.png` records the running five-unit scene with the heavy tank selected.

## Crystal glow and map boundary

Mineral-only bloom and slowly changing emissive facet colors were checked in an isolated browser page. Material samples changed after resuming simulation and stayed exactly equal while paused; each field owns three separate materials. The terrain's optional `DesertHorizon` is hidden and the scene background is `#000000`. Zoom/pan exposed the sharp playable boundary, with no accepted movement into black space.

A clean production preview loaded without JavaScript errors. Toggling postprocessing off/on restored glow, and a native crystal click still produced the HARVEST cursor/order. The 390 × 844 layout had no horizontal overflow. The translucent header keeps credits and controls readable over black. Screenshots: `artifacts/crystal-glow.png`, `artifacts/crystal-glow-boundary-production.png`, and `artifacts/crystal-glow-mobile.png`.

Graphics dependencies are grouped into one renderer chunk to avoid a circular chunk dependency introduced by selection-based bloom; the pre-existing large-graphics-bundle warning remains a size advisory.
