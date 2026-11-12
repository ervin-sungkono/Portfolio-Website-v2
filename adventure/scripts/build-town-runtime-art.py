#!/usr/bin/env python3
"""Export the approved town review cels as versioned, 32px runtime art."""
from __future__ import annotations

import json
import math
import shutil
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "public/art-review/assets"
OUTPUT = ROOT / "public/game/town-v2"
RUNTIME = ROOT / "art/town-redesign/runtime"
TILE = 32
EDGE_VARIANTS = [
    "north-edge", "east-edge", "south-edge", "west-edge",
    "northwest-corner", "northeast-corner", "southwest-corner", "southeast-corner",
]
PAIRS = [
    ("grass", "plaza"),
    ("grass", "garden-path"),
    ("grass", "promenade"),
    ("plaza", "garden-path"),
    ("plaza", "promenade"),
    ("garden-path", "promenade"),
]


def save_atlas(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, format="PNG", optimize=True)


def changed_pixels(first: Image.Image, second: Image.Image) -> int:
    before, after = first.tobytes(), second.tobytes()
    return sum(before[offset:offset + 4] != after[offset:offset + 4] for offset in range(0, len(before), 4))


def edge_difference(image: Image.Image, axis: str) -> float:
    rgb = image.convert("RGB")
    width, height = rgb.size
    if axis == "horizontal":
        pairs = ((rgb.getpixel((0, y)), rgb.getpixel((width - 1, y))) for y in range(height))
        count = height
    else:
        pairs = ((rgb.getpixel((x, 0)), rgb.getpixel((x, height - 1))) for x in range(width))
        count = width
    return sum(sum(abs(a - b) for a, b in zip(first, last)) for first, last in pairs) / (count * 3)


def transition_mask(variant: str) -> Image.Image:
    mask = Image.new("L", (TILE, TILE), 0)
    for y in range(TILE):
        for x in range(TILE):
            if variant.endswith("-edge"):
                position = x if variant in ("north-edge", "south-edge") else y
                # The curve starts and ends at the same seam so neighboring edge tiles join cleanly.
                wave = round(3 * math.sin(math.pi * position / (TILE - 1)))
                if variant == "north-edge": covered = y < 15 + wave
                elif variant == "south-edge": covered = y >= 16 + wave
                elif variant == "west-edge": covered = x < 15 + wave
                else: covered = x >= 16 + wave
            else:
                corner = variant.removesuffix("-corner")
                north = corner.startswith("north")
                west = corner.endswith("west")
                # Combined adjacent-side coverage with a rounded inside corner.
                covered = (y < 16 if north else y >= 16) or (x < 16 if west else x >= 16)
                covered = covered or (x - 16) ** 2 + (y - 16) ** 2 <= 8 ** 2
            if covered:
                mask.putpixel((x, y), 255)
    return mask


def surface_tile_ids(firstgid: int, material_column: int) -> list[int]:
    return [firstgid + row * 8 + material_column + column for row in range(4) for column in range(4)]


