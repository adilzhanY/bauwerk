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
