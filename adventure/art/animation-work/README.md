# Provisional character animation work

These are **drafts for functional integration and visual review**. They are generated from the user-selected chibi art direction; they are not yet hand-corrected final animation.

`studies/` contains generated four-pose direction studies; `build-drafts.sh` crops, registers and scales them via LibreSprite into `public/game/characters/<male|female>/`. Eight editable single-frame `.aseprite` files for the original idle turnarounds are in `art/drafts/turnarounds/`; individual editable `.aseprite` copies of every currently exported frame are in `sources/`. These source copies are flattened per frame, not layered multi-frame animation masters.

Each character has four idle PNGs and four walking PNGs for each cardinal direction. File names and checksums are in `manifest.json`; all exports are 96×128 PNGs with binary alpha. Animation starts at 6 frames per second. Two face-only composited blink variants exist for front-facing idle and the second front-walk frame; the game should activate them briefly on a separate slow timer.

The underlying generator output has pose, shape and shading variations. A basic check confirms four distinct frames per walk direction, no frame touches the canvas edge, and each head centroid is near x=48. **This does not establish polished motion or consistent feet anchors.** In-game testing, animator cleanup, consistent palettes, intentional frame timing and a native multi-frame editor round trip are still required. `previews/` contains enlarged four-frame draft GIFs to spot frame popping. Blink is not implemented for side/back views.

The earlier generated male-right image had a corrupt transparent background; a clean second study was generated and used instead. No automatic mirror fallback is included.