def source_cell(name: str, cell_index: int) -> Image.Image:
    swatch = Image.open(ASSETS / f"{name}.png").convert("RGBA")
    if swatch.size != (128, 128):
        raise ValueError(f"Expected 128×128 approved {name} swatch, got {swatch.size}")
    x, y = (cell_index % 4) * TILE, (cell_index // 4) * TILE
    return swatch.crop((x, y, x + TILE, y + TILE))


def validate_approved_swatch_repeats() -> dict[str, dict[str, float]]:
    measurements = {}
    for name in ("grass", "plaza", "garden-path", "promenade"):
        image = Image.open(ASSETS / f"{name}.png")
        if image.size != (128, 128):
            raise ValueError(f"Expected 128×128 approved {name} swatch, got {image.size}")
        horizontal = edge_difference(image, "horizontal")
        vertical = edge_difference(image, "vertical")
        if max(horizontal, vertical) >= 12:
            raise ValueError(f"{name} repeat edge exceeds approved review threshold: {horizontal:.2f}/{vertical:.2f}")
        measurements[name] = {"horizontalMeanRgbDelta": round(horizontal, 2), "verticalMeanRgbDelta": round(vertical, 2)}
    return measurements


def copy_approved_assets() -> dict[str, dict[str, int]]:
    specs = {
        "fountain": ("fountain.png", 160, 176, 4),
        "waterfall": ("waterfall.png", 192, 128, 4),
        "tree": ("tree.png", 160, 176, 4),
        "river-water": ("river-water.png", 96, 96, 4),
        "willow": ("willow.png", 160, 192, 1),
        "blossom-tree": ("blossom-tree.png", 176, 176, 1),
        "waterside-planting": ("waterside-planting.png", 192, 144, 1),
        "stairs": ("stairs.png", 128, 144, 1),
        "raised-wall": ("raised-wall.png", 256, 128, 1),
        "garden-corner": ("garden-corner.png", 176, 144, 1),
    }
    dimensions = {}
    for name, (filename, frame_width, frame_height, frame_count) in specs.items():
        source = ASSETS / filename
        output = OUTPUT / filename
        shutil.copyfile(source, output)
        image = Image.open(output)
        expected_size = (frame_width * frame_count, frame_height)
        if image.size != expected_size:
            raise ValueError(f"{filename} must be {expected_size[0]}×{expected_size[1]}, got {image.size}")
        if source.read_bytes() != output.read_bytes():
            raise AssertionError(f"Approved pixels changed during export: {filename}")
        dimensions[name] = {"width": image.width, "height": image.height, "frameWidth": frame_width, "frameHeight": frame_height, "frameCount": frame_count}
    return dimensions


def validate_animation_cels() -> dict[str, list[int]]:
    loop_pixels = {}
    for name, width, height in (("fountain", 160, 176), ("waterfall", 192, 128), ("tree", 160, 176)):
        atlas = Image.open(OUTPUT / f"{name}.png").convert("RGBA")
        mask = Image.open(ROOT / f"art/town-redesign/masks/{name}.png").convert("RGBA").getchannel("A")
        if atlas.size != (width * 4, height) or mask.size != (width, height):
            raise AssertionError(f"Unexpected frame or static-cel mask dimensions for {name}")
        frames = [atlas.crop((index * width, 0, (index + 1) * width, height)) for index in range(4)]
        for frame_index in range(1, 4):
            for y in range(height):
                for x in range(width):
                    if mask.getpixel((x, y)) == 0 and frames[0].getpixel((x, y)) != frames[frame_index].getpixel((x, y)):
                        raise AssertionError(f"Static cel changed in {name}, frame {frame_index}, pixel {x},{y}")
        loop_changes = []
        for index in range(4):
            next_frame = (index + 1) % 4
            changes = changed_pixels(frames[index], frames[next_frame])
            if changes <= 20:
                raise AssertionError(f"Duplicate or stalled {name} frame {index}→{next_frame}")
            loop_changes.append(changes)
        loop_pixels[name] = loop_changes
    return loop_pixels


def validate_river_water() -> tuple[list[dict[str, float | int]], list[int]]:
    atlas = Image.open(OUTPUT / "river-water.png").convert("RGBA")
    frames = [atlas.crop((index * 96, 0, (index + 1) * 96, 96)) for index in range(4)]
    repeat_edges = []
    loop_changes = []
    for index, frame in enumerate(frames):
        horizontal = edge_difference(frame, "horizontal")
        vertical = edge_difference(frame, "vertical")
        if max(horizontal, vertical) >= 14:
            raise AssertionError(f"River frame {index} repeat edge exceeds 14: {horizontal:.2f}/{vertical:.2f}")
        repeat_edges.append({"frame": index, "horizontalMeanRgbDelta": round(horizontal, 2), "verticalMeanRgbDelta": round(vertical, 2)})
        changes = changed_pixels(frame, frames[(index + 1) % 4])
        if changes <= 20:
            raise AssertionError(f"Duplicate or stalled river-water frame {index}→{(index + 1) % 4}")
        loop_changes.append(changes)
    return repeat_edges, loop_changes


def build_terrain() -> tuple[dict, dict[str, dict[str, float]]]:
    repeats = validate_approved_swatch_repeats()
    for output_name, left_name, right_name in (
        ("ground-base.png", "grass", "plaza"),
        ("ground-additions.png", "garden-path", "promenade"),
    ):
        atlas = Image.new("RGBA", (256, 128), (0, 0, 0, 0))
        left = Image.open(ASSETS / f"{left_name}.png").convert("RGBA")
        right = Image.open(ASSETS / f"{right_name}.png").convert("RGBA")
        atlas.paste(left, (0, 0))
        atlas.paste(right, (128, 0))
        save_atlas(atlas, OUTPUT / output_name)
        written = Image.open(OUTPUT / output_name).convert("RGBA")
        if written.crop((0, 0, 128, 128)).tobytes() != left.tobytes() or written.crop((128, 0, 256, 128)).tobytes() != right.tobytes():
            raise AssertionError(f"Approved terrain swatches changed in {output_name}")

    transition_atlas = Image.new("RGBA", (256, 384), (0, 0, 0, 0))
    transition_families = []
    row = 0
    for first, second in PAIRS:
        for base, overlay in ((first, second), (second, first)):
            tile_ids = list(range(84 + row * 8, 84 + (row + 1) * 8))
            for column, variant in enumerate(EDGE_VARIANTS):
                tile = source_cell(overlay, column)
                tile.putalpha(transition_mask(variant))
                transition_atlas.paste(tile, (column * TILE, row * TILE))
            transition_families.append({
                "id": f"{base}-to-{overlay}",
                "baseSurface": base,
                "overlaySurface": overlay,
                "firstgid": tile_ids[0],
                "tileIds": tile_ids,
                "variants": EDGE_VARIANTS,
                "renderMode": "transparent-overlay",
            })
            row += 1
    save_atlas(transition_atlas, OUTPUT / "ground-transitions.png")

    base_ids = {
        "grass": surface_tile_ids(1, 0),
        "plaza": surface_tile_ids(1, 4),
        "garden-path": surface_tile_ids(52, 0),
        "promenade": surface_tile_ids(52, 4),
    }
    surfaces = []
    for name, path, ids, paved in (
        ("grass", "ground-base.png", base_ids["grass"], False),
        ("plaza", "ground-base.png", base_ids["plaza"], True),
        ("garden-path", "ground-additions.png", base_ids["garden-path"], True),
        ("promenade", "ground-additions.png", base_ids["promenade"], True),
    ):
        surfaces.append({
            "id": name,
            "path": f"/game/town-v2/{path}",
            "firstgid": ids[0],
            "tileIds": ids,
            "tilecount": len(ids),
            "columns": 8,
            "imageWidth": 256,
            "imageHeight": 128,
            "isPaved": paved,
            "sourceSwatch": f"public/art-review/assets/{name}.png",
            "repeatEdgeMeanRgbDelta": repeats[name],
        })
    if sorted(gid for entry in surfaces[:2] for gid in entry["tileIds"]) != list(range(1, 33)):
        raise AssertionError("Grass/plaza atlas no longer covers legacy GIDs 1–32 exactly")
    if sorted(gid for entry in surfaces[2:] for gid in entry["tileIds"]) != list(range(52, 84)):
        raise AssertionError("Garden-path/promenade atlas must cover GIDs 52–83 exactly")
    if len(transition_families) != 12 or sorted(gid for entry in transition_families for gid in entry["tileIds"]) != list(range(84, 180)):
        raise AssertionError("Transition atlas must cover GIDs 84–179 exactly")
    expected_atlas_sizes = {"ground-base.png": (256, 128), "ground-additions.png": (256, 128), "ground-transitions.png": (256, 384)}
    for filename, size in expected_atlas_sizes.items():
        if Image.open(OUTPUT / filename).size != size:
            raise AssertionError(f"Unexpected {filename} dimensions")

    manifest = {
        "schemaVersion": 1,
        "tileWidth": TILE,
        "tileHeight": TILE,
        "tilesets": [
            {"name": "town", "path": "/game/town-v2/ground-base.png", "firstgid": 1, "tilecount": 32, "columns": 8, "imageWidth": 256, "imageHeight": 128},
            {"name": "town-edges", "path": "/game/tiles/town-edges.png", "firstgid": 33, "tilecount": 16, "columns": 4, "imageWidth": 128, "imageHeight": 128, "legacy": True},
            {"name": "town-water", "path": "/game/tiles/town-water.png", "firstgid": 49, "tilecount": 1, "columns": 1, "imageWidth": 32, "imageHeight": 32},
            {"name": "town-riverbank", "path": "/game/tiles/town-riverbank.png", "firstgid": 50, "tilecount": 2, "columns": 2, "imageWidth": 64, "imageHeight": 32},
            {"name": "town-additions", "path": "/game/town-v2/ground-additions.png", "firstgid": 52, "tilecount": 32, "columns": 8, "imageWidth": 256, "imageHeight": 128},
            {"name": "town-transitions", "path": "/game/town-v2/ground-transitions.png", "firstgid": 84, "tilecount": 96, "columns": 8, "imageWidth": 256, "imageHeight": 384, "renderMode": "transparent-overlay"},
        ],
        "surfaces": surfaces,
        "transitionFamilies": transition_families,
        "riverWater": {
            "id": "river-water",
            "path": "/game/town-v2/river-water.png",
            "frameWidth": 96,
            "frameHeight": 96,
            "frameCount": 4,
            "repeatTiles": {"columns": 3, "rows": 3},
            "repeatFrameMeanRgbDeltaMax": 12.1,
            "renderMode": "animate-one-repeating-surface",
        },
        "transitionPlacement": {
            "layer": "ground-edges",
            "baseCellRule": "Place one A-to-B transparent overlay in a base-A cell when its cardinal neighbor is B; the named edge places B on the side facing that neighbor.",
            "edgeDirectionOrder": ["north", "east", "south", "west"],
            "cornerRule": "When two perpendicular sides neighbor the same B, use the corner variant named for those sides; it covers both sides and rounds their inside join.",
            "mixedNeighborRule": "Choose the most frequent non-base neighbor material; resolve ties by materialPriority, then edgeDirectionOrder.",
            "materialPriority": ["garden-path", "promenade", "plaza", "grass"],
            "variants": EDGE_VARIANTS,
        },
    }
    return manifest, repeats


def build_prop_manifest(dimensions: dict[str, dict[str, int]]) -> dict:
    specs = [
        ("fountain", "animated-sprite", 4, "sprite"),
        ("river-waterfall", "animated-sprite", 4, "sprite"),
        ("tree", "animated-sprite", 4, "sprite"),
        ("river-water", "animated-texture", 4, "repeat-texture"),
        ("willow", "static-sprite", None, "sprite"),
        ("blossom-tree", "static-sprite", None, "sprite"),
        ("waterside-planting", "static-sprite", None, "sprite"),
        ("stairs", "static-sprite", None, "sprite"),
        ("raised-wall", "static-sprite", None, "sprite"),
        ("garden-corner", "static-sprite", None, "sprite"),
    ]
    entries = {}
    for name, kind, frame_rate, display_mode in specs:
        file_id = "waterfall" if name == "river-waterfall" else name
        dims = dimensions[file_id]
        entry = {
            "id": name,
            "url": f"/game/town-v2/{file_id}.png",
            "kind": kind,
            "sourceWidth": dims["width"],
            "sourceHeight": dims["height"],
            "originX": 0.5,
            "originY": 1,
            "scale": 1,
            "collision": None,
            "displayMode": display_mode,
            "layers": ["single-composited-sprite"],
        }
        if dims["frameCount"] > 1:
            entry.update({
                "frameWidth": dims["frameWidth"],
                "frameHeight": dims["frameHeight"],
                "frameCount": dims["frameCount"],
                "frameRate": frame_rate,
                "repeat": -1,
            })
        entries[name] = entry
    return {"schemaVersion": 1, "basePath": "/game/town-v2/", "props": entries}


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    RUNTIME.mkdir(parents=True, exist_ok=True)
    terrain, repeats = build_terrain()
    dimensions = copy_approved_assets()
    changes = validate_animation_cels()

    water_repeats, water_changes = validate_river_water()
    terrain["riverWater"]["repeatEdgeMeanRgbDelta"] = water_repeats
    terrain["riverWater"]["repeatFrameMeanRgbDeltaMax"] = round(max(max(item["horizontalMeanRgbDelta"], item["verticalMeanRgbDelta"]) for item in water_repeats), 2)
    changes["river-water"] = water_changes
    terrain["proof"] = {"groundRepeatEdges": repeats, "riverRepeatEdges": water_repeats, "staticMaskPixelsUnchanged": True, "distinctAnimationPixelsByLoop": changes}

    props = build_prop_manifest(dimensions)
    for path, payload in ((RUNTIME / "terrain.json", terrain), (RUNTIME / "runtime-props.json", props)):
        path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(f"Exported v2 town runtime art to {OUTPUT.relative_to(ROOT)}")
    print("Terrain: base GIDs 1–32, additions 52–83, transitions 84–179; all atlas cells are 32×32.")
    print(f"Verified approved ground repeat means (RGB): {repeats}")
    print(f"Verified static masked pixels and four distinct frames: {changes}")
    print(f"River 96×96 loop edge means (RGB): {water_repeats}")


if __name__ == "__main__":
    main()
