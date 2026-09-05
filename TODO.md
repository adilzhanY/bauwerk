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

- [ ] `src/geometry/types.ts` with the interfaces from `INFO.md`.
- [ ] `src/lib/ids.ts`: short unique ids, deterministic in tests.
- [ ] `src/store/building.ts`: Zustand store holding `building`, `activeStoreyId`, `selection`, `tool`, `language`. Default building: a 10 m by 8 m rectangle, one storey, no openings.
- [ ] `src/store/history.ts`: undo and redo middleware. Every action that changes `building` pushes a snapshot. Cap history at 200 entries. UI state (selection, tool, language) is not part of history.
- [ ] Actions: `setFootprintVertex`, `addStorey`, `removeStorey`, `setStoreyHeight`, `renameStorey`, `setWallThickness`, `addOpening`, `updateOpening`, `removeOpening`, `addInteriorWall`, `removeInteriorWall`, `renameRoom`, `assignRoomToZone`, `addZone`, `updateZone`, `removeZone`, `loadBuilding`, `undo`, `redo`, `select`, `clearSelection`, `setTool`, `setLanguage`.
- [ ] Tests: undo then redo is identity for every action. History cap holds. UI state is untouched by undo.

## 2. Geometry

- [ ] `polygon.ts`: signed area, orientation, ensure counter-clockwise, simple-polygon check (no self-intersection), point-in-polygon, edge list with lengths and outward normals.
- [ ] Tests for `polygon.ts` including a concave L-shaped footprint and a self-intersecting bowtie that must be rejected.
- [ ] `walls.ts`: from footprint and thickness, produce each exterior wall as a quad footprint (inner and outer offset lines, mitred at corners) plus height from the storey.
- [ ] Tests: wall count equals vertex count, mitred corners meet, thickness is honoured on a rectangle and on the L shape.
- [ ] `openings.ts`: validate an opening against its wall and its siblings (the invariants in `INFO.md`), clamp helper for the UI, and produce the wall's 2D profile with the opening subtracted as a polygon with a hole.
- [ ] Tests: every invariant has a failing case and a passing case. Two adjacent openings that touch exactly are allowed, overlapping by 1 mm is rejected.
- [ ] `rooms.ts`: from footprint and interior wall segments on the grid, compute the room polygons (planar face extraction on the grid) and their areas.
- [ ] Tests: no interior walls gives one room equal to the footprint. One wall across a rectangle gives two rooms whose areas sum to the footprint area. A dangling wall that does not split anything still gives one room.
- [ ] `export.ts`: `toJson(building)` and `fromJson(text)` with validation of every invariant on import and a clear error message on failure.
- [ ] Tests: round trip is deep equal, a JSON with an overlapping opening is rejected with the right message.

## 3. Scene

- [ ] `Viewport.tsx`: Canvas, orbit controls limited so the camera never goes below the ground, soft lighting, grid at 0.5 m, a ground plane.
- [ ] `Camera.tsx`: fit the building on load, animate to the active storey over 300 ms.
- [ ] `Wall.tsx`: extrude the wall profile (with holes) into a mesh. Exterior walls in the wall colour, selected wall in the accent colour, hovered wall slightly lighter.
- [ ] `Opening.tsx`: draw a translucent pane for windows and a door slab for doors inside the hole, so the hole reads as an opening and not as a gap.
- [ ] `Storey.tsx`: floor slab, walls, openings, interior walls, room fills coloured by zone. Inactive storeys at 25 percent opacity and not clickable.
- [ ] `Room.tsx`: flat fill on the floor with the zone colour, name label facing the camera (drei `Html` or `Text`).
- [ ] Picking: click selects, click on empty space clears, hover state in the store is throttled so the viewport does not re-render on every mouse move.
- [ ] Performance: 5 storeys with 20 openings each stays above 60 fps on the RTX 5070 and above 30 fps on integrated graphics. Memoise geometry per element by a hash of its inputs.

## 4. Tools and editing

