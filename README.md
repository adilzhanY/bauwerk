<div align="center">
  <img src="docs/shots/hero.png" alt="Bauwerk, draw the house, read the heating bill" width="100%" />
</div>

<div align="center">
  <br/>
  <a href="https://adilzhany.github.io/bauwerk/"><img src="https://img.shields.io/badge/live-adilzhany.github.io%2Fbauwerk-1b1d20?style=for-the-badge&labelColor=1b1d20&color=234d8f" alt="Live demo" /></a>
  <img src="https://img.shields.io/badge/React-18-1b1d20?style=for-the-badge&labelColor=1b1d20&color=234d8f" alt="React 18" />
  <img src="https://img.shields.io/badge/TypeScript-strict-1b1d20?style=for-the-badge&labelColor=1b1d20&color=234d8f" alt="TypeScript strict" />
  <img src="https://img.shields.io/badge/Three.js-r3f-1b1d20?style=for-the-badge&labelColor=1b1d20&color=234d8f" alt="Three.js via react-three-fiber" />
  <img src="https://img.shields.io/badge/tests-353%20passing-1b1d20?style=for-the-badge&labelColor=1b1d20&color=2f7a4f" alt="353 tests passing" />
</div>

<br/>

<div align="center">
  <h3>Most building tools draw walls.<br/>This one tells you what the walls cost you every winter.</h3>
  <p><b>Bauwerk</b> is a browser-based 3D editor for the people who renovate Germany's
  19 million homes: energy consultants. Draw a house in a minute, and while you draw,
  it computes the U-values, the heat loss, the Energieausweis class, the heat load of
  every room, the GEG check and the payback of each renovation step. Then it prints the
  German report. No install, no account, every change undoable.</p>
</div>

<br/>

---

## A house you can grab

<img src="docs/shots/framed/scene.png" alt="Kreuzberg apartment house on its OpenStreetMap plot" width="100%" />

Open the demo project and you are standing in front of a 1905 apartment house in
Kreuzberg, on its real plot, on the OpenStreetMap ground. Three storeys, a shop at the
street, two flats per floor around an unheated stairwell, a gable roof with a heated attic.

Press <kbd>8</kbd>, grab it, and slide it along the street: the latitude and longitude in
the chip follow live. Hold <kbd>Shift</kbd> to turn it and the south windows become west
windows, and the solar gains move with them. <kbd>Ctrl</kbd>+<kbd>Z</kbd> twice, and it is
back where it was. **Every drag, every scrub, every typed value is one undo step.**

## Walls that know what they are

<table>
<tr>
<td width="48%"><img src="docs/shots/framed/openings.png" alt="Windows and doors cut into the walls" /></td>
<td valign="top">

### Click a wall, get the right thing

Click an exterior wall with the Opening tool: a window. Click an interior wall: a door.
<kbd>Shift</kbd> swaps them. Drag a window along its wall and the hole moves with it,
without CSG: every wall is split into prisms around its openings and merged into one mesh,
68 triangles for a wall with three windows, deterministic and tested.

### Rooms are not drawn

Draw an interior wall and the rooms appear on their own, with their floor areas. Delete
the wall and they merge back and keep their names. Group rooms into heated and unheated
zones and the physics follows: the stairwell's outer walls leave the envelope, and the
flat's wall to the stairwell enters it at half weight, the way EnEV says.

### Other storeys stay out of the way

The floors you are not editing draw as outlines, ghosts or not at all, the way Revit's
halftone underlay and ArchiCAD's ghost story do it. The floor you edit is never hidden.

</td>
</tr>
</table>

## The heating bill, live

<img src="docs/shots/framed/energy.png" alt="Energy panel with the Energieausweis scale, losses, gains and GEG check" width="100%" />

The Energy tab is the heating period balance of **DIN V 4108-6**, computed on every change:

| What you see                     | What it is                                                                                                                                                                                            |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Energieausweis scale**         | The coloured A+ to H band with a marker for today and one for the scenario you are viewing.                                                                                                           |
| **H<sub>T</sub>, H<sub>V</sub>** | Transmission and ventilation heat loss in W/K, with the EnEV correction factors 0.6 for the floor slab and 0.5 for walls to unheated rooms, and every thermal bridge as ψ times length.               |
| **Solar and internal gains**     | Sun through the windows by orientation, 22 kWh per square metre from people and appliances, both 95 % usable.                                                                                         |
| **Heating demand**               | 66 kKh of the German reference climate times the losses, minus the gains. Divided by heated floor area: the number the class is made of.                                                              |
| **GEG check**                    | Every assigned construction against GEG Annex 7. The 1905 house passes 0 of 5.                                                                                                                        |
| **Heat load per room**           | DIN EN 12831 at minus 14 °C for Berlin, with the installed radiators and a red flag when they are undersized, and the heat pump size that falls out of it: 62 kW before insulation, a fraction after. |

U-values are not typed in. Open a construction and you see its layers, outside to inside,
with λ and R per layer and the U-value after ISO 6946. Scrub the insulation thickness and
watch the class letter change while you drag.

## What to do first, and what it costs

