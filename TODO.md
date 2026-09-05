# TODO

Work top to bottom. Tick with `[x]`. A task is done when `npm run check` passes and the human has looked at it. Anything that breaks an invariant in `INFO.md` goes back to open.

## 0. Scaffold

- [x] `npm create vite@latest . -- --template react-ts`, React 18, TypeScript strict, `noUncheckedIndexedAccess` on.
- [x] Install zustand, immer, three, @react-three/fiber, @react-three/drei, @types/three, lucide-react, tailwindcss @tailwindcss/vite.
- [x] Install dev: vitest, jsdom, @testing-library/react, eslint, typescript-eslint, prettier, eslint-config-prettier.
- [x] Scripts: `dev`, `build`, `preview`, `typecheck`, `lint`, `test`, `check` (typecheck plus lint plus test).
- [x] `vite.config.ts` with `base` set from an env var so GitHub Pages works under `/bauwerk/`.
- [x] Tailwind v4 set up with the palette from `INFO.md` as CSS variables, Inter and JetBrains Mono loaded locally (no external requests at runtime).
- [x] `.gitignore`, `.prettierrc`, ESLint config, `README.md` with a one-paragraph description and the run commands.
- [x] Repository layout from `INFO.md` created with empty modules and one passing smoke test.
- [x] First commit.

## 1. Data model and store

- [x] `src/geometry/types.ts` with the interfaces from `INFO.md`.
- [x] `src/lib/ids.ts`: short unique ids, deterministic in tests.
- [x] `src/store/building.ts`: Zustand store holding `building`, `activeStoreyId`, `selection`, `tool`, `language`. Default building: a 10 m by 8 m rectangle, one storey, no openings.
- [x] `src/store/history.ts`: undo and redo middleware. Every action that changes `building` pushes a snapshot. Cap history at 200 entries. UI state (selection, tool, language) is not part of history.
- [x] Actions: `setFootprintVertex`, `addStorey`, `removeStorey`, `setStoreyHeight`, `renameStorey`, `setWallThickness`, `addOpening`, `updateOpening`, `removeOpening`, `addInteriorWall`, `removeInteriorWall`, `renameRoom`, `assignRoomToZone`, `addZone`, `updateZone`, `removeZone`, `loadBuilding`, `undo`, `redo`, `select`, `clearSelection`, `setTool`, `setLanguage`.
- [x] Tests: undo then redo is identity for every action. History cap holds. UI state is untouched by undo.

## 2. Geometry

- [x] `polygon.ts`: signed area, orientation, ensure counter-clockwise, simple-polygon check (no self-intersection), point-in-polygon, edge list with lengths and outward normals.
- [x] Tests for `polygon.ts` including a concave L-shaped footprint and a self-intersecting bowtie that must be rejected.
- [x] `walls.ts`: from footprint and thickness, produce each exterior wall as a quad footprint (inner and outer offset lines, mitred at corners) plus height from the storey.
- [x] Tests: wall count equals vertex count, mitred corners meet, thickness is honoured on a rectangle and on the L shape.
- [x] `openings.ts`: validate an opening against its wall and its siblings (the invariants in `INFO.md`), clamp helper for the UI, and produce the wall's 2D profile with the opening subtracted as a polygon with a hole.
- [x] Tests: every invariant has a failing case and a passing case. Two adjacent openings that touch exactly are allowed, overlapping by 1 mm is rejected.
- [x] `rooms.ts`: from footprint and interior wall segments on the grid, compute the room polygons (planar face extraction on the grid) and their areas.
- [x] Tests: no interior walls gives one room equal to the footprint. One wall across a rectangle gives two rooms whose areas sum to the footprint area. A dangling wall that does not split anything still gives one room.
- [x] `export.ts`: `toJson(building)` and `fromJson(text)` with validation of every invariant on import and a clear error message on failure.
- [x] Tests: round trip is deep equal, a JSON with an overlapping opening is rejected with the right message.

## 3. Scene