- [ ] Select tool: click any element, Delete removes it, Escape clears.
- [ ] Footprint tool: vertices shown as draggable handles on the ground plane, snapped to the grid, live validation, invalid shapes shown in the warning colour and not committed.
- [ ] Opening tool: click a wall to place a window at the click position with default size; hold Shift for a door. Then drag the opening along the wall, snapped to 0.1 m.
- [ ] Interior wall tool: click two grid points on the active storey to add a wall segment. Preview line while placing.
- [ ] Zone tool: click rooms to toggle them into the active zone.
- [ ] Keyboard shortcuts from `INFO.md`, with a small shortcut sheet behind a `?` button.

## 5. UI panels

- [ ] `LeftPanel.tsx`: storey list with add, remove, rename, reorder by drag; tool palette; settings for wall thickness, grid visibility, language.
- [ ] `RightPanel.tsx`: properties of the selection. Wall: length, thickness, number of openings. Opening: kind, offset, width, height, sill, with sliders and number inputs, validation message when invalid. Room: name, area, zone select. Storey: name, height. Zone: name, colour from the fixed set.
- [ ] `BottomBar.tsx`: undo, redo (disabled when nothing to do), export, import, status line.
- [ ] Empty state when the building has no storeys, and a WebGL-missing state.
- [ ] Below 1024 px: full-screen message that the editor needs a desktop browser.
- [ ] Focus rings, labels, keyboard operation of every panel control.

## 6. Internationalisation

- [ ] `src/i18n/index.ts`: `t(key)` hook bound to the store language, typed keys, missing key is a compile error.
- [ ] `en.ts` complete.
- [ ] `de.ts` complete, checked against a dictionary. Storey naming rules: ground floor "Erdgeschoss", then "1. Obergeschoss", "2. Obergeschoss"; English "Ground floor", "1st floor", "2nd floor".
- [ ] Language persisted in localStorage, default from `navigator.language`.
- [ ] Number formatting via `Intl.NumberFormat` in inputs and status line.

## 7. Persistence and export

- [ ] Autosave the building to localStorage on every change, restore on load, "Reset to example" button.
- [ ] Export button downloads `bauwerk-<name>-<date>.json`.
- [ ] Import button opens a file picker, validates, shows the error message inline if invalid.
- [ ] Two example buildings bundled: a simple two-storey house and an L-shaped three-storey block.

## 8. Quality gates

- [ ] `npm run check` green with zero warnings.
- [ ] Test coverage on `src/geometry/` and `src/store/` above 90 percent lines.
- [ ] Manual visual check of every state listed in `INFO.md` design principles, in both languages.
- [ ] `grep -rn "dash characters" src docs *.md` returns nothing.
- [ ] Lighthouse performance above 90 on the production build.

## 9. CI and deployment

- [ ] `.github/workflows/check.yml`: on push and pull request, install, `npm run check`, build.
- [ ] `.github/workflows/deploy.yml`: on push to `main`, build with the Pages base path and deploy with `actions/deploy-pages`, gated behind a GitHub environment that requires manual approval.
- [ ] Create the GitHub repository `adilzhanY/bauwerk`, public, push. Do not enable Pages until local testing is signed off by Adilzhan.
- [ ] After sign-off: enable Pages, approve the deployment, verify the live URL, add it to `README.md`.

## 10. Interview preparation

- [ ] Write the three minute walkthrough in `README.md` under "Demo path": open, add a storey, place a door and three windows, split into three rooms, create a heated zone with two rooms, undo four steps, redo them, export, switch the UI to German.
- [ ] Rehearse the walkthrough three times against the live URL, timed.
- [ ] `DECISIONS.md` has at least five real entries from the build. Pick the two best to tell.
- [ ] One minute explanations ready for: how openings cut the wall, how undo works, why geometry has no Three.js imports, what was cut and why.
- [ ] Read the Three.js basics once: scene, camera, mesh, BufferGeometry, raycasting, so the questions on the call land.
