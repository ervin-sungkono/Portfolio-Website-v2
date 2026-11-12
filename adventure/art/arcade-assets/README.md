# Arcade artwork drafts

The flower-trimmed arcade cabinet and blue songbird were generated for Ervin's Little World using the selected Direction A reference. They are original draft props; the bird is one wings-up pose, rather than an animation sheet. The generated concept images are retained in `sources/`, alongside editable, single-layer LibreSprite masters. Crops and PNG editor round trips are in `working/`; the game-scale outputs are in `outputs/`.

The cabinet is 80 × 128 with suggested origin `(0.5, 0.9609375)` and scale `0.8`. The bird is 64 × 52 and has transparent padding, with visible pixels at `(4, 5)` through `(59, 48)`. The exact crop rectangles and SHA-256 hashes are in `manifest.json`. Neither image has been reviewed at its eventual game scale; collision geometry and placement need in-scene review.

`bash art/arcade-assets/build.sh` reproduces the game PNGs and editable masters from the generated originals using LibreSprite 1.3. The shared alpha-cleaning script thresholds any soft generated edges to transparent or opaque pixels. `python3 art/arcade-assets/verify.py` checks the retained hashes, dimensions, binary alpha, edge clearance, runtime copies, and recorded editor round trips. These checks do not replace visual review.
