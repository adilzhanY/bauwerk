"""Writes the app's own Archivo and Manrope as static TTFs for the README artwork."""

import pathlib
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

root = pathlib.Path(__file__).resolve().parent.parent
out = root / "docs" / "shots" / ".fonts"
out.mkdir(parents=True, exist_ok=True)
sources = {
    "archivo": (root / "node_modules/@fontsource-variable/archivo/files/archivo-latin-wght-normal.woff2", {700: "Bold"}),
    "manrope": (root / "node_modules/@fontsource-variable/manrope/files/manrope-latin-wght-normal.woff2", {700: "Bold", 500: "Med", 400: "Reg"}),
}
for name, (src, weights) in sources.items():
    for weight, label in weights.items():
        font = TTFont(src)
        instancer.instantiateVariableFont(font, {"wght": weight}, inplace=True)
        font.flavor = None
        font.save(out / f"{name}-{label}.ttf")
        print(out / f"{name}-{label}.ttf")
