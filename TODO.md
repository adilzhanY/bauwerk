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

## 17. Interface, second pass

Adilzhan's review of the redesign. Every item here overrules or refines section 16.

- [x] Fully rounded elements: buttons, inputs, selects, segments and chips are pills; panels and dialogs have large rounded corners. Radius tokens only, no per-component values.
- [x] Numbers stop using a mono font. Pick a clean geometric sans with tabular figures that is not Inter (Manrope), use it for body text and every measurement. Archivo stays for headings. Fonts bundled locally, old ones removed.
- [x] The tool rail floats centred at the bottom of the viewport like Figma's toolbar: horizontal, pill shaped, shadowed, over the scene.
- [x] Left and right panels float over the scene with a margin, fully rounded corners and a soft shadow. The viewport fills the window behind them.
- [x] Everything in the side panels gets bigger: base type 15 px, controls 40 px tall, wider panels, more padding. Nothing below 13 px.
- [x] No uppercase anywhere. Section titles, tabs and chips read as written: "Zones", not "ZONES". A test checks no element carries the uppercase class.
- [x] Left panel navigation: an icon strip inside the panel switches between Storeys (with rooms), Zones, Location, Underlay and Settings. One section visible at a time, no long scroll. Each icon has a label tooltip and the active one is filled. Keyboard: arrow keys move between sections.
- [x] Custom cursor set drawn as SVG in the Figma style (black arrow with a white outline) and applied through CSS variables: default, pointer for anything clickable, text for inputs, grab and grabbing on the canvas, crosshair for the drawing tools, horizontal resize for label scrubbing and slider thumbs, not-allowed for disabled controls. Hotspots set per cursor. Test: every cursor is valid SVG with a hotspot inside its box, and the canvas cursor changes with the active tool.
- [x] Component tests and App tests updated, `npm run check` green, `DECISIONS.md` entry.

## 18. Print view as a German building document

- [x] The print view drops the interface design entirely: no rounded corners, no shadows, no pills, plain Arial or Helvetica, black rules, A4 page breaks. It follows the visual language of German building documents (Energieausweis, iSFP): numbered grey field boxes, a plain data table, the A+ to H scale with kWh/(m²·a) ticks and a marker.
- [x] It states clearly that it is not an official Energieausweis and that the calculation is simplified.
- [x] German conventions for every number regardless of UI language: comma decimal, point thousands, `dd.mm.yyyy`, 24 hour time `18:04`, units `m²`, `kWh/(m²·a)`, `W/(m²·K)`.
- [x] Sections: Gebäude (data fields), Energetische Kennwerte with current and renovated markers on the scale, Bauteile (U, A, U·A per element type), one plan and room table per storey, footer with method and assumptions.
- [x] Test: the rendered print view contains no rounded classes, shows a 24 hour time and a German date, and one section per storey.

## 19. Map underlay

Goal: when a location is set, the ground shows the real surroundings from OpenStreetMap, at true scale and rotated with the plan, so "place the building on the map" is visible.

- [x] `src/geometry/tiles.ts`, pure: Web Mercator slippy tile maths. Lat/lon to tile x, y at a zoom, tile to its lat/lon corners, metres per pixel at a latitude, and the list of tiles covering a radius around a point. Tests against known tile numbers for Berlin and the equator, round trip, and the covering set size.
- [x] Tile corners are projected into plan coordinates through the existing UTM origin, so the tiles land at true scale and follow the plan rotation. Over a few hundred metres the Mercator to UTM mismatch is below a centimetre; documented in the code.
- [x] `src/scene/MapUnderlay.tsx`: one quad per tile textured with the OSM raster tile, zoom 19, under the grid and the slab, not raycast, faded to the underlay opacity. Tiles load with `crossOrigin` and fail silently.
- [x] Store: `showMap` and `mapOpacity` as UI state, persisted with the other view settings. Default on when a location is set.
- [x] Location section: switch for the map and an opacity slider; the grid switch stays.
- [x] Attribution: "© OpenStreetMap contributors" with a link, drawn in the viewport corner whenever a tile is visible. Required by the OSM tile usage policy.
- [x] `INFO.md`: the external request rule gets its one exception, OSM tiles when the map is on, and the print view never includes tiles.
- [x] Tests: tile maths, App test that the switch appears with a location and the attribution renders when on.

