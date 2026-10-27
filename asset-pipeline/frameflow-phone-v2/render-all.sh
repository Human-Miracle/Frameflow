#!/usr/bin/env bash
# Renders the Frameflow Phone v2 angle library (pipeline v2) into
# public/lab-assets/frameflow-phone-v2/<view>/ and masters into asset-pipeline/build/.
# Every view must pass the pipeline's quality gate; a rejected view stops the run.
# Usage: BLENDER_PYTHON=/path/to/venv/bin/python asset-pipeline/frameflow-phone-v2/render-all.sh [view-id ...]
set -euo pipefail
cd "$(dirname "$0")/../.."
: "${BLENDER_PYTHON:?Set BLENDER_PYTHON to a Python with the bpy module (pip install bpy==5.2.3 pillow)}"
mkdir -p asset-pipeline/build
geometry=asset-pipeline/build/frameflow-phone-v2.geometry.json
node --experimental-strip-types --no-warnings asset-pipeline/export-geometry.mjs FRAMEFLOW_PHONE_V2 "$geometry"
node -e '
  const views = require("./asset-pipeline/frameflow-phone-v2/views.json");
  const only = process.argv.slice(1);
  for (const v of views) if (only.length === 0 || only.includes(v.id)) console.log(JSON.stringify(v));
' "$@" | while read -r view; do
  id=$(node -e "console.log(JSON.parse(process.argv[1]).id)" "$view")
  echo "Rendering $id"
  "$BLENDER_PYTHON" -I asset-pipeline/blender/render_device.py "$geometry" \
    "public/lab-assets/frameflow-phone-v2/$id" "asset-pipeline/build/frameflow-phone-v2/$id" "$view" \
    | grep -E '^\{"id"|rejected'
done
