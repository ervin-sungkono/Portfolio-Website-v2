#!/usr/bin/env python3
"""Inspect draft art assets without modifying images."""

import hashlib
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
manifest = json.loads((ROOT / 'art/tiles-work/manifest.json').read_text())
errors = []

for entry in manifest['generation']['sources'] + manifest['terrain'] + manifest['props']:
    relative = entry.get('png', entry.get('path'))
    path = ROOT / relative
    if not path.is_file():
        errors.append(f'{relative}: missing')
        continue
    if hashlib.sha256(path.read_bytes()).hexdigest() != entry['sha256']:
        errors.append(f'{relative}: hash mismatch')
    with Image.open(path) as image:
        image.load()
        if 'width' not in entry:
            print(f'Generation source {relative}: {image.size}, {image.mode}')
            continue
        if image.size != (entry['width'], entry['height']):
            errors.append(f'{relative}: incorrect dimensions {image.size}')
        alpha = image.convert('RGBA').getchannel('A')
        alpha_levels = {a for count, a in alpha.getcolors(256)}
        if relative in {x['png'] for x in manifest['terrain']}:
            if alpha_levels != {255}:
                errors.append(f'{relative}: terrain must be fully opaque')
            pix = image.convert('RGB')
            w, h = pix.size
            def delta(a, b):
                return sum(abs(x-y) for x, y in zip(a, b)) / 3
            interior_x = sum(delta(pix.getpixel((x, y)), pix.getpixel((x+1, y))) for y in range(h) for x in range(w-1)) / (h*(w-1))
            interior_y = sum(delta(pix.getpixel((x, y)), pix.getpixel((x, y+1))) for y in range(h-1) for x in range(w)) / (w*(h-1))
            boundary_x = sum(delta(pix.getpixel((0, y)), pix.getpixel((w-1, y))) for y in range(h)) / h
            boundary_y = sum(delta(pix.getpixel((x, 0)), pix.getpixel((x, h-1))) for x in range(w)) / w
            print(f'{entry["id"]}: {w}×{h} opaque; boundary x/y {boundary_x:.2f}/{boundary_y:.2f}; interior x/y {interior_x:.2f}/{interior_y:.2f}')
            cell = entry.get('cellSize')
            if cell and w % cell == 0 and h % cell == 0:
                gx = [sum(delta(pix.getpixel((x-1, y)), pix.getpixel((x, y))) for y in range(h)) / h for x in range(cell, w, cell)]
                gy = [sum(delta(pix.getpixel((x, y-1)), pix.getpixel((x, y))) for x in range(w)) / w for y in range(cell, h, cell)]
                print(f'  internal {cell}px boundaries x={list(round(v,2) for v in gx)} y={list(round(v,2) for v in gy)}')
        else:
            bounds = alpha.getbbox()
            if not alpha_levels.issubset({0, 255}):
                errors.append(f'{relative}: non-binary alpha')
            if bounds != tuple(entry['visualBounds']):
                errors.append(f'{relative}: visual bounds changed: {bounds}')
            if not bounds or bounds[0] <= 0 or bounds[1] <= 0 or bounds[2] >= image.width or bounds[3] >= image.height:
                errors.append(f'{relative}: artwork touches an edge')
            print(f'{entry["id"]}: {image.size}, bounds={bounds}, base={entry["suggestedBaseAnchor"]}')
        if not (ROOT / entry['source']).is_file():
            errors.append(f'{entry["id"]}: editable source missing')

if errors:
    for error in errors:
        print('ERROR:', error)
    raise SystemExit(1)
print('File checks passed; art and scene approval are still required.')
