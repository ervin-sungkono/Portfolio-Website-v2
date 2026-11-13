# Whole-town collision audit

Run `npm run audit:collisions` from `adventure/`. Add `-- --output /tmp/collision-audit.json` for the full diagnostic data.

The audit samples all 3,264 map tiles on an 8px lattice (52,224 positions), using the explorer's real 23.1×16.5px feet body, anchor offset, static footprints, and world bounds. A flood walk from spawn checks swept transitions, so thin barriers cannot be skipped between samples. Every reachable position is then probed in eight directions through Phaser Arcade's actual static-group physics. Every interaction must have a reachable position where it is the nearest target.

Independent core areas traced from the visible art detect reachable cells inside the north retaining wall, workshop/café masonry, and fountain basin. These are visual expectations, not copies of the collision rectangles. This matters because a simulation using collision data alone cannot identify an omitted blocker.

## Findings and fixes

- The retaining wall had no blocker above the water: its cap occupied y=1184–1216 while the water started at y=1216. Added two wall strips with the central bridge/stair gap open.
- Workshop and café blockers covered only the lowest masonry strips. Extended the ground footprints up to the visible wall bodies, leaving the roof overhangs available for walking behind.
- The fountain blocker covered only the front edge. Added overlapping basin bands that narrow toward the back, preserving the diagonal plaza path. Additional footprints stay attached to the fountain anchor and survive runtime-art regeneration.

The initial audit found 1,250 reachable sample positions inside these five visual core regions. The corrected map finds zero. Reachable positions changed from 35,014 to 33,491. Existing bridge, plaza, district entrance, grass, and resident-route checks still pass; all ten interactions remain selectable.

The full corrected sweep runs 267,928 short moves. Nine diagonal contacts around closely spaced planting/easel corners overlap by at most 2.5px during Arcade separation. Two-second follow-up pushes remain within Arcade's 4px contact bias and do not form passages. These contacts are recorded rather than misreported as traversal gaps.

Seventy geometrically free samples remain enclosed behind the café tables, unchanged from the original map. They have no spawn-connected route or interaction and were not opened artificially.

This is a deterministic, headless physics/grid audit, not a manual browser playthrough. Moving residents are tested separately by `npm run test:residents`; the exhaustive sweep uses static town geometry and stationary interactive NPCs. Art comparison covers the visible solid cores and the full-map collision overlay, not an automatic pixel-perfect interpretation of every sprite.
