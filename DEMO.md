# Bauwerk in eight minutes

The script for the interview demo. One browser tab, the dev server running, English UI, light theme. Every step names the click and the sentence to say. Rehearse it twice; the second run is the one that fits in eight minutes.

## Before the meeting

- `npm run dev`, open the app, Settings section, Examples, choose "Kreuzberg apartment house (demo)". Reload once so the map tiles are cached.
- Close the browser console. Zoom the browser to 100 %.
- Have `docs/example-house.ifc` open in an IFC viewer in a second window in case the IFC question comes.
- Have DECISIONS.md open in the editor in a third window.

## 0:00 The claim (30 s)

Say: "This is Bauwerk, a browser-based building editor I built in three weeks with Claude Code as the primary way code gets produced, with me steering, reviewing and correcting it. The editor is the product; the process is what I want to show you, because it is the job."

Point at the scene: an unrenovated 1905 apartment house in Kreuzberg, on its real plot on the OpenStreetMap ground.

## 0:30 Geometry (2 min)

1. Orbit once. Say: three storeys, a shop at the street, two flats per floor around an unheated stairwell, a gable roof with a heated attic.
2. Storey switch in the left panel: click "Ground floor". The floors above turn into outlines. Say: "Other storeys draw as outlines, the way Revit's halftone underlay or ArchiCAD's ghost story does it, so the floor you edit is never covered."
3. Openings tool (key 3). Click the street wall: a window appears. Click an interior wall: a door appears. Say: "Doors between rooms, windows in the facade, the tool decides by the wall you click. Shift swaps it."
4. Drag the new window along the wall. Press Ctrl+Z twice. Say: "Every gesture is one undo step, including drags and typed values."
5. Interior wall tool (key 4), draw one wall across the shop. Two rooms appear with their areas. Say: "Rooms are derived from the walls, not drawn. Delete the wall and they merge back."

## 2:30 Energy (2 min)

6. Open the Energy tab on the right. Point at the class band: G, 239 kWh per square metre and year. Say: "Heating period method of DIN V 4108-6: 66 kelvin-kilohours, transmission and ventilation losses, solar and internal gains, thermal bridges as psi times length. The panel says which assumptions it makes."
7. Scroll to the GEG check: 0 of 5 pass. Say: "Every element against the GEG Annex 7 limit. This is the first question a consultant asks."
8. Constructions: open "Brick wall, uninsulated", show the layer stack and U = 1.47. Say: "U-values come from layers after ISO 6946, not from a typed number. Change a thickness and the whole balance updates live."
9. Heat load block: rooms with their loads, radiators undersized in red. Say: "DIN EN 12831 room by room, minus 14 degrees design temperature for Berlin, so the radiators and the heat pump size fall out of the same model."

## 4:30 Scenarios and report (1.5 min)

10. Scenarios tab. Two variants plus "Full envelope". Point at payback years. Say: "Scenarios are override sets on the same model. Change the baseline and every variant follows."
11. Toggle "Renovated view": the walls recolour by U-value. Toggle back.
12. Settings, Print. The report opens: plain German document layout, Energieausweis scale with both markers, GEG table, storey plans, method text. Say: "This is what leaves the office. No UI chrome, German number and date formats."

## 6:00 Collaboration and exchange (1 min)

13. Bottom bar: Export IFC. Say: "IFC4 written by hand, validated with IfcOpenShell, every opening is a real void."
14. If the server is running: open the project in a second tab, move a window, watch it move in the first tab. Otherwise say it in one sentence: "With the NestJS and Postgres server, edits sync over WebSockets with optimistic concurrency; twelve simultaneous writes, exactly one wins, the rest rebase."

## 7:00 The process (1 min)

15. Switch to DECISIONS.md. Say: "Forty entries where I overruled the agent. Yesterday I asked it to audit its own formulas. Five errors, all with green tests, because the tests pinned its own numbers. The fix moved this house from 324 to 252 kilowatt-hours, which is where the IWU typology puts it. That is the job: the agent produces, the human decides what is true."
16. Close: "Three hundred tests, a fixed stack, one store, pure geometry with no Three.js in it. I can walk through any file you pick."

## If asked

- Why no CSG for openings: walls are split into prisms around holes and merged, deterministic and testable, 68 triangles for a wall with three windows.
- Why Zustand and not Redux: one store, Immer, a 60-line history middleware that batches gestures.
- What is simplified: single reference climate, no hot water, no system losses, class shown on heating demand not final energy, costs are starting points.
- What broke: the map tiles were culled for three fixes because nobody measured the quad normal; the fourth fix computed it.
