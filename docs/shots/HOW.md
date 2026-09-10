# The README artwork

`docs/shots/*.png` are raw screenshots and are not committed. `hero.png` and
`framed/*.png` are built from them by `scripts/frame-shots.sh` and are.

## 1. Fonts, once

The artwork is set in the app's own Archivo and Manrope, taken from
`node_modules` and instanced to static weights:

```bash
python -m venv .venv && .venv/bin/pip install fonttools brotli
.venv/bin/python scripts/shot-fonts.py     # writes docs/shots/.fonts/*.ttf
```

Without them the script falls back to a system sans and the artwork looks off brand.

## 2. Shoot

`npm run build`, serve `dist/`, load the **Kreuzberg apartment house (demo)**
example, light theme, English, 1600 by 1000 at a device scale factor of 2.

| Raw file              | What it is                                                                    |
| --------------------- | ----------------------------------------------------------------------------- |
| `scene.png`           | Whole app on the ground floor, house on its map plot. Becomes the hero.       |
| `openings.png`        | Whole app with the first floor active, so the storeys below draw as outlines. |
| `energy-panel.png`    | Element screenshot of the right panel on the Energy tab.                      |
| `scenarios-panel.png` | Element screenshot of the right panel on the Scenarios tab.                   |
| `report-page.png`     | Element screenshot of the first `.page` of `/?print=1`.                       |

The panel shots must be element screenshots, not crops: the coordinate chip is a
drei `Html` overlay that paints over the panel. Hide the overlays first with

```js
div[style*="translate3d"], div[style*="translate("] { visibility: hidden !important; }
```

Stage the app honestly. Real demo data sells; edited numbers are a lie.

## 3. Frame

```bash
./scripts/frame-shots.sh
```

Wide shots get a browser window with chrome, panel shots get a floating card, and
the hero puts the scene on a dark board under the wordmark. Needs ImageMagick 7.
