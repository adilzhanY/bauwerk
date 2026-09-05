# Decisions

The review log. Every entry is a place where the human overruled, corrected, rejected or deliberately constrained what the agent produced, or made a design call the agent could not make alone. This file is shown at the interview, so write it for a reader who was not there.

Format for each entry:

```
## YYYY-MM-DD  Short title

What the agent did or proposed.
Why it was wrong, risky, or not the call to make automatically.
What was done instead, and how it was verified.
```

## 2026-09-05 Scope cut before the first line of code

The posting lists windows and openings, rooms, zones, HVAC, multi-storey support and richer editing tools. HVAC, roofs, real IFC export, textures and collaboration were cut on purpose. Two days are available and a finished small editor with tests is worth more in the call than a broad unfinished one. The cut list is written in `INFO.md` so it can be said out loud rather than discovered.

## 2026-09-05 Geometry is pure and Three.js free

Decided before generation: everything under `src/geometry/` is plain TypeScript over numbers and arrays, with no Three.js import, so it can be unit tested in Vitest without a WebGL context and so the correctness argument does not depend on rendering. The scene layer only converts geometry output into meshes. The agent is not allowed to relax this, see `CLAUDE.md`.

## 2026-09-05 Scaffold template rejected, versions pinned by hand

`npm create vite@latest` now produces React 19, Vite 8, TypeScript 6 and oxlint, which contradicts the fixed stack in `INFO.md` (Vite 6, React 18, TypeScript 5, ESLint). The generated template was discarded and `package.json` was written by hand with the pinned majors. This also forced `@react-three/fiber` 8 and `@react-three/drei` 9, since fiber 9 and drei 10 require React 19. `npm install` needed `--legacy-peer-deps` because npm 10 crashes resolving Vitest 4's optional peers. Verified with `npm run check` and a production build under `VITE_BASE_PATH=/bauwerk/`, fonts bundled locally, no external requests.
