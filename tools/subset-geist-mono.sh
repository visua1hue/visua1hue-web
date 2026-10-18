#!/usr/bin/env sh
# Subsets Geist Mono Regular to Basic Latin plus a few dashes and spaces used by the mono labels.
# Usage: tools/subset-geist-mono.sh path/to/GeistMono-Regular.woff2
# Source: dist/fonts/geist-mono/ in the `geist` npm package.
set -eu
src="${1:?path to GeistMono-Regular.woff2}"
uvx --from 'fonttools[woff]' pyftsubset "$src" \
  --unicodes='U+0020-007E,U+00A0,U+2013,U+2014,U+2190' \
  --layout-features='*' \
  --flavor=woff2 \
  --output-file=src/assets/fonts/GeistMono-Regular.woff2
