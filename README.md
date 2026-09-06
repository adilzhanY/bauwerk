# Bauwerk

A browser-based 3D building editor for energy consultants, built as an interview demo for the 20° GmbH Full-Stack Engineer role. Draw a footprint, stack storeys, cut windows and doors into exterior and interior walls, derive rooms from the walls, group rooms into heated and unheated zones, put a roof on top, place the building on the map, and read the energy balance, the heat loads, the GEG check and the renovation scenarios live while you edit. Undo anything. Export JSON, IFC4, GeoJSON and a German building report.

Built by Adilzhan Yerzhan in three weeks with Claude Code as the primary way code is produced, reviewed and steered by a human. `DECISIONS.md` logs every place the human overruled the agent; it is part of the deliverable.

## Numbers

|                  |                                                                                                                                         |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Client code      | about 23,000 lines of TypeScript in `src/`                                                                                              |
| Server code      | about 860 lines in `server/src/`                                                                                                        |
| Tests            | 301 client tests in 50 files, 8 server tests against a real Postgres                                                                    |
| Logged overrules | 40 entries in `DECISIONS.md`                                                                                                            |
| Languages        | English and German, a missing key is a type error                                                                                       |
| Stack            | Vite, React 18, TypeScript strict, Zustand, Three.js via react-three-fiber, Tailwind CSS v4, Vitest; NestJS and Postgres for the server |

## Run

```
npm install --legacy-peer-deps
npm run dev        # start the dev server
npm run check      # typecheck, lint, tests
npm run build      # production build in dist/
npm run preview    # serve the production build
```

The `--legacy-peer-deps` flag works around an npm 10 crash while resolving Vitest's optional peers. The eight-minute demo script is in `DEMO.md`; load "Kreuzberg apartment house (demo)" from Settings, Examples.

## How it fits together

- `src/geometry/` holds pure functions over numbers and arrays: polygon checks, wall offsets and mitres, opening validation, room extraction from interior walls, roofs, the energy balance, thermal bridges, heat loads, scenarios, the GEG check, UTM projection, map tiles, IFC export and import, JSON export and import. No Three.js in here, enforced by a lint rule, so everything is tested in Vitest without WebGL.
- `src/store/` is one Zustand store with Immer. A small history middleware records every change to the building and gives exact undo and redo; a drag or a typing burst is one step. UI state such as selection, tool and view settings is never recorded.
- `src/scene/` turns geometry output into meshes. Openings do not use CSG: each wall is split into prisms around its openings and the prisms are merged into one mesh. Storeys other than the active one draw as outlines, ghosts or not at all, per a view setting.
- `src/components/` are the form controls, built from scratch so nothing native shows: slider, number input with label scrubbing, select, switch, segmented control, dialog, tabs. Each has its own test.
- `src/ui/` holds the panels and the print view. Every string goes through `src/i18n/`.
- `server/` is a NestJS API with plain `pg`, optimistic concurrency and a WebSocket room per project, plus PDF printing of the report through headless Chromium.

## What it computes, and against what

- **U-values** from layer stacks after DIN EN ISO 6946, with the standard surface resistances. Presets follow the IWU building typology for the German stock.
- **Energy balance** with the heating period method of DIN V 4108-6: 66 kKh degree hours of the German reference climate, ventilation 0.34 · 0.5 · V, temperature correction factors 0.6 for the floor slab and 0.5 for walls to unheated rooms, solar gains by orientation with the EnEV irradiation values, internal gains of 22 kWh/(m²a), thermal bridges as ψ times length from the geometry. The Energieausweis class is applied to the heating demand and labelled as the approximation it is.
- **Heat loads** room by room after DIN EN 12831 simplified, with −14 °C for Berlin, and radiator and heat pump sizing from them.
- **GEG check** of every assigned construction against Annex 7 for existing buildings.
- **Scenarios** as override sets with investment, saving and payback from documented starting prices.
- **Geo** with a fourth-order Krüger UTM projection checked against PROJ to a millimetre, OpenStreetMap tiles at true scale, sun position after NOAA with shadows.

## The audit

The day before the interview the agent was asked to check every formula against its source. It found five errors in its own physics, all under green tests, because the tests had pinned the agent's numbers instead of the standard's: 84 instead of 66 kKh, no internal gains, no ground and unheated-room correction factors, −12 instead of −14 °C, and uninsulated presets whose layer stacks computed U-values two to three times their labels. The example house moved from 324 to 252 kWh/(m²a), which is where the typology puts an uninsulated pre-1918 house. The full list is in `DECISIONS.md` under 2026-09-06.

## Performance

Open `/?bench=1` for a fifty storey tower with twenty openings per storey, a frame time graph over the last ten seconds and the renderer's draw call and triangle counts. Geometry is built once per element and memoised by a hash of its inputs; each wall is a single merged mesh of prisms; hover writes to the store at most once per frame; inactive storeys are excluded from raycasting.

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
