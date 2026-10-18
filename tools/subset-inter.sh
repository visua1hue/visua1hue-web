#!/usr/bin/env sh
# Shrinks InterVariable to Latin-1 plus common punctuation and arrows. Both variation
# axes stay intact: narrowing wght to the used 400-500 shifts glyph advances at
# weight 500 for larger optical sizes, which changes line breaks.
# Usage: tools/subset-inter.sh path/to/InterVariable.woff2   (full file from rsms/inter releases)
set -eu
src="${1:?path to full InterVariable.woff2}"
uvx --from 'fonttools[woff]' pyftsubset "$src" \
  --unicodes='U+0020-007E,U+00A0-00FF,U+2013-2014,U+2018-201D,U+2026,U+2190-2193' \
  --flavor=woff2 \
  --output-file=src/assets/fonts/InterVariable.woff2