## Phase 3

The roadmap from the Phase 3 artifact, ranked by what it proves. Same rules: every geometry function pure and tested first, one commit per task, human review of the result, `DECISIONS.md` for every overrule. Sections 20 to 23 change what the project is, 24 to 27 deepen what exists, 28 to 31 are polish that gets noticed.

## 20. Wall construction layers

Goal: a wall is no longer one U-value but a stack of layers, the way an energy consultant describes it. Answers building physics and BIM domain knowledge.

- [x] Data model: `Layer { id, name, thickness, conductivity }` in metres and W/(m·K); `Construction` gains `layers?: Layer[]` and keeps `uValue` as the computed result. Presets get real layer stacks: brick wall 1900 (plaster 15 mm, brick 380 mm, plaster 15 mm), 1970s wall (plaster, aerated concrete 240 mm, render), insulated wall (plaster, brick 240 mm, EPS 160 mm, render), and matching roof and floor stacks. Conductivities from DIN 4108-4 values, sourced in a comment.
- [x] `src/geometry/layers.ts`: `uValueFromLayers(layers, rsi, rse)` with R = rsi + Σ d/λ + rse, rsi 0.13 and rse 0.04 for walls, 0.10 and 0.04 for roofs, 0.17 and 0.00 for ground floors. Total thickness. Tests against hand-computed cases: the brick wall preset gives about 1.4, the insulated preset about 0.20, a single layer of 1 m at λ 1 gives 1/(1 + 0.17).
- [x] Migration: a construction without layers keeps its typed U-value; a construction with layers recomputes U on every layer edit. Import validates thickness > 0 and conductivity > 0.
- [x] The exterior wall thickness follows the wall construction's total layer thickness when layers exist; the global thickness setting becomes the fallback for constructions without layers. Rooms and openings adjust, tests for the derived thickness.
- [x] Layer editor in the Energy tab: add, remove, reorder layers, edit name, thickness in mm and conductivity, the U-value updating live. Own components only.
- [x] Cross-section drawing: an SVG of the wall from outside to inside with each layer as a band at true relative thickness, hatched per material class (masonry, insulation, plaster), labelled with thickness and λ. Shown in the layer editor and in the print view under Bauteile.
- [x] IFC: IfcMaterialLayerSet with one IfcMaterialLayer per layer (material name, LayerThickness), IfcMaterialLayerSetUsage on each wall, and IfcMaterial with Pset_MaterialThermal ThermalConductivity. Validated with the IfcOpenShell script; entity counts tested.
- [x] Print view: the Bauteile table lists layers per construction with d, λ, R and the resulting U.
- [x] i18n: Schicht, Dicke, Wärmeleitfähigkeit, Wärmedurchlasswiderstand, Aufbau von außen nach innen.

## 21. Thermal bridges

Goal: the extra heat loss at edges and corners, computed from lengths the geometry already knows. Answers building physics.

