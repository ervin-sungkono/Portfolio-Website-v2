#!/usr/bin/env python3
"""Verify world-polish draft provenance, dimensions, alpha, and round trips."""

import hashlib
import json
from pathlib import Path

from PIL import Image

root = Path(__file__).resolve().parents[2]
work = root / 'art/world-polish'
manifest = json.loads((work / 'manifest.json').read_text(encoding='utf-8'))
errors = []

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

for entry in manifest['sourceSheets']:
    path = root / entry['path']
    if not path.is_file() or digest(path) != entry['sha256']:
        errors.append(f'{entry["id"]}: missing source or hash mismatch')

for entry in manifest['assets']:
    name = entry['id']
    path = root / entry['png']
    source = root / entry['editableSource']
    roundtrip = work / 'working' / (name + '-roundtrip.png')
    if not path.is_file() or digest(path) != entry['sha256']:
        errors.append(f'{name}: missing PNG or hash mismatch')
        continue
    if not source.is_file() or digest(source) != entry['editableSha256']:
        errors.append(f'{name}: missing editable source or hash mismatch')
    if not roundtrip.is_file():
        errors.append(f'{name}: missing recorded round trip')
        continue
    with Image.open(path) as image, Image.open(roundtrip) as reopened:
        rgba = image.convert('RGBA')
        exported = reopened.convert('RGBA')
        if list(rgba.size) != entry['dimensions']:
            errors.append(f'{name}: unexpected dimensions {rgba.size}')
        alpha = rgba.getchannel('A')
        levels = {value for count, value in alpha.getcolors(256)}
        bounds = alpha.getbbox()
        if not levels.issubset({0, 255}):
            errors.append(f'{name}: non-binary alpha')
        if not bounds or list(bounds) != entry['visualBounds']:
            errors.append(f'{name}: unexpected bounds {bounds}')
        elif bounds[0] == 0 or bounds[1] == 0 or bounds[2] == rgba.width or bounds[3] == rgba.height:
            errors.append(f'{name}: visible pixels touch an edge')
        if rgba.size != exported.size or rgba.tobytes() != exported.tobytes():
            errors.append(f'{name}: recorded editor round trip differs')
        print(f'{name}: {rgba.width}x{rgba.height}; visible={bounds}; anchor={entry["suggestedBaseAnchor"]}')

if errors:
    for error in errors:
        print('ERROR:', error)
    raise SystemExit(1)
print('File and recorded round-trip checks passed; scene review remains required.')
