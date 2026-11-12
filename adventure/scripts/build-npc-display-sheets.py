#!/usr/bin/env python3
"""Prepare size-adjusted NPC frames without changing the original artwork.

Requires Pillow. Use --check to verify the committed exports.
"""
from pathlib import Path
import json
import sys
from PIL import Image, ImageChops

root = Path(__file__).resolve().parent.parent
check = sys.argv[1:] == ['--check']
if sys.argv[1:] not in ([], ['--check']):
    raise SystemExit('Usage: python3 scripts/build-npc-display-sheets.py [--check]')

config = json.loads((root / 'src/content/npcs.json').read_text())
for name in sorted({npc['sprite'] for npc in config}):
    sheet = Image.new('RGBA', (67 * 4, 90))
    for frame in range(4):
        source = Image.open(root / f'public/game/npcs/{name}/idle-{frame}.png').convert('RGBA')
        if source.size != (96, 128):
            raise ValueError(f'Unexpected NPC frame dimensions: {name}/{frame}')
        sheet.paste(source.resize((67, 90), Image.Resampling.BOX), (frame * 67, 0))
    destination = root / f'public/game/sheets/{name}-display.png'
    if check:
        existing = Image.open(destination).convert('RGBA')
        if existing.size != sheet.size or ImageChops.difference(existing, sheet).getbbox(alpha_only=False):
            raise ValueError(f'NPC display sheet differs: {destination}')
    else:
        sheet.save(destination, optimize=True)
    print(f'{destination.name}: {sheet.width}x{sheet.height}, 4 frames')
