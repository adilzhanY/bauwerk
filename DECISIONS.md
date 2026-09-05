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

## 2026-09-05 Number inputs commit on blur, sliders on release

The first draft of the properties panel wrote to the store on every keystroke and every slider tick. That works, but it makes undo useless: typing "2.4" left three history entries and dragging a slider left dozens. Changed so text inputs commit on blur or Enter and sliders commit on pointer release, with a local draft in between. One edit is one undo step. Inputs also accept both comma and dot, since the German locale writes 0,3 and the exported JSON must still write 0.3. Verified in `App.test.tsx` (comma input commits 0.4) and by the store tests that count history entries.

## 2026-09-05 Energy numbers are simplified and say so

The building physics layer computes transmission loss as a plain sum of U times A over the heated envelope, ventilation loss with a fixed 0.5 air changes, and heating demand from 84 kKh Berlin degree hours. It ignores solar and internal gains, thermal bridges and the ground reduction factor, and treats rooms without a zone as heated. A DIN V 18599 calculation was not attempted: it would take longer than the demo allows and the point of the layer is that every number on screen can be traced to a formula in a comment and a hand-computed test. The assumptions are printed at the bottom of the Energy panel so nobody mistakes the result for a certificate. `energy.test.ts` checks the default building against numbers computed by hand: 335.2 W/K uninsulated, 71 W/K renovated.

## 2026-09-05 IFC LongName written as a typed value, caught by an independent validator

The first IFC export wrote the IfcSpace LongName as `IFCLABEL('Küche')`. The agent's own tests passed, because they only checked structure and references. Running the file through IfcOpenShell's schema validator reported five errors: LongName is declared as IfcLabel, so the value must be a plain string; the typed wrapper form is only for SELECT attributes. Fixed, a regression test now forbids `IFCLABEL(` in the output, and the validator run is kept as `scripts/validate-ifc.py` so the export is checked against something the agent did not write. Lesson recorded for the interview: a self-written parser agreeing with a self-written writer proves little.

## 2026-09-05 Plain pg over an ORM, and last write wins over a CRDT

Two calls for the server. Storage: plain `pg` with one SQL migration file instead of Prisma or TypeORM. The schema is two tables and the one query that matters, `UPDATE ... WHERE id = $1 AND version = $2`, is exactly the kind of statement an ORM hides. Concurrency: optimistic version numbers with last write wins instead of a CRDT. Two people dragging the same window at once is not the demo's problem; two people editing the same project and never losing a whole session is. Every accepted write is one row in `project_events`, so the history is replayable. A CRDT would need a per-element merge policy for a data model that derives rooms from walls, which is a research task, not a weekend one. The client documents the choice in `src/sync/client.ts` and tests the 409 path.

## 2026-09-05 Connection pool deadlock in the conflict path, caught by the concurrency test

The first version of `ProjectsService.update` held its pooled client through the transaction and, when the version check failed, called `this.get(id)`, which asked the pool for a second connection. The test with twelve simultaneous writers on a ten-connection pool hung until it timed out: every client was held by a writer waiting for a connection that no writer would release. Fixed by reading the current row on the same client after the rollback. The test that found it is the one `TODO.md` asked for: concurrent writes against a real Postgres, not a mock. A mocked pool would have passed.