- [x] `Viewport.tsx`: Canvas, orbit controls limited so the camera never goes below the ground, soft lighting, grid at 0.5 m, a ground plane.
- [x] `Camera.tsx`: fit the building on load, animate to the active storey over 300 ms.
- [x] `Wall.tsx`: extrude the wall profile (with holes) into a mesh. Exterior walls in the wall colour, selected wall in the accent colour, hovered wall slightly lighter.
- [x] `Opening.tsx`: draw a translucent pane for windows and a door slab for doors inside the hole, so the hole reads as an opening and not as a gap.
- [x] `Storey.tsx`: floor slab, walls, openings, interior walls, room fills coloured by zone. Inactive storeys at 25 percent opacity and not clickable.
- [x] `Room.tsx`: flat fill on the floor with the zone colour, name label facing the camera (drei `Html` or `Text`).
- [x] Picking: click selects, click on empty space clears, hover state in the store is throttled so the viewport does not re-render on every mouse move.
- [ ] Performance: 5 storeys with 20 openings each stays above 60 fps on the RTX 5070 and above 30 fps on integrated graphics. Memoise geometry per element by a hash of its inputs. (Memoisation done; the fps numbers need a manual check in the browser.)

## 4. Tools and editing

- [x] Select tool: click any element, Delete removes it, Escape clears.
- [x] Footprint tool: vertices shown as draggable handles on the ground plane, snapped to the grid, live validation, invalid shapes shown in the warning colour and not committed.
- [x] Opening tool: click a wall to place a window at the click position with default size; hold Shift for a door. Then drag the opening along the wall, snapped to 0.1 m.
- [x] Interior wall tool: click two grid points on the active storey to add a wall segment. Preview line while placing.
- [x] Zone tool: click rooms to toggle them into the active zone.
- [x] Keyboard shortcuts from `INFO.md`, with a small shortcut sheet behind a `?` button.

## 5. UI panels

- [x] `LeftPanel.tsx`: storey list with add, remove, rename, reorder by drag; tool palette; settings for wall thickness, grid visibility, language.
- [x] `RightPanel.tsx`: properties of the selection. Wall: length, thickness, number of openings. Opening: kind, offset, width, height, sill, with sliders and number inputs, validation message when invalid. Room: name, area, zone select. Storey: name, height. Zone: name, colour from the fixed set.
- [x] `BottomBar.tsx`: undo, redo (disabled when nothing to do), export, import, status line.
- [x] Empty state when the building has no storeys, and a WebGL-missing state.
- [x] Below 1024 px: full-screen message that the editor needs a desktop browser.
- [x] Focus rings, labels, keyboard operation of every panel control.

## 6. Internationalisation

- [x] `src/i18n/index.ts`: `t(key)` hook bound to the store language, typed keys, missing key is a compile error.
- [x] `en.ts` complete.
- [x] `de.ts` complete, checked against a dictionary. Storey naming rules: ground floor "Erdgeschoss", then "1. Obergeschoss", "2. Obergeschoss"; English "Ground floor", "1st floor", "2nd floor".
- [x] Language persisted in localStorage, default from `navigator.language`.
- [x] Number formatting via `Intl.NumberFormat` in inputs and status line.

## 7. Persistence and export

- [x] Autosave the building to localStorage on every change, restore on load, "Reset to example" button.
- [x] Export button downloads `bauwerk-<name>-<date>.json`.
- [x] Import button opens a file picker, validates, shows the error message inline if invalid.
- [x] Two example buildings bundled: a simple two-storey house and an L-shaped three-storey block.

## 8. Quality gates

- [x] `npm run check` green with zero warnings.
- [x] Test coverage on `src/geometry/` and `src/store/` above 90 percent lines. (98.5 and 95.3 on 2026-09-05, `npx vitest run --coverage`.)
- [ ] Manual visual check of every state listed in `INFO.md` design principles, in both languages.
- [x] `grep -rn "dash characters" src docs *.md` returns nothing.
- [ ] Lighthouse performance above 90 on the production build.

## 9. CI and deployment

- [x] `.github/workflows/check.yml`: on push and pull request, install, `npm run check`, build.
- [x] `.github/workflows/deploy.yml`: on push to `main`, build with the Pages base path and deploy with `actions/deploy-pages`, gated behind a GitHub environment that requires manual approval.
- [x] Create the GitHub repository `adilzhanY/bauwerk`, public, push. Do not enable Pages until local testing is signed off by Adilzhan.
- [ ] After sign-off: enable Pages, approve the deployment, verify the live URL, add it to `README.md`.

## 10. Interview preparation

