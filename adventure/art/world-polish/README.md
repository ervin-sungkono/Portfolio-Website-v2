# World decoration drafts

Eight isolated visual drafts in the selected Direction A style: a flowerbed, lantern, flowering bush, mossy rocks, fountain, mailbox, bunting pole, and planter crates. View the enlarged [contact sheet](previews/props-contact.png) or the original [garden](sources/garden-generated.png) and [plaza](sources/plaza-generated.png) concept sheets.

Individual transparent PNGs are in `outputs/`; corresponding editable LibreSprite files are in `sources/`. The `.aseprite` files are **single-layer** imported pixel masters. `manifest.json` records the original generated sheets and hashes, crop rectangles, PNG hashes, dimensions, visible bounds, and suggested base anchor for each object. Base anchors are pixel coordinates relative to the PNG's upper left, not necessarily its center or canvas bottom.

These are art drafts. The fountain is a static visual with no water animation; the mailbox is decorative. The proposed anchors and scaling must be checked in the actual scene, and visual approval remains outstanding. The two raw generated concept sheets are references, not a tilemap. No map, game code, or runtime assets were changed by this work.

Each PNG has binary alpha, with visible artwork clear of all canvas edges. All eight `.aseprite` sources were reopened and exported to PNG with identical RGBA bytes. Run `python3 art/world-polish/verify.py` from the project root to repeat file, hash, alpha, bounds, and saved round-trip checks; these checks do not replace visual review.

The source images were produced via the available image-generation tool using `art/concepts/direction-a-selected.png` as reference. LibreSprite 1.3 performed the crops, nearest-neighbor resizing and alpha cleanup, and generated the editable source files. Full-resolution references and preview sheets are development material.
