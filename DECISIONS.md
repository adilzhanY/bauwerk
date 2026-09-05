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

## 2026-09-05 A remembered UTM reference value was wrong, and three series terms were not enough

The agent wrote the UTM test against a value it remembered from the Wikipedia worked example for the Eiffel Tower. The test failed by 2.4 m. Instead of loosening the tolerance, the coordinates were run through pyproj (PROJ, EPSG:32631 and EPSG:25833) in a scratch environment: the agent's forward projection agreed with PROJ to 0.1 mm at every point and the remembered reference was the thing that was wrong. The test now carries PROJ's numbers and names their source. The same run showed a constant 0.7 mm bias in the inverse direction, which is the size of the missing fourth-order Krüger term; the coefficients were extended and the round trip is now under 0.1 mm. Two lessons for the interview: a reference value in a test must have a source, and an independent implementation is the cheapest way to find out which side of a disagreement is wrong.

## 2026-09-05 Photo underlay stays out of the model

The floor plan underlay (an image on the ground for tracing) is UI state in the browser only: an object URL, a width in metres, a position and an opacity. It is not part of the building, not autosaved, not exported and not synced. The alternative, embedding the image as base64 in the JSON, would have bloated every export and every WebSocket broadcast with megabytes that have nothing to do with the model. Scaling works through the measure tool: measure a known distance on the image, type the real length, apply. No image processing, no dependency.

## 2026-09-05 Live updates while dragging, overruling commit-on-release

Earlier the agent made number inputs and sliders commit only on release or blur, to keep one undo step per edit. Adilzhan rejected that: when changing a height, width or thickness the model has to follow the hand, not jump when the mouse is let go. The fix keeps both properties. Sliders and inputs write to the store on every tick and every valid keystroke, and the history middleware gained a batch mode: `beginBatch` on pointer down or focus, `endBatch` on release or blur, and only the first change inside a batch records the snapshot. A drag of twenty ticks is still one undo step, tested in `building.test.ts` and `App.test.tsx`. The sync client already coalesces writes, so a drag produces one request in flight at a time, not twenty.

## 2026-09-05 Interface redrawn, native controls banned

Adilzhan rejected the first interface: dark chrome, blue accent, Inter, native selects and range inputs, the look every generated tool has this year. The redesign is light by default with a designed dark option, a paper ground with ink text, red only for marks and warnings, blue only for selection, Archivo, IBM Plex Sans and IBM Plex Mono bundled locally. Every form control is now our own component in `src/components/`, each with the ARIA role of what it replaces and a test that drives it by keyboard and pointer: slider with pointer capture and value bubble, number input with label scrubbing, select as combobox and listbox with type-ahead, switch, segmented control, swatches, tabs, dialog with focus trap. An App test greps the rendered tree for `select`, `input[type=range]`, `input[type=checkbox]` and `input[type=number]` and fails if any appear. The 3D scene reads its ground, grid and background from the same tokens, so it follows the theme. Verified with 206 tests; the visual pass in both themes is Adilzhan's.

## 2026-09-05 Second interface pass from Adilzhan's review

Eight corrections after looking at the redesign: everything fully rounded, no mono font for numbers, the tool rail floating at the bottom centre like Figma, side panels floating with rounded corners, bigger controls and type, no uppercase anywhere, the left panel organised by an icon strip so one section shows at a time, and a custom cursor set with every state. Two calls made under that direction. The number face is Manrope, a geometric sans with tabular figures, so digits still line up without a typewriter look; the agent had argued for mono and was overruled. The cursors are drawn as SVG in the repository instead of downloaded: a found cursor pack carries licence and attribution questions a portfolio does not need, and drawing eight 24 px shapes is an hour, not a risk. Hotspots and SVG validity are tested; the canvas cursor follows the active tool through a `data-tool` attribute. Visual judgement of the result stays with Adilzhan.

## 2026-09-05 The print view is a document, not a screen

Adilzhan: when printed it must look like a German building document, not like the interface. The print view now drops every design token: Arial, black hairlines, grey field labels over white value boxes in numbered sections, a plain table for the indicators, the A+ to H scale with kWh/(m²·a) ticks and two markers, one A4 page per storey with plan and room table, and a method page. The visual language comes from the official Energieausweis and iSFP documents (gebaeudeforum.de, GEG-Infoportal), but the form itself is not imitated and the first paragraph says it is not a certificate under the GEG. Numbers, dates and times use German conventions regardless of the interface language: 1.234,5 and 05.09.2026, 18:04. A test renders the page with a fixed clock and checks the time format and that no rounded or shadow class survives.

## 2026-09-05 A location must be visible, so the ground shows the map

