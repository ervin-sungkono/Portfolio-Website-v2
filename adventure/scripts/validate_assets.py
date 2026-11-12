#!/usr/bin/env python3
"""Validate review concepts and the recorded production-asset handoff."""

import argparse
import hashlib
import json
import sys
from pathlib import Path

from PIL import Image, UnidentifiedImageError

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = ROOT / "art" / "asset-manifest.json"
DIRECTIONS = ("up", "down", "left", "right")


def local_file(value, description, errors):
    if not isinstance(value, str) or not value:
        errors.append(f"{description}: missing path")
        return None
    path = (ROOT / value).resolve()
    if not path.is_relative_to(ROOT):
        errors.append(f"{description}: path must remain inside the workspace")
        return None
    if not path.is_file():
        errors.append(f"{description}: file not found: {value}")
        return None
    return path


def read_png(path, description, errors):
    if path is None:
        return None
    try:
        with Image.open(path) as img:
            img.verify()
        with Image.open(path) as img:
            if img.format != "PNG":
                errors.append(f"{description}: expected PNG, found {img.format}")
                return None
            return img.size
    except (OSError, ValueError, UnidentifiedImageError) as exc:
        errors.append(f"{description}: cannot read image: {exc}")
        return None


def validate_animation(path, size, description, errors, warnings):
    if path is None or size is None:
        return
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        width, height = data["frameWidth"], data["frameHeight"]
        animations = data["animations"]
        if not isinstance(animations, dict) or not all(
            isinstance(n, int) and not isinstance(n, bool) and n > 0 for n in (width, height)
        ):
            raise ValueError("frame dimensions must be positive integers and animations an object")
    except (OSError, ValueError, KeyError, TypeError) as exc:
        errors.append(f"{description}: invalid animation metadata: {exc}")
        return
    for action in ("idle", "walk"):
        for direction in DIRECTIONS:
            key = f"{action}_{direction}"
            frames = animations.get(key)
            if not isinstance(frames, list) or not frames:
                errors.append(f"{description}: {key} needs at least one frame")
                continue
            if action == "walk" and len(frames) < 4:
                warnings.append(f"{description}: {key} has fewer than the 4-frame starting target")
            for index, frame in enumerate(frames):
                try:
                    x, y, w, h = (frame[k] for k in ("x", "y", "w", "h"))
                    if not all(isinstance(n, int) and not isinstance(n, bool) for n in (x, y, w, h)):
                        raise ValueError("coordinates must be integers")
                    if (w, h) != (width, height) or x < 0 or y < 0 or x + w > size[0] or y + h > size[1]:
                        raise ValueError("frame size or bounds do not match atlas")
                except (KeyError, TypeError, ValueError) as exc:
                    errors.append(f"{description}: {key}[{index}]: {exc}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--stage", choices=("concepts", "production"), default="concepts")
    args = parser.parse_args()
    errors, warnings = [], []
    try:
        manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        print(f"Cannot read manifest: {exc}", file=sys.stderr)
        return 1
    if manifest.get("schemaVersion") != 1:
        errors.append("Unsupported manifest schema version")
    ids = set()
    for section in ("concepts", "assets"):
        entries = manifest.get(section)
        if not isinstance(entries, list) or not entries:
            errors.append(f"{section}: expected a non-empty list")
            continue
        for item in entries:
            if not isinstance(item, dict) or not isinstance(item.get("id"), str) or not item["id"]:
                errors.append(f"{section}: each item needs an ID")
                continue
            ident = item["id"]
            if ident in ids:
                errors.append(f"duplicate ID: {ident}")
            ids.add(ident)
            if section == "concepts":
                path = local_file(item.get("path"), ident, errors)
                size = read_png(path, ident, errors)
                if path and hashlib.sha256(path.read_bytes()).hexdigest() != item.get("sha256"):
                    errors.append(f"{ident}: SHA-256 does not match manifest")
                if item.get("status") not in ("review", "approved", "rejected"):
                    errors.append(f"{ident}: invalid review status")
                provenance = item.get("provenance")
                if not isinstance(provenance, dict) or not all(provenance.get(k) for k in ("method", "created", "role")):
                    errors.append(f"{ident}: missing provenance")
                if size:
                    print(f"Concept {ident}: {size[0]}×{size[1]}, {item.get('status')}")
            elif args.stage == "production":
                if item.get("status") != "approved":
                    errors.append(f"{ident}: status is {item.get('status')!r}; needs approval")
                local_file(item.get("source"), f"{ident} editable source", errors)
                png = local_file(item.get("image"), f"{ident} PNG", errors)
                size = read_png(png, ident, errors)
                if item.get("kind") == "character":
                    animation = local_file(item.get("animation"), f"{ident} animation", errors)
                    validate_animation(animation, size, ident, errors, warnings)
    previews = manifest.get("reviewPreviews", [])
    if not isinstance(previews, list):
        errors.append("reviewPreviews: expected a list")
        previews = []
    for item in previews:
        if not isinstance(item, dict) or not isinstance(item.get("id"), str) or not item["id"]:
            errors.append("reviewPreviews: each item needs an ID")
            continue
        ident = item["id"]
        if ident in ids:
            errors.append(f"duplicate ID: {ident}")
        ids.add(ident)
        path = local_file(item.get("path"), ident, errors)
        if item.get("status") not in ("review", "approved", "rejected"):
            errors.append(f"{ident}: invalid review status")
        provenance = item.get("provenance")
        if not isinstance(provenance, dict) or not all(provenance.get(k) for k in ("method", "created", "role")):
            errors.append(f"{ident}: missing provenance")
        if path:
            if hashlib.sha256(path.read_bytes()).hexdigest() != item.get("sha256"):
                errors.append(f"{ident}: SHA-256 does not match manifest")
            try:
                with Image.open(path) as img:
                    if img.format != "GIF" or getattr(img, "n_frames", 1) < 2:
                        errors.append(f"{ident}: expected an animated GIF")
                    else:
                        print(f"Preview {ident}: {img.n_frames} frames, {item.get('status')}")
            except (OSError, ValueError, UnidentifiedImageError) as exc:
                errors.append(f"{ident}: cannot read preview: {exc}")
    for warning in warnings:
        print(f"WARNING: {warning}")
    for error in errors:
        print(f"ERROR: {error}", file=sys.stderr)
    if errors:
        print(f"Validation failed: {len(errors)} issue(s).", file=sys.stderr)
        return 1
    print(f"{args.stage.capitalize()} validation passed; visual approval remains a separate review.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
