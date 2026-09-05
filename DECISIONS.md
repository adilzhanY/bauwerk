# Decisions

The review log. Every entry is a place where the human overruled, corrected, rejected or deliberately constrained what the agent produced, or made a design call the agent could not make alone. This file is shown at the interview, so write it for a reader who was not there.

Format for each entry:

```
## YYYY-MM-DD  Short title

What the agent did or proposed.
Why it was wrong, risky, or not the call to make automatically.
What was done instead, and how it was verified.
```

## 2026-09-05  Scope cut before the first line of code

The posting lists windows and openings, rooms, zones, HVAC, multi-storey support and richer editing tools. HVAC, roofs, real IFC export, textures and collaboration were cut on purpose. Two days are available and a finished small editor with tests is worth more in the call than a broad unfinished one. The cut list is written in `INFO.md` so it can be said out loud rather than discovered.

## 2026-09-05  Geometry is pure and Three.js free

Decided before generation: everything under `src/geometry/` is plain TypeScript over numbers and arrays, with no Three.js import, so it can be unit tested in Vitest without a WebGL context and so the correctness argument does not depend on rendering. The scene layer only converts geometry output into meshes. The agent is not allowed to relax this, see `CLAUDE.md`.
