#!/usr/bin/env python3
"""Check a procedural edging atlas and its Tiled placement without editing images."""
from json import loads
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[2]
image = Image.open(root / 'public/game/tiles/town-edges.png').convert('RGBA')
assert image.size == (128, 128), 'Unexpected atlas size'
assert set(image.getchannel('A').get_flattened_data()) <= {0, 255}, 'Edge alpha must be binary'
for mask in range(16):
    x, y = (mask % 4) * 32, (mask // 4) * 32
    alpha = image.crop((x, y, x + 32, y + 32)).getchannel('A')
    assert (alpha.getbbox() is not None) == (mask != 0), f'Invalid tile for mask {mask}'
source = (root / 'art/maps/town.tmj').read_text()
assert source == (root / 'public/game/maps/town.json').read_text(), 'Map export is stale'
map_data = loads(source)
assert any(item['name'] == 'town-edges' and item['firstgid'] == 33 for item in map_data['tilesets'])
layers = {layer['name']: layer for layer in map_data['layers']}
ground, edges = layers['ground']['data'], layers['ground-edges']['data']
w, h = map_data['width'], map_data['height']
assert len(ground) == len(edges) == w * h

def paved(x, y):
    if not (0 <= x < w and 0 <= y < h): return False
    gid = ground[y*w+x]
    return 0 < gid <= 32 and (gid-1) % 8 >= 4

for y in range(h):
    for x in range(w):
        expected = 0
        if paved(x, y):
            mask = (not paved(x,y-1)) | ((not paved(x+1,y)) << 1) | ((not paved(x,y+1)) << 2) | ((not paved(x-1,y)) << 3)
            expected = 33 + mask if mask else 0
        assert edges[y*w+x] == expected, f'Wrong edge at {x},{y}'
print(f'Edge atlas and {sum(gid != 0 for gid in edges)} boundary placements verified.')