- [x] `src/geometry/bridges.ts`, pure: extracts linear thermal bridges per storey: outer corners (footprint vertices), window and door perimeters (2 × (w + h) per opening), floor slab edge on the ground storey (footprint perimeter), roof edge on the top storey (perimeter), intermediate floor edges between storeys (perimeter per joint), interior wall to exterior wall junctions (one per interior wall end touching the footprint). Each with a type, a length and the world segment to draw.
- [x] Psi values per type with a source comment: the DIN 4108 Beiblatt 2 reference values as the "good detail" set (corner 0.05, window 0.04, slab edge 0.10, roof edge 0.10, intermediate floor 0.05, junction 0.03 W/(m·K)) and a "poor detail" set for uninsulated stock (0.15, 0.20, 0.50, 0.30, 0.20, 0.10). The set is a building setting; the renovated scenario switches to the good set.
- [x] Tests: the default rectangle has 4 corners of 3 m, a perimeter of 36 m for slab and roof, and each window adds exactly 2(w + h); a two storey building adds one intermediate floor joint; an interior wall touching two exterior walls adds two junctions; total ΔH_T = Σ ψ × l matches a hand-computed value.
- [x] Energy: H_T gains the bridge term Σ ψ × l, shown as its own line and as a share of the total in the Energy tab and in the print view.
- [x] Scene: bridges drawn as thin red lines on the model when a "Thermal bridges" view switch is on, line width by ψ × l, hover shows type and W/K in a label.
- [x] Bauteile table in the print view gets a Wärmebrücken block with type, length, ψ and ψ × l.
- [x] i18n: Wärmebrücke, längenbezogener Wärmedurchgangskoeffizient, Gebäudeecke, Fensteranschluss, Sockel, Traufe, Geschossdecke.

## 22. Roof shapes

Goal: a house reads as a house, and the roof area feeds the heat loss. Answers element types and geometry.

- [x] Data model: `Roof { kind: "flat" | "gable" | "hip"; pitch: number; overhang: number; ridgeAxis: "x" | "y"; parapet?: number }` on the building; default flat with 0.3 m parapet.
- [x] `src/geometry/roof.ts`, pure, for rectangular and general convex footprints: gable roof as two planes meeting at a ridge along the chosen axis, hip roof as the straight skeleton of the footprint (implement for convex polygons, fall back to gable for concave with a documented limitation), flat roof as a slab with parapet. Output: roof faces as 3D polygons in metres, ridge and eave lines, true surface area, enclosed attic volume.
- [x] Tests: gable on the 10 by 8 rectangle at 40 degrees gives two faces of equal area, surface area equals footprint area divided by cos(pitch) plus overhang strips, eave height equals storey top, ridge height equals half span times tan(pitch); hip roof faces sum to the same area as the gable for a square; flat roof area equals footprint area.
- [x] Scene: roof faces as meshes in a roof colour, underside not rendered, eave overhang visible, opacity follows the top storey. Clicking the roof selects it.
- [x] Properties: kind as segmented control, pitch and overhang as number inputs with live update, ridge axis toggle.
- [x] Energy: roof area in the envelope uses the true sloped area for gable and hip; the attic counts as unheated (no volume added) unless a "heated attic" switch is on.
- [x] IFC: IfcRoof with IfcSlab members of PredefinedType ROOF, one per face, as IfcFacetedBrep or extruded solids; ridge height exported in Pset_RoofCommon (TotalArea, ProjectedArea).
- [x] Print view plan gets the ridge line and the roof kind in the building fields.
- [x] i18n: Flachdach, Satteldach, Walmdach, Dachneigung, Dachüberstand, Firstrichtung, Attika.

## 23. Footprint from a photo

Goal: drop a floor plan scan and get a proposed footprint and interior walls. Answers the computer vision bullet, which has nothing behind it yet.

