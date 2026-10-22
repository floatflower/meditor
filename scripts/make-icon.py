"""Build build/icon.png (1024x1024) from build/icon-source.png.

The source is the artwork on a flat background. It is shrunk to the 824px plate of Apple's icon grid,
cut to a squircle, and given a soft shadow on a transparent 1024px canvas. electron-builder turns
the result into .icns / .ico.  Needs Pillow and numpy:  python3 scripts/make-icon.py
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

root = Path(__file__).resolve().parent.parent
source = Image.open(root / 'build' / 'icon-source.png').convert('RGBA')

CANVAS, PLATE = 1024, 824
offset = (CANVAS - PLATE) // 2

# Superellipse (|x|^5 + |y|^5 = 1) is a close match for the macOS icon shape.
y, x = np.mgrid[0:PLATE, 0:PLATE]
u, v = (x - PLATE / 2 + 0.5) / (PLATE / 2), (y - PLATE / 2 + 0.5) / (PLATE / 2)
mask = Image.fromarray((np.clip((1 - (np.abs(u) ** 5 + np.abs(v) ** 5)) * 40, 0, 1) * 255).astype('uint8'), 'L')

canvas = Image.new('RGBA', (CANVAS, CANVAS), (0, 0, 0, 0))
shadow = Image.new('RGBA', (CANVAS, CANVAS), (0, 0, 0, 0))
shadow.paste(Image.new('RGBA', (PLATE, PLATE), (0, 0, 0, 90)), (offset, offset + 12), mask)
canvas.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(14)))
canvas.paste(source.resize((PLATE, PLATE), Image.LANCZOS), (offset, offset), mask)

canvas.save(root / 'build' / 'icon.png')
print('wrote build/icon.png', canvas.size)
