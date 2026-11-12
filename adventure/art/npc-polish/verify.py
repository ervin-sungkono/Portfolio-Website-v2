#!/usr/bin/env python3
"""Check the draft NPC frames and their retained source provenance."""

import hashlib
import json
from pathlib import Path

from PIL import Image, ImageChops

root = Path(__file__).resolve().parent
manifest = json.loads((root / 'manifest.json').read_text(encoding='utf-8'))
errors = []

for record in manifest['files']:
    path = root / record['path']
    if not path.is_file():
        errors.append(f"missing: {record['path']}")
    elif hashlib.sha256(path.read_bytes()).hexdigest() != record['sha256']:
        errors.append(f"checksum mismatch: {record['path']}")

for npc, expected_bottom in [('guide', 122), ('workshop', 124)]:
    frames = []
    for index in range(4):
        path = root / 'frames' / npc / f'idle-{index}.png'
        try:
            with Image.open(path) as image:
                image.load()
                if image.size != (96, 128) or image.mode != 'RGBA':
                    errors.append(f'{npc} frame {index}: expected 96×128 RGBA')
                    continue
                alpha = image.getchannel('A')
                colors = alpha.getcolors(256)
                bbox = alpha.getbbox()
                if not colors or any(value not in (0, 255) for _, value in colors):
                    errors.append(f'{npc} frame {index}: alpha is not binary')
                if not bbox or bbox[0] <= 0 or bbox[1] <= 0 or bbox[2] >= 96 or bbox[3] != expected_bottom:
                    errors.append(f'{npc} frame {index}: unexpected bounds {bbox}')
                frames.append(image.copy())
        except (OSError, ValueError) as exc:
            errors.append(f'{npc} frame {index}: {exc}')
    if len(frames) == 4:
        for index in range(1, 4):
            if ImageChops.difference(frames[0].convert('RGB'), frames[index].convert('RGB')).getbbox() is None:
                errors.append(f'{npc} frame {index}: identical to base')
            # Feet must not shift while the body or face animates.
            a = frames[0].crop((0, 100, 96, 128))
            b = frames[index].crop((0, 100, 96, 128))
            if ImageChops.difference(a.convert('RGB'), b.convert('RGB')).getbbox() or ImageChops.difference(a.getchannel('A'), b.getchannel('A')).getbbox():
                errors.append(f'{npc} frame {index}: feet area changed')
        for image in frames:
            image.close()

if errors:
    raise SystemExit('\n'.join(errors))
print('NPC draft checks passed: distinct poses, binary alpha, stable feet, intact source checksums.')
