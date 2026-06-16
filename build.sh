#!/usr/bin/env bash
# Sestaví čistou složku dist/ jen se statickými soubory webu
# (bez skriptů, tokenu, .git apod.). Používá se lokálně i v Cloudflare Pages buildu.
#   Build command:           bash build.sh
#   Build output directory:  dist
set -euo pipefail
cd "$(dirname "$0")"
rm -rf dist
mkdir dist
cp index.html manifest.json sw.js dist/
cp -r css js assets icons dist/
echo "dist/ hotová: $(find dist -type f | wc -l) souborů"
