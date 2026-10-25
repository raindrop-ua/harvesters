# Validation — 25 October 2026

Validated locally with Node 24.18.0, Blender 5.2.3 LTS, React 19.3.1, R3F 9.8.2, Vite 7.3.7, and Vitest 5.0.5.

## Automated checks

`npm run validate` passes:

- Prettier formatting.
- Strict TypeScript type checking.
- ESLint.
- Simulation/rendering import boundaries and Blender-only world-geometry guard.
- **43 Node-only tests**, including grid conversions, exact triangle heights, overlapping occupancy, A* obstacles/costs/unreachable goals, all harvesting states, capacity, partial-load depletion, economy conservation, missing refineries, blocked docks, invalidated paths, commands, dock reservations, FPS-independent scheduling, bounded catch-up, selection voice playback, and background music.
- Music coverage includes all seven local MP3 assets, ordered playback and wraparound, initial activation, pause intent, hidden-tab resume, track selection, stale play promises, blocked playback retry, bounded failure handling, volume, and cleanup.
- A full-map fleet simulation mines and delivers all **3,660 minerals**, then both units idle with no resource loss or overlapping centers.
- GLB structure, required animation nodes, Blender provenance, and all **4,225 terrain vertex heights** match navigation data.
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

The built application was also served with `npm run preview -- --port 4173`. It completed a delivery of 120 minerals, retained a working canvas through repeated selection and postprocessing toggles, and made no external resource requests. Final desktop and portrait screenshots were captured from this production preview.

The music update was additionally checked in the production preview: no playback before interaction, successful MP3 decoding at 25% volume, direct selection of the seventh track, native end-of-track wraparound to the first, and working Pause. No console errors were recorded. All seven built MP3 files match their source assets byte for byte.

Screenshots from the local run are stored under ignored `artifacts/`, including the desktop scene, portrait scene, and navigation grid. They are local evidence rather than source assets.

## Remaining limits

The build emits Vite's advisory warning for the approximately 704 KB minified Three.js chunk (about 182 KB gzip). The scene is lazy-loaded and the engine is separately cached; the warning is retained rather than hidden by increasing the budget.

This pass is not a large-fleet benchmark or a Safari/Firefox certification. Desktop controls are primary. Touch panning and a responsive HUD exist, but pinch zoom, multi-unit collision avoidance, and large-fleet crowd navigation are outside this slice. The two-unit FIFO dock queue is implemented and tested.