- [x] Write the three minute walkthrough in `README.md` under "Demo path": open, add a storey, place a door and three windows, split into three rooms, create a heated zone with two rooms, undo four steps, redo them, export, switch the UI to German.
- [ ] Rehearse the walkthrough three times against the live URL, timed.
- [ ] `DECISIONS.md` has at least five real entries from the build. Pick the two best to tell.
- [ ] One minute explanations ready for: how openings cut the wall, how undo works, why geometry has no Three.js imports, what was cut and why.
- [ ] Read the Three.js basics once: scene, camera, mesh, BufferGeometry, raycasting, so the questions on the call land.

## Phase 2

Everything below extends the demo toward the other three bullets of the posting: the full stack slice, IFC export fidelity, and collaboration, plus the energy language 20grad's customers speak. Same rules as above: pure functions with tests first, one commit per task, `DECISIONS.md` entry for every correction. Order is by value. Stop after any section and the demo still works.

## 11. Building physics

Goal: the model answers "what does this tell me about the building's energy?" Pure functions in `src/geometry/energy.ts`, no UI dependency, every number traceable to a formula in a comment.

- [x] Data model: `Construction { id, name, uValue }` presets for exterior walls, windows, doors, floor slab and roof. Default set: uninsulated brick wall 1.4, 1970s wall 1.0, insulated wall 0.25, single glazing 5.0, double glazing 2.8, triple glazing 0.8, old door 3.0, insulated door 1.3, uninsulated floor 1.0, insulated floor 0.35, uninsulated roof 1.3, insulated roof 0.2 W/(m²K). Values editable, presets stored in the building JSON.
- [x] Building gets `constructions: Construction[]`, `wallConstructionId`, `floorConstructionId`, `roofConstructionId`. Each opening gets `constructionId`. Existing JSON without these fields imports with the uninsulated defaults (migration in `export.ts`, test it).
- [x] Zones get `heated: boolean` and an indoor design temperature (default 20 °C heated, 10 °C unheated).
- [x] `envelope.ts`: for every storey compute exterior wall net area (gross minus openings), window area, door area, floor area on the ground storey, roof area on the top storey. Envelope area per storey and per building. Window-to-wall ratio per orientation (N, E, S, W from the wall normal).
- [x] Tests: rectangle with two windows gives gross minus opening areas exactly; L shape orientation buckets are right; a storey with no openings has ratio 0.
- [x] `heatLoss.ts`: transmission heat loss coefficient H_T = Σ U·A over the envelope of heated rooms, in W/K. Interior walls between a heated and an unheated room count with a fixed U of 1.0 (document the simplification). Ventilation loss H_V = 0.34 · n · V with n = 0.5 1/h and V the heated volume. Specific transmission loss H_T' = H_T / A_envelope.
- [x] Tests: hand-computed H_T for the default building with all presets uninsulated versus all insulated; swapping one window preset changes H_T by exactly U difference times area; unheated rooms contribute nothing.
- [x] Simple annual heating demand: Q_h = (H_T + H_V) · G_t with G_t = 84 kKh for Berlin (heating degree hours, DIN V 4108-6 style, document the source and that it ignores solar and internal gains). Output kWh/a and kWh/(m²a) over heated floor area.
- [x] Energy class band from kWh/(m²a) using the Energieausweis scale A+ to H. Pure lookup, tested at the boundaries.
- [x] Store actions: `setConstruction`, `assignConstruction`, `setZoneHeated`. Undoable, tests.
- [x] Energy panel in the right panel when nothing is selected, and an Energy tab: envelope area, window-to-wall ratio, H_T, H_T', heating demand, energy class with the coloured band. Per zone breakdown.
- [x] Before and after: a "Scenario" toggle that swaps every construction to its insulated counterpart without touching the model, shows both columns side by side, and the difference in percent. Not stored in history, it is a view.
- [x] Opening and wall properties show the construction select and the resulting U·A for that element.
- [x] Export JSON includes constructions and the computed energy summary block (marked derived).
- [x] i18n for every new string, German checked: Wärmedurchgangskoeffizient, Transmissionswärmeverlust, Lüftungswärmeverlust, Heizwärmebedarf, Hüllfläche, Fensterflächenanteil, Energieeffizienzklasse.

## 12. IFC export

Goal: a file that opens in a real IFC viewer with correct storeys, walls, openings, windows, doors and spaces. STEP physical file, IFC4. Written by hand in `src/geometry/ifc.ts`, no library, so the schema knowledge is visible in the code.

