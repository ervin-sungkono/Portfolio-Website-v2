"""Check exported review cels and paving joins without changing any artwork."""
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[2]
assets = root / 'public/art-review/assets'
for name, width, height in [('fountain', 160, 176), ('waterfall', 192, 128), ('tree', 160, 176)]:
    atlas = Image.open(assets / f'{name}.png').convert('RGBA')
    assert atlas.size == (width * 4, height), name
    mask = Image.open(root / f'art/town-redesign/masks/{name}.png').convert('RGBA').getchannel('A').tobytes()
    assert min(mask) == 0 and max(mask) == 255, f'{name}: mask must separate static and moving areas'
    frames = [atlas.crop((index * width, 0, (index + 1) * width, height)).tobytes() for index in range(4)]
    assert any(max(frames[0][pixel:pixel + 3]) - min(frames[0][pixel:pixel + 3]) > 40 for pixel in range(0, width * height * 4, 4) if frames[0][pixel + 3] > 200), f'{name}: palette lost during composition'
    for index in range(1, 4):
        assert all(frames[0][pixel * 4:pixel * 4 + 4] == frames[index][pixel * 4:pixel * 4 + 4] for pixel, alpha in enumerate(mask) if alpha == 0), f'{name}: static cel drift'
    for index in range(4):
        changes = sum(frames[index][pixel:pixel + 4] != frames[(index + 1) % 4][pixel:pixel + 4] for pixel in range(0, width * height * 4, 4))
        assert changes > 20, f'{name}: duplicate animation frame'
    print(f'{name}: static pixels fixed; four distinct motion cels')

for name in ['plaza', 'promenade']:
    image = Image.open(assets / f'{name}.png').convert('RGB')
    width, height = image.size
    horizontal = sum(abs(a - b) for y in range(height) for a, b in zip(image.getpixel((0, y)), image.getpixel((width - 1, y)))) / (height * 3)
    vertical = sum(abs(a - b) for x in range(width) for a, b in zip(image.getpixel((x, 0)), image.getpixel((x, height - 1)))) / (width * 3)
    assert max(horizontal, vertical) < 12, f'{name}: conspicuous paving wrap jump'
    print(f'{name}: mean RGB wrap difference {horizontal:.1f} / {vertical:.1f}; visual repeat review still required')