<table>
<tr>
<td valign="top">

### Scenarios on the same model

A renovation scenario is a set of overrides: which construction each category uses, the
thermal bridge detailing, the roof. Change the baseline and every variant follows.

For the Kreuzberg house: insulate the facade for about 75,000 euros and the class goes from
G to E with a 16-year payback. Windows and roof, 95,000 euros, class F. Everything at once,
219,000 euros, class B, saving about 8,500 euros a year.

### The roadmap consultants sell

The saved scenarios are ordered by payback and applied one on top of the other, three years
apart, with the class after every step and the running total. That is the shape of the
individueller Sanierungsfahrplan a homeowner needs for the higher funding rate.

Prices are per square metre starting values and the panel says so. A consultant replaces
them with quotes.

</td>
<td width="48%"><img src="docs/shots/framed/scenarios.png" alt="Scenarios with investment, payback and the renovation roadmap" /></td>
</tr>
</table>

## A report that leaves the office

<img src="docs/shots/framed/report.png" alt="Printed German building report with the energy scale and storey plans" width="100%" />

One click prints a plain German building document: building data, the energy table, the
Energieausweis scale with both markers, the GEG table, a plan per storey with every window
and door, the renovation roadmap, and a method page that states every assumption so a second
consultant can check the numbers. German number and date formats throughout, 18:04 not 6:04 pm.
With the server running, the same page comes back as a PDF.

## Speaks the industry's formats

- **IFC4 export** written by hand, validated with IfcOpenShell: spatial tree, mitred walls,
  every window and door a real void filled by an IfcWindow or IfcDoor, rooms as IfcSpace,
  zones, U-values in the property sets, georeferencing through IfcMapConversion.
- **IFC import** of walls, openings, storeys and spaces from other tools, with a report of
  what could not be read.
- **GeoJSON** in and out, **UTM** coordinates (EPSG:258xx) checked against PROJ to a millimetre.
- **Footprint from a photo**: drop a scanned plan and a classical vision pipeline proposes the
  outline and the interior walls for you to accept or trim.
- **JSON** with a versioned, validated schema and migrations for older files.

## Built to be looked at

|           |                                                                                                                      |
| --------- | -------------------------------------------------------------------------------------------------------------------- |
| Client    | about 23,000 lines of TypeScript, strict, `noUncheckedIndexedAccess`                                                 |
| Tests     | 353 client tests in 55 files, 8 server tests against a real Postgres                                                 |
| Geometry  | pure functions in `src/geometry/`, no Three.js allowed inside, enforced by lint                                      |
| State     | one Zustand store, a 60-line history middleware that batches gestures into single undo steps                         |
| Controls  | every slider, select, switch, number field and dialog built from scratch, keyboard complete, no native control shows |
| Languages | English and German, a missing key is a type error                                                                    |
| Server    | NestJS and Postgres, optimistic concurrency, WebSocket rooms with presence, PDF through headless Chromium            |

### How it was built

Bauwerk was made in three weeks with **Claude Code as the primary way code is produced**, and
a human steering, reviewing and correcting it. `DECISIONS.md` records 45 places where the human
overruled the agent, and it is part of the deliverable.

The most useful entry: the day before the interview the agent was asked to audit its own
formulas. It found five errors in its physics, all under green tests, because the tests had
pinned the agent's own numbers instead of the standard's. The fix moved the example house from
324 to 252 kWh/(m²a), which is where the IWU building typology puts an unrenovated pre-1918
house. The agent produces. The human decides what is true.

## Run it

```
npm install --legacy-peer-deps
npm run dev        # http://localhost:5173
npm run check      # typecheck, lint, tests
npm run build      # production build in dist/
```

Then Settings, Examples, **Kreuzberg apartment house (demo)**. The eight-minute walkthrough is
in [`DEMO.md`](DEMO.md), the handbook of every number on the screen is in the interview notes.

Open `/?bench=1` for an 18-storey tower with 719 openings, a frame time graph and the renderer's
draw call and triangle counts.

### With the server

```
docker compose up --build        # Postgres, the NestJS server on :3000, the client on :8080
```

Or by hand: `cd server && npm install --legacy-peer-deps && DATABASE_URL=postgres://user:pass@localhost:5432/bauwerk npm run dev`,
then `VITE_API_URL=http://localhost:3000 npm run dev` in the root. Create a project, open the same
link in a second tab, move a window, and watch it move in the first. Each write carries the version
it was based on; a stale write gets a 409 and the client rebases. Of twelve simultaneous writes on
the same version exactly one wins, and the test proves it.

### IFC validation

```
python -m venv .venv && .venv/bin/pip install ifcopenshell pytest
.venv/bin/python scripts/validate-ifc.py docs/example-house.ifc docs/example-block.ifc
```

Both files report zero issues and every product builds.

---

<div align="center">
  <sub>Bauwerk is a portfolio project by Adilzhan Yerzhan. The physics follows the simplified
  procedures of DIN V 4108-6 and DIN EN 12831 and is not a substitute for a certified
  Energieausweis. Costs are starting values.</sub>
</div>
