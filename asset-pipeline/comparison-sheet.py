"""Builds the device-quality comparison sheet from the 1920 px exports written by
tests/e2e/device-quality.spec.ts (SPIKE_OUTPUT). Usage:
  python3 asset-pipeline/comparison-sheet.py <exports dir> <out.jpg>
"""

import sys

from PIL import Image, ImageDraw, ImageFont

src, out = sys.argv[1], sys.argv[2]
panels = [
    ("a-production-2d-1920", "1. Production renderer (Canvas 2D, today)"),
    ("b-spike-v1-floating-minimal-1920", "2. Best spike pre-render (v1 device, ADR 0011)"),
    ("c-v2-three-quarter-right-1920", "3. Improved model v2, three-quarter view"),
    ("e-v2-three-device-1920", "4. v2 three-device composition"),
]
W, H, LABEL = 960, 540, 44
font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 20)
sheet = Image.new("RGB", (W * 2, (H + LABEL) * 2), (20, 20, 22))
draw = ImageDraw.Draw(sheet)
for i, (name, label) in enumerate(panels):
    x, y = (i % 2) * W, (i // 2) * (H + LABEL)
    sheet.paste(Image.open(f"{src}/{name}.png").convert("RGB").resize((W, H), Image.LANCZOS), (x, y + LABEL))
    draw.text((x + 16, y + 11), label, fill=(235, 235, 238), font=font)
sheet.save(out, quality=90, optimize=True)
print(f"Wrote {out}")
