<div align="center">
  <img src="docs/shots/hero.png" alt="Bauwerk, draw the house, read the heating bill" width="100%" />
</div>

<div align="center">
  <br/>
  <a href="https://adilzhany.github.io/bauwerk/"><img src="https://img.shields.io/badge/try%20it-adilzhany.github.io%2Fbauwerk-141619?style=for-the-badge&labelColor=141619&color=2f5da8" alt="Live demo" /></a>
  <img src="https://img.shields.io/badge/TypeScript-strict-141619?style=for-the-badge&labelColor=141619&color=2f5da8" alt="TypeScript strict" />
  <img src="https://img.shields.io/badge/Three.js-r3f-141619?style=for-the-badge&labelColor=141619&color=2f5da8" alt="Three.js via react-three-fiber" />
  <img src="https://img.shields.io/badge/tests-353-141619?style=for-the-badge&labelColor=141619&color=2f7a4f" alt="353 tests" />
</div>

<br/>

<div align="center">
  <h3>Every building tool can draw a wall.<br/>This one tells you what that wall costs you every winter.</h3>
  <p>Germany has 19 million homes to renovate and one profession standing between them and
  the law: energy consultants. <b>Bauwerk</b> is their sketchpad. Draw a house in a minute and
  watch the U-values, the heat loss, the Energieausweis class, the heat load of every room and
  the payback of every renovation step move while you draw. Then print the German report.
  Browser only, no install, no account, every change undoable.</p>
</div>

<br/>

---

## Draw a building the way you would sketch one

<img src="docs/shots/framed/openings.png" alt="Editing the first floor, the ground floor drawn as an outline below" width="100%" />

Footprint, storeys, walls. Click an exterior wall with the Opening tool and you get a window,
click an interior wall and you get a door, <kbd>Shift</kbd> swaps them. Drag an interior wall
across a floor and rooms appear on their own with their areas; delete it and they merge back
under their old names.

Grab the whole house with <kbd>8</kbd> and slide it along the street: it is standing on its real
OpenStreetMap plot, so the latitude and longitude update while you drag. Turn it and the south
windows become west windows, and the solar gains follow. The floors you are not editing draw as
outlines, the way Revit's halftone underlay does it, so nothing hides your work. **Every drag,
scrub and typed value is exactly one undo step.**

## The heating bill, recomputed on every keystroke

<table>
<tr>
<td width="42%"><img src="docs/shots/framed/energy.png" alt="Energy panel: class scale, losses, gains and areas" /></td>
<td valign="top">

### Physics with a source, not a guess

The balance is the heating period method of **DIN V 4108-6**: transmission and ventilation
losses, the EnEV correction factors for the floor slab and the unheated stairwell, thermal
bridges as ψ times length, solar gains by orientation and internal gains, against 66 kKh of the
German reference climate.

The 1905 Kreuzberg house in the demo: **237 kWh per square metre and year, class G**, 96,422 kWh
of heat, about 11,000 euros of gas a winter.

### U-values are computed, never typed

Open a construction and you see its layers, outside to inside, with λ and R and the U-value
after **ISO 6946**. Scrub the insulation thickness and watch the class letter move while you drag.

### The checks a consultant runs first

Every element against the **GEG Annex 7** limit, pass or fail. Heat load per room after
**DIN EN 12831** at minus 14 °C for Berlin, with undersized radiators flagged in red and the heat
pump that falls out of it: 62 kW today, a fraction of that after insulation. That is the argument
the whole trade is built on.

</td>
</tr>
</table>

## What to fix first, and what it pays back

<table>
<tr>
<td valign="top">

### Scenarios are overrides, not copies

A scenario says which construction each category uses and how good the details are. Change the
baseline and every variant follows. For the demo house: the facade for 75,418 euros takes it from
G to E and pays back in 16 years; windows and roof cost more and pay back slower; everything at
once is 219,414 euros, class B, and about 8,500 euros saved a year.

### The roadmap they actually sell

Steps ordered by payback, applied one on top of the other, each row showing the class after it and
the running total. That is the shape of the **individueller Sanierungsfahrplan** a homeowner needs
for the higher funding rate.

Prices are per square metre starting values, and the panel says so out loud. A consultant swaps in
real quotes.

</td>
<td width="42%"><img src="docs/shots/framed/scenarios.png" alt="Scenarios with investment and payback, and the renovation roadmap" /></td>
</tr>
</table>

## And then it prints the document

<table>
<tr>
<td width="42%"><img src="docs/shots/framed/report.png" alt="German building report, first page" /></td>
<td valign="top">

One click turns the model into a plain German building document: building data, energy table,
the Energieausweis scale with today and the target on it, the GEG table, a plan per storey with
every window and door, the roadmap, and a method page that states every assumption so a second
consultant can check the numbers. German dates and decimal commas throughout. With the server
running, the same page comes back as a PDF.

**It speaks the industry's formats too.** IFC4 export written by hand and validated with
IfcOpenShell, where every opening is a real void filled by an IfcWindow or IfcDoor. IFC import
with a report of what could not be read. GeoJSON in and out, UTM coordinates checked against PROJ
to the millimetre. Or drop a photo of a floor plan and let the vision pipeline propose the outline.

</td>
</tr>
</table>

## Under the hood

|               |                                                                                                                                                                                    |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Geometry**  | Pure functions in `src/geometry/`, no Three.js allowed inside, enforced by lint. Walls are split into prisms around their openings and merged, no CSG anywhere.                    |
| **State**     | One Zustand store and a 60-line history middleware that folds a whole gesture into a single undo step.                                                                             |
| **Interface** | Every slider, select, switch, number field and dialog built from scratch, keyboard complete, no native control on screen. English and German, where a missing key is a type error. |
| **Server**    | NestJS and Postgres, optimistic concurrency, WebSocket rooms with presence, PDF through headless Chromium. Twelve simultaneous writes on one version, exactly one wins.            |
| **Proof**     | 353 client tests, 8 server tests against a real Postgres, strict TypeScript with `noUncheckedIndexedAccess`.                                                                       |

**How it was built.** Three weeks, with Claude Code as the primary way code was produced and a
human steering it. [`DECISIONS.md`](DECISIONS.md) logs 45 places where the human overruled the
agent. The best one: asked to audit its own physics, the agent found five errors of its own, all
under green tests, because the tests had pinned its own numbers instead of the standard's. The
fix moved the example house by about 70 kWh/(m²a), into the range the IWU typology gives an
unrenovated pre-1918 building. The agent produces, the human decides what is true.

## Run it

```bash
npm install --legacy-peer-deps
npm run dev      # http://localhost:5173
npm run check    # typecheck, lint, 353 tests
```

Settings, Examples, **Kreuzberg apartment house (demo)** loads the house from the screenshots.
[`DEMO.md`](DEMO.md) is the eight-minute walkthrough. `/?bench=1` opens an 18-storey tower with 719
openings and a frame time graph. `docker compose up --build` brings up Postgres, the API and the
client together.

---

<div align="center">
  <sub>A portfolio project by Adilzhan Yerzhan. The physics follows the simplified procedures of
  DIN V 4108-6 and DIN EN 12831 and is not a substitute for a certified Energieausweis.
  Costs are starting values.</sub>
</div>
