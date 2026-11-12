#!/usr/bin/env python3
"""Validate transparency, pose registration and LibreSprite round trips."""
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[2]
work = root / 'art/bird-animation'
images = {}
def visible(image):
    # Invisible RGB can vary after alpha compositing without affecting the sprite.
    return Image.alpha_composite(Image.new('RGBA', image.size), image).tobytes()
for pose in ('up', 'mid', 'down', 'dazed'):
    output = Image.open(work / f'outputs/{pose}.png').convert('RGBA')
    runtime = Image.open(root / f'public/game/arcade/bird-animation/{pose}.png').convert('RGBA')
    exported = Image.open(work / f'working/{pose}-roundtrip.png').convert('RGBA')
    assert output.size == (64, 52), f'{pose}: incorrect dimensions'
    alpha = output.getchannel('A')
    assert set(alpha.get_flattened_data()) <= {0, 255}, f'{pose}: soft alpha'
    x1, y1, x2, y2 = alpha.getbbox()
    assert x1 > 0 and y1 > 0 and x2 < 64 and y2 < 52, f'{pose}: clipped at edge'
    assert output.tobytes() == runtime.tobytes(), f'{pose}: runtime differs'
    assert output.tobytes() == exported.tobytes(), f'{pose}: editor round trip differs'
    images[pose] = output
    print(f'{pose}: 64x52, bounds {(x1, y1, x2, y2)}')
for pose in ('mid', 'down'):
    # The original head and face remain exactly registered.
    assert visible(images['up'].crop((29, 0, 64, 28))) == visible(images[pose].crop((29, 0, 64, 28))), f'{pose}: head changed'
assert visible(images['up']) != visible(images['mid'])
assert visible(images['mid']) != visible(images['down'])
assert visible(images['down']) != visible(images['dazed'])
print('Bird frames pass transparency, head registration, distinct pose, and editor round-trip checks.')
