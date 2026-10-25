# Project guidance

Keep communication friendly and direct.

- Read `docs/specification.md` and preserve its vertical-slice scope.
- Keep `src/game` independent of React, Three.js, Zustand, browser APIs, and rendering.
- Advance gameplay only at fixed simulation ticks. `useFrame` is for presentation.
- Load game-world geometry from Blender GLBs; keep editable `.blend` sources and generation scripts. Code-generated debug lines are allowed.
- Preserve the shared terrain/navigation data contract and required animation node names.
- Send player orders through `CommandBus`; UI components must not mutate gameplay entities.
- Keep the HUD compact. Avoid adding construction, combat, or speculative engine systems.
- Use current Context7 documentation for library-specific setup and APIs; refactors and business-logic debugging do not require it.
- Run `npm run validate` for functional changes and browser playtests for rendered changes.
