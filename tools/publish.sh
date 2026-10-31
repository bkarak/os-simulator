#!/bin/sh
# Copy the simulator into a web directory: the site keeps it under public/play/oss/.
#   tools/publish.sh ../html-bkarak/web-app/public/play/oss
set -e
dest=${1:?usage: tools/publish.sh <directory>}
mkdir -p "$dest"
here=$(cd "$(dirname "$0")/.." && pwd)
for f in index.html embed.html oss.css engine.js help.js oss.js; do
  cp "$here/src/$f" "$dest/$f"
  chmod 644 "$dest/$f"
done
echo "published to $dest"
