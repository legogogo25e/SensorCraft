#!/usr/bin/env bash
# Regenerate css/font.css from Monocraft (SIL OFL 1.1).
# Requires: curl, unzip, python3 + fonttools (pyftsubset), base64.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

VERSION="v4.2.1"
URL="https://github.com/IdreesInc/Monocraft/releases/download/${VERSION}/Monocraft-ttf.zip"

echo "downloading Monocraft ${VERSION}…"
curl -fsSL "$URL" -o "$TMP/monocraft.zip"
unzip -oq "$TMP/monocraft.zip" -d "$TMP/monocraft"

FONT="$(find "$TMP/monocraft" -name 'Monocraft.ttf' -print -quit)"
if [[ -z "$FONT" ]]; then
  echo "Monocraft.ttf not found in archive" >&2
  exit 1
fi

mkdir -p "$ROOT/build/fonts"
pyftsubset "$FONT" \
  --unicodes="U+0020-007E,U+00A0-00FF,U+2013,U+2014,U+2018,U+2019,U+201C,U+201D,U+2022,U+2026,U+2190-2193,U+25B2,U+25BC,U+25C0,U+25B6,U+2713,U+2717,U+00D7" \
  --flavor=woff2 \
  --output-file="$ROOT/build/fonts/monocraft-ascii.woff2" \
  --layout-features='*' \
  --no-hinting \
  --desubroutinize

curl -fsSL "https://raw.githubusercontent.com/IdreesInc/Monocraft/main/LICENSE" \
  -o "$ROOT/build/fonts/Monocraft-OFL.txt"

{
  printf '/* Monocraft (SIL OFL 1.1) ASCII subset — see build/fonts/Monocraft-OFL.txt */\n'
  printf '@font-face{font-family:"Monocraft";font-style:normal;font-weight:400;font-display:swap;src:url(data:font/woff2;base64,'
  base64 -w0 "$ROOT/build/fonts/monocraft-ascii.woff2"
  printf ') format("woff2");}\n'
} > "$ROOT/css/font.css"

echo "wrote css/font.css"