- [x] Read the IFC4 spatial structure once: IfcProject, IfcSite, IfcBuilding, IfcBuildingStorey, IfcRelAggregates, IfcRelContainedInSpatialStructure. Note the entity list and required attributes in a comment block at the top of `ifc.ts`.
- [x] STEP writer: entity id counter, `#12=IFCWALL(...)` line encoding, string escaping, enum and typed value formatting (`IFCLABEL('x')`, `IFCLENGTHMEASURE(1.)`), `$` for null, `*` for derived. Header section with FILE_DESCRIPTION, FILE_NAME, FILE_SCHEMA (('IFC4')).
- [x] Tests for the writer: escaping of apostrophes and non-ASCII (German umlauts use the `\X2\` encoding), number formatting always with a dot and a trailing point for integers written as REAL, ids unique and monotonic.
- [x] Units: IfcUnitAssignment with metres, square metres, cubic metres, radians. Geometric context with world coordinate system and precision 1e-5.
- [x] Spatial tree: one IfcProject, one IfcSite, one IfcBuilding, one IfcBuildingStorey per storey with Elevation set to the storey elevation. Aggregation relationships in the right direction.
- [x] Walls: one IfcWall per exterior wall per storey with an IfcExtrudedAreaSolid from the mitred plan quad (IfcArbitraryClosedProfileDef over an IfcPolyline) extruded by the storey height. Placement relative to the storey.
- [x] Openings: one IfcOpeningElement per opening as an extruded rectangle through the wall thickness, related with IfcRelVoidsElement to its wall. One IfcWindow or IfcDoor filling it with IfcRelFillsElement, with OverallHeight and OverallWidth set.
- [x] Interior walls as IfcWall with a 0.1 m thick box solid.
- [x] Rooms as IfcSpace with the room polygon extruded by the storey height, contained in the storey, LongName from the room name. Zones as IfcZone grouping their spaces through IfcRelAssignsToGroup.
- [x] Slabs: one IfcSlab per storey floor (0.2 m, PredefinedType FLOOR), roof slab on the top storey (PredefinedType ROOF).
- [x] Property sets: Pset_WallCommon with ThermalTransmittance from section 11 when present, Pset_WindowCommon and Pset_DoorCommon likewise, Pset_SpaceCommon with the floor area. Skip when section 11 is not done.
- [x] Tests: entity counts match the model (walls, openings, windows, doors, spaces, storeys); every referenced `#id` exists; every wall has exactly one representation; file parses with a small STEP tokenizer written in the test.
- [ ] Manual verification by Adilzhan: open the export of the two example buildings in an IFC viewer (BlenderBIM, or a web viewer such as ifc.js), check storeys, holes in walls, room volumes. Screenshot into `docs/ifc-verification.png` and reference it in the README. Any mismatch goes into `DECISIONS.md`. (Already validated with IfcOpenShell 0.8.5: zero schema issues, all solids build, openings cut real holes. `scripts/validate-ifc.py`. The viewer screenshot is still yours to take.)
- [x] Export IFC button next to Export JSON, file name `bauwerk-<name>-<date>.ifc`.
- [x] README section "IFC export": what is written, what is left out (no materials layers, no IfcCurtainWall, no georeferencing until section 14), and the viewer screenshot.

## 13. Full stack slice: server and live collaboration

Goal: two browser tabs edit the same building and see each other's changes, with a Postgres project store behind a NestJS API. The client keeps working alone with localStorage when no server is configured, so GitHub Pages still works.

- [x] `server/` folder, own `package.json`, NestJS 10, TypeScript strict, Prisma or plain `pg` (decided: plain `pg`, see `DECISIONS.md`), Vitest for unit tests, `docker-compose.yml` with Postgres 16. Same lint and format rules as the client.
- [x] Schema: `projects (id uuid pk, name text, building jsonb, version integer not null, updated_at timestamptz)`, `project_events (id bigserial pk, project_id uuid fk, version integer, actor text, patch jsonb, created_at)`. Migration checked in. The building JSON is validated on write with the same `validateBuilding` as the client (shared through a tsconfig path alias to `../src/geometry`, copied into the image by the compose Dockerfile).
- [x] REST: `POST /projects` creates from a building, `GET /projects/:id` returns building and version, `PUT /projects/:id` takes `{ building, baseVersion }` and applies it in one transaction with `UPDATE ... WHERE version = baseVersion`; zero rows updated returns 409 with the current version and building. `GET /projects` lists id, name, updated_at.
- [x] Tests: concurrent PUTs against a real Postgres in a test container, only one wins, the loser gets 409, the version increases by exactly one per accepted write, the events table has one row per accepted write.
- [x] WebSocket gateway: clients join a project room, every accepted PUT broadcasts `{ version, building, actor }` to the room, presence list of connected actors with a colour.
- [x] Client: `src/sync/` module with a `SyncClient` that loads the project, sends each committed history entry as a PUT with the base version, applies incoming versions from other actors, and on 409 reloads and reapplies the local change on top (last write wins, document why CRDT was not done). Reconnect with backoff, offline queue of one pending write.
- [x] Undo and redo stay local: undo sends the previous building as a new write. Test that undo after a remote change does not undo the remote change (history middleware compares against the snapshot it stored).
- [x] Presence in the UI: coloured dots in the bottom bar with actor names, the remote actor's selection highlighted with their colour in the viewport.
- [x] Project switcher: open, create, rename projects; the URL carries the project id so a link opens the same project in another tab.
- [ ] Manual verification by Adilzhan: two tabs, add an opening in one, see it in the other within a second, drag the same opening in both at once, confirm the 409 path recovers without losing either change. Record what broke in `DECISIONS.md`.
- [x] `docker-compose up` starts Postgres, server and a static client build; README section "Run with the server".
- [x] CI: server tests run in `check.yml` with a Postgres service container.

## 14. Geo placement

Goal: the footprint knows where it is on the earth, in the coordinate systems German planning uses.

- [x] Building gets `origin?: { lat, lon, rotation }` for the footprint origin in WGS84 and the rotation of the local x axis against east, in degrees.
- [x] `src/geometry/geo.ts`: WGS84 to UTM conversion (Krüger series, zone from longitude, EPSG 258xx for ETRS89 UTM, Berlin is EPSG 25833 zone 33) and back. Pure, no library.
- [x] Tests against known points: Brandenburger Tor 52.516275 N 13.377704 E is 33N 389918.04 E 5819699.13 N (reference from pyproj, EPSG:25833, in the test), round trip error under 1 mm, zone boundary at 12 °E handled.
- [x] Footprint to world: every footprint vertex to UTM and to WGS84 using origin and rotation. Wall orientations in section 11 use the true rotation.
- [x] GeoJSON export: a FeatureCollection with the footprint as a Polygon in WGS84 (right hand rule, closed ring), one feature per storey with height properties, the building properties from section 11 if present. Tests: valid GeoJSON structure, ring closed, coordinates in lon lat order.
- [x] Import: read a GeoJSON polygon as a new footprint, project to local metres around its centroid, snap to the grid, reject self-intersecting rings with the existing message.
- [x] IFC: IfcMapConversion and IfcProjectedCRS (EPSG:25833) in the IFC export when an origin is set.
- [x] UI: Location section in Settings with latitude, longitude, rotation inputs, a compass arrow in the viewport, north indicated on the grid.
- [x] i18n: Breitengrad, Längengrad, Ausrichtung, Norden.

## 15. Editor polish for consultants

Only what an energy consultant needs on a site visit. No decoration.

- [x] Dimension lines: length labels on every exterior wall and every interior wall, in the footprint and interior wall tools, in the locale's number format.
- [x] 2D plan view: a toggle that switches to an orthographic top-down camera on the active storey with the other storeys hidden, same tools work. Test the projection math for picking with a unit test on the camera setup.
- [x] Wall construction shown in the viewport: a thin coloured band along the top of each wall keyed to its construction's U-value (cold red to good green), toggle in Settings.
- [x] Room list in the left panel per storey: name, area, zone, click to select and focus the camera.
- [x] Measure tool (key 6): click two points, see the distance; Escape clears. Pure distance, snapped to grid.
- [x] Storey duplication: copy a storey with its openings and walls above itself, useful for repeated floors. Undoable, ids regenerated, tested.
- [x] Photo underlay: drop an image of a floor plan onto the ground plane, scale it by marking a known distance, trace the footprint over it. Image stays local, not exported.
- [x] Print view: a static page with plan per storey, the energy summary and the room table, for the customer meeting. Uses the browser's print to PDF.
- [ ] Performance check after all of the above: the five storey, twenty openings per storey model still above 60 fps on the RTX 5070; measure with the browser's frame counter and write the number here.

## 16. Interface redesign

Goal: the editor stops looking like every generated tool of this year. Light by default with a designed dark option, a drawing office feel, no native form controls anywhere. Every control is its own component in `src/components/`, named `Custom<Name>.tsx`, with a test next to it that drives it with keyboard and pointer and checks the accessible role, the value it reports and the visual states it exposes (hover, focus, disabled, invalid). The old `src/ui/controls/` folder disappears.

- [x] Design tokens in `src/index.css`: paper `#f6f6f2`, panel `#ecece6`, line `#cfd1c9`, ink `#1b1d20`, muted ink `#5b6068`, mark red `#c2431f` for warnings and markup, selection blue `#234d8f`; a dark set with the same roles. Tokens only, no colour literal in a component.
- [x] Theme: `light | dark | system` in the store, persisted in localStorage, applied as `data-theme` on the root element, `prefers-color-scheme` honoured for system. The 3D scene follows: ground, grid and background take their colours from the theme.
- [x] Fonts bundled locally: Archivo (headings, big numbers), IBM Plex Sans (labels, body), IBM Plex Mono (every measurement, tabular digits). Inter and JetBrains Mono removed. No external font request at runtime.
- [x] `CustomButton`: default, primary, quiet and danger variants, optional icon, loading state, keyboard focus ring drawn with the selection colour. Test: role button, click, disabled does not fire, Enter and Space fire.
- [x] `CustomIconButton`: square, tooltip from its label, pressed state for toggles. Test: accessible name from label, aria-pressed when toggle.
- [x] `CustomSlider`: own track, fill and thumb, pointer capture, live value while dragging, arrow keys with Shift for ten steps, Home and End, value bubble while active. Test: role slider with aria-valuenow and min, max; keyboard changes value by step; pointer down and move along the track maps to the value; value is clamped.
- [x] `CustomNumberInput`: mono digits, unit drawn inside, comma and dot accepted, drag on the label scrubs the value (Blender style) with Shift for fine steps, arrow keys step, invalid state in the mark colour. Test: typing commits live within range, blur clamps and snaps, scrub changes value by pixels moved, Escape reverts.
- [x] `CustomSelect`: button showing the value, popover listbox, arrow keys, Home and End, type-ahead, Enter selects, Escape closes, closes on outside click, option can carry a colour dot or a secondary text. Test: role combobox and listbox, keyboard selection, outside click closes, the selected option has aria-selected.
- [x] `CustomCheckbox` and `CustomToggle`: drawn box with a check mark, drawn switch. Test: role checkbox or switch, aria-checked, Space toggles, label click toggles.
- [x] `CustomTextInput`: commit on blur or Enter, Escape reverts, optional leading icon. Test: commit and revert paths.
- [x] `CustomSegmented`: a row of mutually exclusive options (Current / Renovated, tools). Test: role radiogroup, arrow keys move selection.
- [x] `CustomSwatches`: the zone colour picker, radiogroup of coloured circles. Test: arrow keys, aria-checked.
- [x] `CustomDialog`: focus trap, Escape closes, click outside closes, returns focus. Test: focus lands inside, Escape closes, Tab cycles.
- [x] `CustomSection` and `CustomField`: section header with optional action, field with label, hint and error line. Test: label is associated with the control.
- [x] `CustomTabs` for the right panel: Properties and Energy as tabs instead of stacked sections. Test: role tablist, arrow keys, aria-selected.
- [x] Replace every native control in `LeftPanel`, `RightPanel`, `BottomBar`, `EnergyPanel`, `LocationSection`, `UnderlaySection`, `ProjectSwitcher`, `ShortcutSheet`, `States`. No `<select>`, `<input type="range">`, `<input type="checkbox">` or native `<button>` outside the components folder. A test greps the rendered app for those tags.
- [x] Layout: a 56 px tool rail on the far left with icons and key hints, the left panel for storeys, rooms, zones, location, settings, the viewport, the right panel with tabs, and a mono status line at the bottom. Storey list drawn as a stacked section, active storey filled.
- [x] Viewport chrome: room labels, dimension labels, measure labels and the compass use the new tokens and fonts, and read on both grounds.
- [x] Print view and states (empty, WebGL, narrow) restyled with the same tokens.
- [x] `INFO.md` design section rewritten to the new palette and type, `DECISIONS.md` entry for the change of direction.
- [x] `npm run check` green, App tests updated.
- [ ] A screenshot of light and dark for the README, taken by Adilzhan, and a visual pass over every panel in both themes.
