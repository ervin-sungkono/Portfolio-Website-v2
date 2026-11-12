# Asset workflow

The first milestone is an art-direction review. The sheets in `art/concepts/` are references, not sprite sheets. The user selected `direction-a-selected.png` as the style direction; this does not approve the individual character masters, animations, or production assets. The more overhead `direction-a-topdown-chibi.png` is an unselected experiment.

## Requirements and checks

Python 3 and Pillow are used for image inspection. Pillow 13.0.0 is available in the current workspace; the validator never creates or edits images.

```bash
python3 scripts/validate_assets.py --stage concepts
python3 scripts/validate_assets.py --stage production
```

Concept validation checks IDs, file paths, SHA-256 fingerprints, PNG readability, provenance, and manifest status. Production validation additionally requires every listed production asset to have an approved status, an existing editable source and PNG export; characters also need animation metadata. It is expected to fail while production assets are pending. These checks establish file consistency, not visual quality or proof that an editor can reopen a file.

## Editor workflow

The preferred Aseprite + SPA tools are absent. **LibreSprite 1.3** was installed locally as the previously presented free alternative, from the official AppImage with its published SHA-256 verified. Its PNG → `.aseprite` → PNG/JSON batch round trip passed on one existing image, with identical RGBA pixels and one exported frame. That is a smoke test, not proof of multi-frame animation, frame tags, or full SPA/Aseprite compatibility. Aseprite remains an option if an authorized installation becomes available.

```bash
# Restore the pinned local editor if .tools is absent; needs network access.
bash scripts/setup-libresprite.sh
# Run the local editor, forwarding any LibreSprite options.
bash scripts/libresprite.sh --help
```

The character four-view sheet has a partially transparent colored background and inconsistent side-view ordering; it is not a usable sprite sheet. The walk image is an unregistered pose study; `art/proofs/walk-preview.gif` is a rough looping preview of those four poses rather than approved animation. The town proof is a single rendered image, not a reusable tileset. Creating pixel-grid masters, consistent directional frames, a polished animation loop, and editable layered sources remains work for the next asset stage.

To rebuild the exploratory walk preview from its current four-column source, run `bash scripts/create-walk-preview.sh`. It uses LibreSprite for the four crops and FFmpeg for the GIF. The hard-coded crop dimensions apply only to this study; proper sprite animations must be authored and registered in an editor.

`bash scripts/create-walk-blink-preview.sh` rebuilds the revised four-second GIF. It repeats the approved four walk poses six times and overlays a blink onto one pose for one frame. The eventual game should time facial animation independently from the walking cycle, and should include it for both explorer variants.

## Manifest and future export contract

`art/asset-manifest.json` lists source concepts, fingerprints, provisional dimensions and planned assets. Keep paths relative to the workspace root. Preserve the original generated concept images and the actual editable source for every production asset.

When both character sprites are made, each `character` entry should point to an editable `source`, PNG atlas `image`, and JSON `animation`. The animation file uses this minimal, renderer-independent structure:

```json
{
  "frameWidth": 48,
  "frameHeight": 64,
  "animations": {
    "idle_down": [{"x": 0, "y": 0, "w": 48, "h": 64}],
    "walk_down": [{"x": 0, "y": 64, "w": 48, "h": 64}]
  }
}
```

The example is deliberately incomplete. Each of `idle` and `walk` needs `up`, `down`, `left`, and `right`, and each frame must fit inside the atlas. The validator reports walk cycles below the 4-frame starting target as warnings; final frame count and dimensions are decided by the reviewed artwork. Supply timing and anchors as metadata during production and review them visually; the example is not a Phaser export.

## Review and handoff

Review the chosen concept before authoring master sprites. Then review both front-view masters, a walk loop, and a representative scene. For each shipped asset, keep editable source, exported PNG, animation/map metadata as appropriate, authoring tool/version, provenance, approval status, and native-scale previews. The eventual game receives static exports, not concepts, editor binaries, generation scripts or credentials.