- [x] Pipeline in `src/geometry/vision/`, pure over pixel arrays so it runs in a worker and in tests: greyscale, adaptive threshold, morphological close, connected components, then wall line detection with a probabilistic Hough transform restricted to horizontal and vertical lines, merging of collinear segments, snapping to a detected grid pitch.
- [x] Outer boundary: the largest closed loop of detected lines becomes the footprint proposal; inner lines that touch the boundary or each other become interior wall proposals. Output is in image pixels with a confidence per segment.
- [x] Scale: the user marks one known distance on the image (reuse the underlay scale flow) or types the paper scale (1:100 at a given DPI); pixels convert to metres and snap to the 0.5 m grid.
- [x] Tests on synthetic plans rendered in the test: a drawn rectangle with two interior lines is recovered within one pixel; a rotated scan (2 degrees) is deskewed first and still recovered; noise speckles do not create walls.
- [x] Worker: the pipeline runs in a Web Worker so the interface stays responsive on a 4000 px scan; progress reported.
- [x] Review step in the interface: proposed lines drawn over the underlay in the selection colour, each toggleable, a confidence filter slider, "Accept" replaces the footprint and interior walls in one undo step.
- [ ] Stretch: a small ONNX segmentation model for walls in the browser through onnxruntime-web, behind a feature flag, compared against the classical pipeline on the test plans. Only if the classical result is not good enough on real scans.
- [x] `DECISIONS.md` entry on classical CV versus a model and what real scans broke.

## 24. HVAC as elements

Goal: the element type the posting lists and the demo left out. Answers "new element types".

- [x] Data model: `Radiator { id, storeyId, wallIndex, offset, width, height, power }`, `HeatPump { position, power, kind: "air" | "ground" }` outside the footprint, `PipeRun { storeyId, points }` on the grid. Stored on the building, validated on import (a radiator stays on its wall and never overlaps an opening).
- [x] Sizing: room heat load from the energy layer (transmission plus ventilation for that room at the design temperature difference, Berlin −12 °C outdoor) suggests a radiator power; the heat pump power suggests itself from the building heat load with a safety factor. Pure functions, tested.
- [x] Scene: radiators as slabs on the inner wall face under windows, heat pump as a box outside, pipes as lines on the floor. Selectable, with properties.
- [x] Tool: an HVAC tool (key 7) that places a radiator on a wall click, a heat pump on a ground click outside the footprint, and pipe runs by clicking grid points.
- [x] Energy tab: heat load per room versus installed radiator power, flagged when under 90 percent.
- [x] IFC: IfcSpaceHeater (radiators), IfcUnitaryEquipment (heat pump), IfcPipeSegment for runs, with Pset_SpaceHeaterTypeCommon OutputCapacity. Validated.
- [x] i18n: Heizkörper, Wärmepumpe, Rohrleitung, Heizlast, Auslegungstemperatur.

## 25. Sun and shading

Goal: a real sun over the georeferenced model and solar gains in the energy balance. Answers physics and 3D.

- [x] `src/geometry/sun.ts`, pure: solar position (azimuth, elevation) from date, time and lat/lon using the NOAA algorithm; tests against published values for Berlin on 21 June noon and 21 December noon, sunrise and sunset within 2 minutes.
- [x] Scene: a directional light follows the sun, shadows on facades and ground, a date and time slider in the View section, a small sun path arc drawn over the model for the chosen day.
- [x] Solar gains: monthly irradiation on vertical surfaces per orientation for Berlin (DIN V 18599-10 table values, sourced), window area by orientation times g-value 0.6 times a frame factor 0.7 times a shading factor 0.9; annual gains subtracted from the heating demand with a utilisation factor of 0.95. Tests: a south window adds more than a north window; the demand never goes below zero.
- [x] Energy tab: gains as a separate line, before and after, and the class recomputed.
- [x] i18n: Sonnenstand, solare Gewinne, Einstrahlung, Uhrzeit.

## 26. IFC import

Goal: read an IFC file from another tool into Bauwerk. Answers export fidelity and reverse engineering.

