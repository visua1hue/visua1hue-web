#!/usr/bin/env sh
# Default layout features only: stylistic sets ss01-ss11 are unused and double the file.
# Usage: .github/scripts/subset-geist-mono.sh path/to/GeistMono-Regular.woff2   (from `geist` npm: dist/fonts/geist-mono/)
set -eu
src="${1:?path to GeistMono-Regular.woff2}"
uvx --from 'fonttools[woff]' pyftsubset "$src" \
  --unicodes='U+0020-007E,U+00A0,U+2013,U+2014,U+2190' \
  --flavor=woff2 \
  --output-file=src/assets/fonts/GeistMono-Regular.woff2
