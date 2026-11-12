# Portfolio Adventure — art direction

Status: **style direction selected**. The user selected `art/concepts/direction-a-selected.png`. Character masters, animations, and production assets still require review.

The current review artifacts are `art/proofs/explorers-four-directions.png`, `art/proofs/town-scene.png`, `art/proofs/walk-pose-study.png`, and `art/proofs/walk-blink-preview.gif`. The user liked the original walking motion and requested a less static face. The updated preview retains those four poses and adds a blink once in a four-second cycle. These are generated visual proofs, not final sprites, production animation, or a reusable tilemap.

## Creative brief

An original, colorful town with gardens, workshops, and subtle integrated technology. It should feel lived-in and welcoming to a visitor exploring a software engineer's work. Use Guardian Tales as an interaction reference and CrossCode/Eastward as general references for readability and environmental richness. Create original designs and scenery.

- An orthogonal, top-down/three-quarter world matching the selected image: broad visible ground and rooftops with visible workshop frontage; no isometric grid or 3D geometry.
- Two selectable explorer variants, male and female, with small, childlike chibi proportions, oversized heads, compact bodies, and a shared gameplay scale. Aim for approximately 1–1.5 tiles tall in the world, subject to readability testing.
- Warm light, cohesive palette, recognizable silhouettes, readable paths, and simple contact shadows.
- Initial technical targets: 32×32 source-pixel tiles and approximately 48×64 character canvases. Confirm dimensions after native-scale visual review.
- Four directions of idle and walk for each explorer. Begin with 4–6 walk frames per direction, subject to animation quality.
- Keep character feet anchored consistently; do not use the concept illustrations as production sprites.

## Concepts for review

**Direction A — sunny workshop:** vivid teal, coral and amber, a compact garden plaza, and a technology-forward workshop. Explorers wear coordinated travel gear with goggles and scarves. The user prefers this direction but requested a more top-down world and smaller chibi characters.

**Selected Direction A — chibi town:** `art/concepts/direction-a-selected.png` is the exact image the user selected. Its character studies are visual references; the small characters in the town suggest the intended in-world scale. `direction-a-topdown-chibi.png` is a separate, more overhead experiment and was not selected.

**Direction B — harbor garden:** subdued forest greens, navy, gold and terracotta, a natural harbor setting, and a crafts-oriented workshop. Explorers wear coordinated jackets and satchels.

Both concept sheets are generated reference images. Their figures and scenes are drawn at illustration scale, and their pixels, proportions, and projections have not been validated for game use. The concepts do not contain an animation, a tile set, or editable layered sources. The chosen direction will need deliberate pixel-grid cleanup, sprite authoring, and a representative scene before it becomes game-ready.

## Review sequence

1. Use the selected Direction A as the style reference for all proofs.
2. Aseprite and SPA are not available in this workspace. The previously presented free alternative, LibreSprite 1.3, has passed a single-frame save/reopen/export smoke test. Multi-frame animation and tag export remain unverified.
3. Produce and review front-facing pixel masters for both explorers against a small environment sample. Lock canvas sizes, anchors, palette roles and perspective only after review.
4. Build one representative walk cycle and review the loop before expanding to all four directions for both characters.
5. Produce a representative playable-scale scene and validate source files, atlas metadata, frame consistency and visual quality before expanding the asset set.

Do not expand to full-world production until the relevant visual gates are approved. Use `docs/asset-workflow.md` for the manifest and validation commands.
