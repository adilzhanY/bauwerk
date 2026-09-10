#!/usr/bin/env bash
# Turns the raw screenshots in docs/shots/*.png into the artwork the README shows:
# a dark hero with the app in a browser window, framed windows for the wide
# sections and floating cards for the panel crops. Needs ImageMagick 7.
#
# Fonts: the real Archivo and Manrope the app ships. Generate them once with
#   python -m venv .venv && .venv/bin/pip install fonttools brotli
#   .venv/bin/python scripts/shot-fonts.py
# which writes docs/shots/.fonts/*.ttf. Without them the script falls back to
# whatever sans the system has, and the artwork looks off brand.
set -euo pipefail
cd "$(dirname "$0")/.."
SHOTS=docs/shots
F=$SHOTS/.fonts
fallback=$(fc-match -f '%{file}' 'Space Grotesk' 2>/dev/null || echo "")
DISPLAY_BOLD=${DISPLAY_BOLD:-$([ -f "$F/archivo-Bold.ttf" ] && echo "$F/archivo-Bold.ttf" || echo "$fallback")}
BODY=${BODY:-$([ -f "$F/manrope-Reg.ttf" ] && echo "$F/manrope-Reg.ttf" || echo "$fallback")}
BODY_MED=${BODY_MED:-$([ -f "$F/manrope-Med.ttf" ] && echo "$F/manrope-Med.ttf" || echo "$fallback")}

PAPER='#f6f6f2'; INK='#1b1d20'; MUTED='#666b73'; LINE='#d9dad2'
DARK='#141619'; DARK_BAR='#23272d'; DARK_PILL='#14171b'; DARK_INK='#f2f2ee'; DARK_MUTED='#9aa0a8'; DOT='#454b54'
URL='adilzhany.github.io/bauwerk'
tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT

# rounded <in> <out> <radius>: rounds the corners into the alpha channel.
rounded() {
  local w h; w=$(identify -format %w "$1"); h=$(identify -format %h "$1")
  magick -size "${w}x${h}" xc:black -fill white -draw "roundrectangle 0,0 $((w-1)),$((h-1)) $3,$3" "$tmp/mask.png"
  magick "$1" "$tmp/mask.png" -alpha off -compose CopyOpacity -composite "$2"
}

# drop <in> <out> <bg> <pad> <opacity>: paper background, soft shadow, padding.
drop() {
  local w h pad; w=$(identify -format %w "$1"); h=$(identify -format %h "$1"); pad=$4
  magick -size "$((w + 2 * pad))x$((h + 2 * pad + 14))" "xc:$3" \
    \( "$tmp/mask.png" -fill '#0d0f12' -opaque white -alpha copy -channel A -evaluate multiply "$5" +channel -blur 0x18 \) \
    -geometry "+${pad}+$((pad + 16))" -composite \
    "$1" -geometry "+${pad}+${pad}" -composite "$2"
}

# window <shot> <out> <width> light|dark: browser chrome above the screenshot.
window() {
  local shot=$1 out=$2 w=$3 mode=$4 bar dot pill text h
  if [ "$mode" = dark ]; then bar=$DARK_BAR; dot=$DOT; pill=$DARK_PILL; text=$DARK_MUTED
  else bar='#ecece6'; dot='#cbccc4'; pill='#ffffff'; text=$MUTED; fi
  local bh=$((w * 56 / 1600))
  magick "$shot" -resize "${w}x" +repage "$tmp/shot.png"
  magick -size "${w}x${bh}" "xc:$bar" \
    -fill "$dot" -draw "circle $((bh / 2)),$((bh / 2)) $((bh / 2 + 7)),$((bh / 2))" \
    -draw "circle $((bh / 2 + 30)),$((bh / 2)) $((bh / 2 + 37)),$((bh / 2))" \
    -draw "circle $((bh / 2 + 60)),$((bh / 2)) $((bh / 2 + 67)),$((bh / 2))" \
    -fill "$pill" -draw "roundrectangle $((w / 2 - 240)),$((bh / 2 - 15)) $((w / 2 + 240)),$((bh / 2 + 15)) 15,15" \
    -font "$BODY" -pointsize 17 -fill "$text" -annotate "+$((w / 2 - 108))+$((bh / 2 + 6))" "$URL" "$tmp/bar.png"
  magick "$tmp/bar.png" "$tmp/shot.png" -append "$tmp/win.png"
  rounded "$tmp/win.png" "$tmp/winr.png" 18
  if [ "$mode" = dark ]; then drop "$tmp/winr.png" "$out" "$DARK" 0 0.55
  else drop "$tmp/winr.png" "$out" "$PAPER" 26 0.30; fi
}

# card <shot> <out> <width>: a floating panel with a hairline and a shadow.
card() {
  magick "$1" -resize "$3x" +repage -bordercolor "$LINE" -border 1 "$tmp/c.png"
  rounded "$tmp/c.png" "$tmp/cr.png" 16
  drop "$tmp/cr.png" "$2" "$PAPER" 22 0.26
}

mkdir -p "$SHOTS/framed"
# The panel and report shots are element screenshots (see HOW.md); the report
# page is cropped to the first block that fits a README card.
magick "$SHOTS/report-page.png" -crop 1440x2040+0+116 +repage "$tmp/report-page.png"

window "$SHOTS/openings.png" "$SHOTS/framed/openings.png" 1500 light
card "$SHOTS/energy-panel.png" "$SHOTS/framed/energy.png" 620
card "$SHOTS/scenarios-panel.png" "$SHOTS/framed/scenarios.png" 620
card "$tmp/report-page.png" "$SHOTS/framed/report.png" 620

# Hero: title band over the app in a dark browser window, with an accent glow.
W=1760; PAD=64; BAND=214
window "$SHOTS/scene.png" "$tmp/hero-win.png" $((W - 2 * PAD)) dark
HW=$(identify -format %w "$tmp/hero-win.png"); HH=$(identify -format %h "$tmp/hero-win.png")
magick -size 1200x1200 radial-gradient:'#2f5da8'-"$DARK" -alpha set -channel A -evaluate multiply 0.5 +channel "$tmp/glow.png"
magick -size "${W}x$((BAND + HH + PAD))" "xc:$DARK" \
  "$tmp/glow.png" -geometry '+900-360' -compose over -composite \
  -font "$DISPLAY_BOLD" -pointsize 80 -fill "$DARK_INK" -annotate '+64+118' 'Bauwerk' \
  -font "$BODY" -pointsize 27 -fill "$DARK_MUTED" -annotate '+68+170' 'Draw the house. Read the heating bill.' \
  -fill '#1d2a40' -draw "roundrectangle $((W - 64 - 396)),86 $((W - 64)),136 25,25" \
  -font "$BODY_MED" -pointsize 20 -fill '#9dc0f7' -annotate "+$((W - 64 - 366))+118" "$URL" \
  "$tmp/hero-win.png" -geometry "+$(((W - HW) / 2))+$BAND" -composite \
  "$SHOTS/hero.png"
identify "$SHOTS/hero.png" "$SHOTS/framed"/*.png | sed 's/ .*PNG / /;s/ .*//'
