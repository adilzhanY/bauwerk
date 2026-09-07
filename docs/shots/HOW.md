# The README screenshots

The README is a product page. It references five screenshots in `docs/shots/framed/`
that do not exist yet, because this machine cannot drive a browser. Take them once,
at the sizes below, and the page is complete. `hero.png` is generated and already there.

## Before you shoot

- `npm run dev`, light theme, English, browser zoom 100 %, window about 1600 px wide.
- Settings, Examples, **Kreuzberg apartment house (demo)**. Reload once so the map
  tiles are cached and fully painted.
- Close the browser console and any extension bars. Hide the mouse cursor or park it
  on an empty spot of the canvas.
- An honest screenshot of the real demo data sells more than a staged one. Do not
  edit the numbers afterwards.

## The shot list

| File                   | Stage                                                                                                                                                 | What must be visible                                                             |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `framed/scene.png`     | Whole app, Select tool, house orbited so the street facade and the gable roof both show, map tiles under it, coordinate chip readable                 | Left panel on Storeys, right panel on Properties, floating toolbar at the bottom |
| `framed/openings.png`  | Ground floor active, upper storeys as outlines, one window and one interior door just placed, the window selected so its properties show on the right | The outline storeys above, the door between shop and stairwell                   |
| `framed/energy.png`    | Energy tab, scrolled so the scale, the two big numbers, the losses block and the GEG check with "0 of 5 pass" are on screen                           | Class G, 239 kWh/(m²a)                                                           |
| `framed/scenarios.png` | Scenarios tab with the three rows and the roadmap under them                                                                                          | Payback years and the roadmap steps                                              |
| `framed/report.png`    | Settings, Print, the first page of the report at 100 %                                                                                                | Energy table, the scale with both markers, the GEG table                         |

Crop each to the browser content area, no window chrome. PNG, full resolution.

## Framing

Torq's `build-shots.py` puts a device frame around phone shots. For a desktop app a
thin rounded border on a paper background is enough, and this one-liner does it:

```bash
for f in docs/shots/*.png; do
  n=$(basename "$f"); [ "$n" = hero.png ] && continue
  magick "$f" -bordercolor '#d9dad2' -border 2 \
    \( +clone -alpha extract -draw 'fill black polygon 0,0 0,18 18,0 fill white circle 18,18 18,0' \
       \( +clone -flip \) -compose Multiply -composite \( +clone -flop \) -compose Multiply -composite \) \
    -alpha off -compose CopyOpacity -composite \
    -background '#f6f6f2' -flatten "docs/shots/framed/$n"
done
```

Put the raw shots in `docs/shots/`, run the loop, commit both folders.
