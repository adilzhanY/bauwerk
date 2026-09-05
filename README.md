# Bauwerk

A browser-based 3D building editor. Draw a footprint, stack storeys, cut windows and doors into the walls, split storeys into rooms, group rooms into zones, undo anything, and export the model as JSON. Built with Vite, React 18, TypeScript, Zustand, Three.js (react-three-fiber) and Tailwind CSS v4. Every geometry function is pure TypeScript with Vitest tests, and the UI ships in English and German.

## Run

```
npm install --legacy-peer-deps
npm run dev        # start the dev server
npm run check      # typecheck, lint, tests
npm run build      # production build in dist/
npm run preview    # serve the production build
```

The `--legacy-peer-deps` flag works around an npm 10 crash while resolving Vitest's optional peers.

## How it fits together

- `src/geometry/` holds pure functions over numbers and arrays: polygon checks, wall offsets and mitres, opening validation, room extraction from interior walls, JSON export and import. No Three.js in here, so it is tested in Vitest without WebGL.
- `src/store/` is one Zustand store with Immer. A small history middleware records every change to the building and gives exact undo and redo. UI state such as selection and tool is never recorded.
- `src/scene/` turns geometry output into meshes. Openings do not use CSG: each wall is split into prisms around its openings and the prisms are merged into one mesh.
- `src/ui/` holds the panels. Every string goes through `src/i18n/`, where a missing German key is a type error.

## Beyond the editor

- **Energy**: every wall, window, door, floor and roof has a construction with a U-value. The Energy panel shows envelope area, window-to-wall ratio by orientation, transmission and ventilation heat loss, heating demand and the Energieausweis class, with a renovated scenario next to the current state. The formulas and their simplifications are documented in `src/geometry/energy.ts` and checked against hand-computed values.
- **IFC**: an IFC4 export written by hand and validated with IfcOpenShell, see below.
- **Server and live editing**: a NestJS and Postgres backend with optimistic concurrency and WebSocket rooms, see below.
- **Geo**: place the footprint on the earth, see the UTM easting and northing (EPSG 258xx), export GeoJSON, import a GeoJSON footprint. The projection is checked against PROJ to 1 mm.
- **Consultant tools**: dimension labels, a 2D plan view, walls coloured by U-value, a room list, a measure tool, storey duplication, a floor plan image underlay for tracing, and a print view with plans, the room table and the energy summary.

## Performance

Open `/?bench=1` for a fifty storey tower with twenty openings per storey, a frame time graph over the last ten seconds and the renderer's draw call and triangle counts. Geometry is built once per element and memoised by a hash of its inputs; each wall is a single merged mesh of prisms; hover writes to the store at most once per frame; inactive storeys are excluded from raycasting. Measured numbers on the RTX 5070 and on integrated graphics: to be recorded by Adilzhan.

## Demo path

About three minutes, from an empty browser tab.

1. Open the app. The default building is a 10 by 8 m ground floor.
2. Click the plus button next to Storeys. A first floor appears and becomes active. Press PageDown to go back to the ground floor.
3. Choose the Opening tool (key 3). Shift+click the front wall to place a door. Click the same wall twice more to place two windows. Drag one window along the wall.
4. Press PageUp, then click a wall on the first floor to add a window there too.
5. Press PageDown. Choose the Interior wall tool (key 4). Click two grid points to draw a wall across the floor, then another wall to split one half again. Three rooms appear with their areas.
6. Click the plus button next to Zones. A zone called Zone 1 is created and the Zone tool is active. Click two rooms to paint them. Select the zone in the left panel and rename it to Heated.
7. Press Ctrl+Z four times and watch the zone assignments and the last wall disappear. Press Ctrl+Shift+Z four times to bring them back.
8. Click Export JSON in the bottom bar. Open the file: storeys, walls, openings, rooms and zones, in metres.
9. Switch the language to Deutsch in Settings. Every label, hint and error message changes.

## IFC export

The IFC button writes an IFC4 STEP file by hand, without a library, so the schema knowledge is in the code (`src/geometry/ifc.ts` and `src/geometry/step.ts`). It contains the spatial tree (project, site, building, storeys with elevations), exterior walls as extruded mitred quads, interior walls, floor and roof slabs, one opening element per window or door that voids its wall and is filled by an IfcWindow or IfcDoor, rooms as IfcSpace with their floor area, zones as IfcZone, and U-values in the common property sets. Left out: material layers, curtain walls, and georeferencing until the geo section lands.

The two example buildings are exported in `docs/` and validated with IfcOpenShell, which checks the schema and EXPRESS rules and rebuilds every solid:

```
python -m venv .venv && .venv/bin/pip install ifcopenshell pytest
.venv/bin/python scripts/validate-ifc.py docs/example-house.ifc docs/example-block.ifc
```

Both files report zero issues and every product builds. A wall with three openings comes out with 68 triangles instead of the 12 of a plain box, so the holes are real.

## Run with the server

The client works on its own with localStorage. With a server, projects live in Postgres and every open tab of the same project sees the others' changes.

```
docker compose up --build        # Postgres, the NestJS server on :3000, the client on :8080
```

Or by hand:

```
cd server && npm install --legacy-peer-deps
DATABASE_URL=postgres://user:pass@localhost:5432/bauwerk npm run dev
cd .. && VITE_API_URL=http://localhost:3000 npm run dev
```

The server also serves the client build from `dist/` when it exists and prints it to PDF through `POST /reports`, so build the client before starting the server if you want the Download PDF button.

Open the app, create a project from the Project section, and open the same link in a second tab. Each accepted write carries the version it was based on; a stale write gets a 409 with the current state, the client takes it and puts its own change on top (last write wins). Presence and selections travel over a WebSocket room per project. The server tests run against a real Postgres and check that of twelve simultaneous writes on the same version exactly one wins.

```
cd server && DATABASE_URL=postgres://bauwerk@127.0.0.1:5499/bauwerk_test npm test
```