Adilzhan set a location and saw nothing but grey ground, and asked whether he should see a map. He should. The location had only fed exports, orientations and a compass, which is correct and invisible. The ground now shows OpenStreetMap raster tiles around the origin at true scale, rotated with the plan, with the attribution the tile policy requires. OpenStreetMap over Google Maps: no key, no billing, and the right look for a planning tool. This is the first runtime request to an external server; INFO.md records it as the one exception to the no-external-requests rule. Two geometry facts surfaced by the tests and kept in comments: Mercator tiles are square on the sphere but not on the ellipsoid (0.3 percent), and tile edges follow geographic north while the plan follows UTM grid north, which in Berlin differ by about 1.3 degrees.

## 2026-09-05 Layers compute the U-value, and the layers set the wall thickness

Constructions for walls, roofs and floors are now layer stacks with thickness and conductivity, U = 1 / (R_si + Σ d/λ + R_se) after DIN EN ISO 6946 with the standard surface resistances. Two consequences the agent had to be told to accept. First, the preset U-values moved: the brick wall is 1.48 from its layers, not the typed 1.4, so the hand-computed energy tests now read the preset values and check the formulas rather than fixed numbers. Second, the exterior wall thickness follows the wall construction's layer stack and the typed thickness is only the fallback, because a 42 cm insulated wall drawn 30 cm thick would be a lie in the plan. Windows and doors stay typed products. IFC export carries the stack as IfcMaterialLayerSet with a usage per wall and the conductivity in Pset_MaterialThermal; IfcOpenShell still reports zero issues.

## 2026-09-05 Thermal bridges as geometry, two psi sets, in the total

Bridges come from lengths the model already has: corners, opening perimeters, slab and roof edges, floor joints, interior wall junctions. The agent proposed a single blanket allowance of 0.05 W/(m²K) on the envelope, which is what certificates do when no detail is designed. Rejected for the demo: a blanket number teaches nothing and cannot be drawn. Instead every bridge has a type and a length, two ψ sets exist (good after DIN 4108 Beiblatt 2, poor for the uninsulated stock), the renovated scenario assumes good detailing, and the lines are drawn in red on the model with the W/K on hover. The bridge term is included in H_T rather than reported beside it, so the class on the scale already contains it. The hand-computed energy tests subtract the bridge term explicitly so the U·A formulas stay checked.

## 2026-09-05 Hip roofs only on rectangles, gables as folded plates everywhere

A general hip roof needs the straight skeleton of the footprint, a proper computational geometry algorithm with its own failure modes on concave shapes. Not worth it for the demo: hip roofs are built for axis-aligned rectangular footprints (two trapezoids, two triangles, the ridge shortened by the half span at each end) and every other footprint falls back to a gable, with the fallback shown in the properties panel. Gables work on any footprint as a folded plate over the ridge line. Roof area is the true sloped area and feeds the heat loss; attic volume is exact because each face is planar, so it is plan area times the height at the plan centroid. The roof goes into IFC as an IfcRoof with one ROOF slab member per face as a surface model; IfcOpenShell builds all 39 solids of the gable example with zero schema issues.

## 2026-09-05 Classical vision first, a model only if scans defeat it

The footprint-from-photo pipeline is classical: adaptive threshold, closing, a projection-profile deskew, axis-aligned run scanning for wall lines, collinear merging, corner snapping, then the planar face extraction the room engine already had, now shared. The agent's first skew estimator voted per pixel on quantised slopes and returned zero on thick lines; replaced with the projection-profile search used for document deskew, which recovers a two degree skew within half a degree on the synthetic plans. No neural model yet: a segmentation network in the browser is the stretch item, kept for the day a real scan defeats the classical path, and that day gets its own entry here. The image scale comes from the underlay calibration with the measure tool, so metres are the user's responsibility, not a guess from paper size. Accepting a proposal replaces the footprint and the active storey's interior walls in one undo step.

## 2026-09-05 Heating sized from the rooms, not typed by hand

Radiators, a heat pump and pipe runs are the last element type from the posting. The agent first placed radiators with a fixed 1000 W. Changed so the placement reads the room behind the wall, computes its heat load after a simplified DIN EN 12831 (U·A of the room's own envelope share plus ventilation plus its share of the thermal bridges, times 32 K for Berlin's design temperature), and sizes the radiator to that load rounded up to 100 W; the heat pump suggestion is the building load with a 1.1 safety factor. A radiator may sit under a window but not across a door, and never overlaps another radiator; import enforces the same. IFC gets IfcSpaceHeater with OutputCapacity, IfcUnitaryEquipment with NominalHeatingCapacity and IfcPipeSegment per leg. The per-room loads are checked against the building total in the tests, so the split cannot silently lose a wall.
