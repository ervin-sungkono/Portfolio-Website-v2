#!/usr/bin/env python3
"""Check retained arcade art provenance and recorded editor round trips."""
import hashlib
import json
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[2]
work = root / 'art/arcade-assets'
manifest = json.loads((work / 'manifest.json').read_text(encoding='utf-8'))
errors = []

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

for item in manifest['assets']:
    name = item['id']
    for field, expected in [('concept', 'conceptSha256'), ('editable', 'editableSha256'), ('output', 'sha256'), ('runtime', 'sha256')]:
        path = root / item[field]
        if not path.is_file() or digest(path) != item[expected]:
            errors.append(f'{name}: missing {field} or hash mismatch')
    path = root / item['output']
    roundtrip = work / 'working' / (name + '-roundtrip.png')
    if not path.is_file() or not roundtrip.is_file():
        errors.append(f'{name}: output or recorded round trip missing')
        continue
    with Image.open(path) as source, Image.open(roundtrip) as reopened:
        image = source.convert('RGBA')
        exported = reopened.convert('RGBA')
        alpha = image.getchannel('A')
        levels = {value for _, value in alpha.getcolors(256)}
        bounds = alpha.getbbox()
        if list(image.size) != item['dimensions'] or not bounds or list(bounds) != item['bounds']:
            errors.append(f'{name}: unexpected size or visible bounds')
        elif bounds[0] == 0 or bounds[1] == 0 or bounds[2] == image.width or bounds[3] == image.height:
            errors.append(f'{name}: artwork touches a canvas edge')
        if not levels.issubset({0, 255}):
            errors.append(f'{name}: alpha is not binary')
        if image.size != exported.size or image.tobytes() != exported.tobytes():
            errors.append(f'{name}: editable-source round trip differs')
        print(f'{name}: {image.size}, visible {bounds}')

if errors:
    for error in errors:
        print('ERROR:', error)
    raise SystemExit(1)
print('Draft assets and recorded LibreSprite round trips validated; in-scene review remains required.')
