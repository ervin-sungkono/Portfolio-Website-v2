# Background residents

Four original, non-interactable townspeople use 67×90 transparent sprites aligned to a shared foot baseline. The gardener and baker breathe and blink; the artist and traveler use side-facing, four-frame walking sheets and bounded routes. They have small solid foot-level physics bodies but no interaction prompts. Reduced-motion mode displays still figures.

The original image-generation sources are retained in `sources/`. The four-step sheets use fixed source cells to retain the characters' scale and alignment across stride and passing poses. Their `-v2` filenames prevent browsers from using the previous two-frame sheets with the new animation. Run `bash scripts/build-resident-art.sh` with ImageMagick to regenerate the runtime sprites. Placements and routes live in `src/content/residents.json`; verify them against the map before changing them.

The side-facing figures use four generated poses. Review their gait and blinking at native game size before final art approval.

The artist now follows a small gallery circuit and pauses to inspect the first frame from two sides. The traveler visits both arcade cabinets and returns through the open forecourt. Routes are authored as shallow diagonal/horizontal waypoints in `residents.json`; the walk animation stops at pauses. `npm run test:residents` samples the complete circuits against paving, water, and solid objects. Longer north/south trips should wait for directional art and the approved new landscaping.