- [x] `src/geometry/step-parse.ts`: STEP tokenizer and entity parser (ids, types, attributes, typed values, lists, X2 strings), tested on the files the exporter writes and on hand-written edge cases.
- [x] `src/geometry/ifc-import.ts`: walk IfcProject to storeys, read IfcBuildingStorey elevations, walls with IfcExtrudedAreaSolid over polyline profiles, openings via IfcRelVoidsElement, windows and doors via IfcRelFillsElement with OverallWidth and OverallHeight, spaces as rooms, zones via IfcRelAssignsToGroup, Pset ThermalTransmittance into constructions, IfcMapConversion into the origin.
- [x] Reduction to the editor's model: the footprint is the union outline of exterior walls (outer faces), interior walls become centre lines, room polygons are recomputed by the editor rather than trusted. Everything the model cannot hold (curved walls, sloped walls, non-rectangular openings) is listed in an import report shown to the user, not silently dropped.
- [x] Tests: export then import of the two example buildings gives an equal building up to ids; a file with a curved wall imports the rest and reports the wall; a file from another tool (a small sample checked into `docs/`) imports its storeys and walls.
- [x] Import button accepts `.ifc`, shows the report, loads on confirm.
- [x] `DECISIONS.md` entry on what was reduced and why.

## 27. Renovation scenarios as saved variants

Goal: the iSFP roadmap as named variants side by side. Answers product thinking.

- [x] Data model: `Scenario { id, name, constructionOverrides: Record<targetKey, constructionId>, bridgeSet, roof?, cost }` on the building; the current state is the baseline, variants are overrides only, so a change to the baseline flows into every variant.
- [x] Costs: a rough €/m² per construction preset (sourced from a public cost index, named in a comment), so each variant reports an investment; saving per year from the heating demand difference at a set energy price; payback in years.
- [x] Energy: `computeEnergy(building, { scenario })` applies the overrides; tests that the baseline variant equals the current result and that "windows only" changes only window terms.
- [x] Interface: a Scenarios tab with a table of variants (class, demand, saving, investment, payback), add, rename, duplicate, delete, and a per-variant construction picker. The old renovated switch becomes the built-in "full envelope" variant.
- [x] Print view: a Sanierungsfahrplan page with the variants as steps in order of payback, the way the iSFP shows them.
- [x] Export: scenarios in the JSON and, as IfcPropertySets on the building, in the IFC.
- [x] i18n: Sanierungsvariante, Investition, Einsparung pro Jahr, Amortisation, Maßnahmenpaket.

## 28. Section cut

- [x] A clipping plane through the model: a switch in the View section, a slider for the cut height and a segmented control for the cut axis (horizontal, along x, along y); Three.js clipping planes on every material, cap faces drawn in the mark colour so cut walls read as solid.
- [x] Rooms stay labelled in the cut view; the plan view reuses the horizontal cut at eye height.
- [x] Test: the clipping plane constant follows the slider value and the storey elevation.

## 29. Walkthrough camera

- [x] First person mode: a camera at 1.6 m above the active storey floor, WASD and arrow keys to move, mouse look with pointer lock, collision with exterior and interior walls, doors passable, stairs not modelled so PageUp and PageDown teleport between storeys.
- [x] Enter and exit through a View switch and the Escape key; the orbit camera position is restored on exit.
- [x] Test: the collision helper keeps a point inside the footprint and outside interior wall thickness, and lets it through a door span.

## 30. PDF report

- [x] Server endpoint `POST /reports/:projectId` renders the print view to PDF with headless Chromium (Playwright) on the server, vector plans, A4, file name from the building and date. Attribution and disclaimer included.
- [x] Client: a "Download PDF" button next to Print when the server is configured; the browser print path stays for local use.
- [x] Test: the endpoint returns a PDF whose first page contains the building name (checked with pdf-parse).

## 31. Performance page

- [x] A benchmark route `?bench=1` that loads a fifty storey, twenty openings per storey building, shows a frame time graph over ten seconds, draw calls and triangle count from the renderer info, and a paragraph on the memoisation strategy (geometry per element by input hash, merged prisms per wall, throttled hover).
- [ ] Instanced interior walls and merged room fills per storey if the benchmark falls below 60 fps on the RTX 5070 or 30 fps on integrated graphics.
- [ ] The numbers from Adilzhan's machine written into the README.
