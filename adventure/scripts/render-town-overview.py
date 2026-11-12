"""Offline art composition proof; this does not render or test the browser UI."""
import argparse
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageChops

ROOT = Path(__file__).resolve().parents[1]
read = lambda path: json.loads((ROOT / path).read_text())
world = read('src/content/world.json')
town = read('art/maps/town.tmj')
props = read('src/content/props.json')
groups = read('art/town-redesign/runtime/groups.json')['groups']
npcs = read('src/content/npcs.json')
assert town['width'] * 32 == world['width'] and town['height'] * 32 == world['height']
canvas = Image.new('RGBA', (world['width'], world['height']))
layers = {layer['name']: layer for layer in town['layers']}
tilesets = []
for item in town['tilesets']:
    source = (ROOT / 'art/maps' / item['image']).resolve()
    tilesets.append((item, Image.open(source).convert('RGBA')))
tilesets.sort(key=lambda pair: pair[0]['firstgid'], reverse=True)
for layer in town['layers']:
    if layer['type'] != 'tilelayer' or not layer.get('visible', True):
        continue
    for index, gid in enumerate(layer['data']):
        if not gid:
            continue
        if layer['name'] == 'water' and 'river-water' in props:
            sheet = Image.open(ROOT / 'public' / props['river-water']['url'].lstrip('/')).convert('RGBA')
            water_top = next(i // town['width'] for i, value in enumerate(layer['data']) if value)
            x = index % town['width'] % 3 * 32
            y = (index // town['width'] - water_top) % 3 * 32
            canvas.alpha_composite(sheet.crop((x, y, x + 32, y + 32)), (index % town['width'] * 32, index // town['width'] * 32))
            continue
        item, sheet = next(pair for pair in tilesets if pair[0]['firstgid'] <= gid)
        cell = gid - item['firstgid']
        x, y = cell % item['columns'] * 32, cell // item['columns'] * 32
        canvas.alpha_composite(sheet.crop((x, y, x + 32, y + 32)), (index % town['width'] * 32, index // town['width'] * 32))

images = {}
def image(url, frame_width=None):
    key = (url, frame_width)
    if key not in images:
        source = Image.open(ROOT / 'public' / url.lstrip('/')).convert('RGBA')
        images[key] = source.crop((0, 0, frame_width, source.height)) if frame_width else source
    return images[key]

draws = []
part_bounds = {}
def place(source, x, y, origin_x, origin_y, scale, depth):
    width, height = round(source.width * scale), round(source.height * scale)
    target = source.resize((width, height), Image.Resampling.NEAREST)
    left, top = round(x - width * origin_x), round(y - height * origin_y)
    draws.append((depth, target, left, top))
    return left, top, width, height

ground = {'river-bridge', 'river-wall', 'stone-stairs', 'stairs', 'plaza-medallion', 'river-waterfall', 'river-lilies', 'river-water'}
by_base = {group['base']['prop']: group for group in groups.values()}
for obj in layers['decorations']['objects']:
    if obj['name'] in by_base:
        group = by_base[obj['name']]
        scale = group.get('placementScale', 1)
        base = group['base']
        place(image(base['url']), obj['x'], obj['y'], base.get('originX', 0), base.get('originY', 0), base.get('scale', 1) * scale, 1)
        for part in group['parts']:
            anchor = part['localAnchor']
            if part.get('photoQuad'):
                base_image = image(base['url'])
                panel = base_image.crop((anchor['x'], anchor['y'], anchor['x'] + part['width'], anchor['y'] + part['height']))
                mask = Image.new('L', panel.size)
                ImageDraw.Draw(mask).polygon([(point['x'], point['y']) if isinstance(point, dict) else tuple(point) for point in part['photoQuad']], fill=255)
                panel.putalpha(ImageChops.multiply(panel.getchannel('A'), mask))
                place(panel, obj['x'] + anchor['x'] * scale, obj['y'] + anchor['y'] * scale, 0, 0, scale, obj['y'] + part['depthAnchorY'] * scale - .01)
            bounds = place(image(part['url']), obj['x'] + anchor['x'] * scale, obj['y'] + anchor['y'] * scale, part.get('originX', 0), part.get('originY', 0), part.get('scale', 1) * scale, obj['y'] + part['depthAnchorY'] * scale)
            part_bounds[part['id']] = bounds
        continue
    style = props[obj['name']]
    source = image(style['url'], style.get('frameWidth'))
    depth = 0.75 if obj['name'] == 'plaza-medallion' else 1 if obj['name'] in ground else obj['y']
    if obj['name'] == 'arcade-awning':
        depth += source.height * style['scale'] * (1 - style['originY'])
    place(source, obj['x'], obj['y'], style['originX'], style['originY'], style['scale'], depth)

names = []
for obj in layers['interactions']['objects']:
    definition = next(item for item in world['interactions'] if item['id'] == obj['name'])
    properties = {item['name']: item['value'] for item in obj.get('properties', [])}
    part = properties.get('districtPart')
    if part:
        bounds = part_bounds[part]
    elif obj['type'] == 'npc':
        npc = next(item for item in npcs if item['id'] == obj['name'])
        bounds = place(image(f"/game/sheets/{npc['sprite']}-display.png", 67), obj['x'], obj['y'], .5, npc['originY'], npc['scale'] / .7, obj['y'])
    else:
        key = properties.get('prop') or definition.get('prop') or {'collection': 'terminal', 'project': 'terminal', 'contact': 'mailbox', 'cafe': 'sign', 'moments': 'painting-frame', 'arcade': 'arcade', 'match': 'arcade'}[obj['type']]
        style = props[key]
        bounds = place(image(style['url'], style.get('frameWidth')), obj['x'], obj['y'], style['originX'], style['originY'], style['scale'], obj['y'])
    label_x = bounds[0] + bounds[2] / 2 if part else obj['x']
    names.append((label_x, bounds[1], definition['displayName'], definition['role'], obj['type'] in {'arcade', 'match'}))

for resident in read('src/content/residents.json'):
    source = image(f"/game/residents/{resident['texture']}.png", 67)
    place(source, resident['x'], resident['y'], .5, 1, 1, resident['y'])
place(image('/game/characters/male/idle-down.png'), world['spawn']['x'], world['spawn']['y'], .5, .85, .55, world['spawn']['y'])
for _, source, left, top in sorted(draws, key=lambda item: item[0]):
    canvas.alpha_composite(source, (left, top))

try:
    font = ImageFont.truetype('DejaVuSans.ttf', 12)
    small = ImageFont.truetype('DejaVuSans.ttf', 9)
except OSError:
    font = small = ImageFont.load_default()
labels = ImageDraw.Draw(canvas)
for x, top, name, role, compact in names:
    lines = name.split() if compact else [name]
    height = len(lines) * 14 + 17 if compact else 32
    y = top - height - 8
    width = max(*[labels.textlength(line, font) for line in lines], labels.textlength(role, small)) + (16 if compact else 22)
    labels.rectangle((x - width / 2, y, x + width / 2, y + height), fill='#fff8e5', outline='#c7a777')
    for index, line in enumerate(lines):
        labels.text((x, y + 3 + index * 14), line, fill='#315848', font=font, anchor='mt')
    labels.text((x, y + height - 12), role, fill='#9a7045', font=small, anchor='mt')

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output', default='/workspace/scratch/town-v2-overview.png')
args = parser.parse_args()
target = Path(args.output)
target.parent.mkdir(parents=True, exist_ok=True)
canvas.convert('RGB').save(target)
print(f'Offline art overview saved to {target}; browser UI and animation are not captured.')
