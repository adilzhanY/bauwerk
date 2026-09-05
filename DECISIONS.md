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

## 2026-09-05 Footprint is the outer face, interior walls have no thickness

Two calls the agent could not make alone. First: the footprint polygon is the outer face of the exterior walls and the inner face is offset inward by the wall thickness, mitred at corners. Opening offsets measure along the outer edge. The alternative, footprint as wall centreline, would make the visible outline and the drawn polygon disagree. Second: interior walls are zero-thickness lines for room extraction, so room areas sum exactly to the footprint area, which is the invariant the tests enforce. A thick interior wall would eat floor area and the sum rule would no longer hold. Verified in `walls.test.ts` (ring area equals outer minus inner rectangle) and `rooms.test.ts` (areas sum within 1e-4).

## 2026-09-05 Room identity survives recomputation by centroid, not by index

Rooms are derived from interior walls, but the user names them and assigns zones. When a wall is added the agent's first idea was to match old rooms to new ones by array index, which reshuffles names as soon as face order changes. Replaced with centroid matching: a previous room keeps its id, name and zone in whichever new face contains its old centroid, largest rooms first. Splitting a room keeps the identity in the half that holds the centroid; merging keeps the larger room. Tested in `rooms.test.ts` and `building.test.ts`.

## 2026-09-05 Openings cut walls by splitting into prisms, not by CSG

`INFO.md` left the choice open between `three-bvh-csg` and manual subtraction. Chosen: no CSG at all. A wall is split along its length into columns at every opening edge; a column with an opening becomes a prism below the sill and a prism above the head, the other columns are full height. Each prism is a plan quad following the mitred inner face, extruded vertically, and the prisms of one wall are merged into a single mesh. This is a pure function (`wallSolids` in `src/geometry/walls.ts`) whose volume is unit tested: full wall volume minus cut volume equals the sum of the opening areas times the thickness. CSG would have added a dependency, been untestable without WebGL, and produced dirty topology at shared edges. The cost is that openings are always rectangular, which the spec already requires.
