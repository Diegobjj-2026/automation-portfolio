#!/bin/sh
# Renders the Fiverr/Upwork gallery covers (1280x769) from cover.html with headless Chrome.
# Usage (Git Bash, repo root): sh gallery/render.sh
set -e
cd gallery
CHROME="/c/Program Files/Google/Chrome/Application/chrome.exe"
P="$(pwd -W)"
PROFILE="$(cygpath -w "${TMPDIR:-/tmp}")\\chrome-headless-portfolio"
for v in n8n data agent; do
  sed "s/__V__/$v/" cover.html > "_tmp-$v.html"
  "$CHROME" --headless=new --disable-gpu --user-data-dir="$PROFILE" --hide-scrollbars --window-size=1280,769 \
    --screenshot="$P\\cover-$v.png" "file:///$P/_tmp-$v.html" >/dev/null 2>&1
  rm "_tmp-$v.html"
done
ls -l cover-*.png
