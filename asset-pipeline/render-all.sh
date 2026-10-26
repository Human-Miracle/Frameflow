#!/usr/bin/env bash
# Renders every view in views.json into public/lab-assets/<device>/<view>/.
# Usage: BLENDER_PYTHON=/path/to/venv/bin/python asset-pipeline/render-all.sh
set -euo pipefail
cd "$(dirname "$0")/.."
: "${BLENDER_PYTHON:?Set BLENDER_PYTHON to a Python with the bpy module (pip install bpy)}"
mkdir -p asset-pipeline/build
node --experimental-strip-types --no-warnings asset-pipeline/export-geometry.mjs asset-pipeline/build/frameflow-phone.geometry.json
node -e 'for (const v of require("./asset-pipeline/views.json")) console.log(JSON.stringify(v))' | while read -r view; do
  id=$(node -e "console.log(JSON.parse(process.argv[1]).id)" "$view")
  echo "Rendering $id"
  "$BLENDER_PYTHON" -I asset-pipeline/blender/render_device.py \
    asset-pipeline/build/frameflow-phone.geometry.json "public/lab-assets/frameflow-phone/$id" "$view" \
    | grep -E '"passed"|rejected|Error'
done
