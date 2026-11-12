# Ervin’s Portfolio Adventure

This directory is a standalone app inside the portfolio repository. For a separate Vercel project, set the project **Root Directory** to `adventure`, use the Next.js framework preset, and deploy a feature branch as a preview. The app needs no server-side environment variables. The existing portfolio at the repository root has its own dependencies and deployment.

A standalone Next.js and Phaser personal adventure using content from `ervin-sungkono/web-assets`. It introduces Ervin through a playful town, a skills workshop, and a small collection of things he has made. This is a **functional work-in-progress**, not the visually approved final release: the character animations, props, town map and terrain are draft artwork.

## Run locally

```bash
npm install
npm run dev
```

Open the local URL printed by Next.js. To check and build the static export:

```bash
npm run typecheck
npm run test:dialogue
npm run test:arcade
npm run test:achievements
npm run test:audio
npm run test:phaser
npm run test:overlay-pause
npm run test:sheets
npm run test:collisions
npm run validate:world
python3 scripts/validate_assets.py --stage concepts
npm run build
python3 -m http.server --directory out 8000
```

The final command serves the exported build at `http://localhost:8000`. The static export has no gameplay API or database. The game engine is dynamically imported after entering the town.

## Content and world

`src/content/portfolio.json` contains the imported, commit-pinned profile and project content; `src/content/npcs.json` defines NPC identities and sprites. Project covers are local in `public/project-media/`. `src/content/world.json` defines interactions and spawn. The editable Tiled map is `art/maps/town.tmj`; its `ground`, `ground-edges`, `water`, `river-banks`, `interactions`, `collision`, and `decorations` layers drive the runtime scene. Prop textures and anchors are defined in `src/content/props.json`. Each solid prop and NPC has a feet-level `collision` profile in world pixels relative to its map anchor, so the blocker moves with the object; set a decorative prop's profile to `null` to make it passable. Adjust the profile if changing the sprite's scale. Tiled's `collision` layer remains available for intentional map-only geometry. Add an interaction definition to world data and place its matching ID/type in Tiled; run `npm run export:map`, `npm run validate:world`, and `npm run test:collisions` to check references, physics and reachability. New interaction behaviors require implementation. `scripts/create-town-map.mjs` recreates the initial draft and will overwrite map edits; it is not the ordinary export command.

To add hobbies later, put non-empty strings in the `hobbies` array in `src/content/personal.json`. The town guide's hobbies question appears automatically when there is content; an empty array hides it. NPC conversation nodes and question choices live in `src/content/dialogues.json`. Interaction names and roles live in `src/content/world.json`. Keep each choice's `next` value pointing at an existing node, then run `npm run validate:world` after editing. When ground tiles change, run `node art/terrain-polish/update-map.mjs` before `npm run export:map` to refresh the grass-to-paving edges.

The Moments gallery is available from the welcome screen and in the town. To add a photo, place an optimized image in `public/moments/` and add an entry to the `photos` array in `src/content/moments.json`. For example:

```json
{
  "image": "/moments/my-photo.webp",
  "alt": "A useful description of the photo",
  "caption": "A title for this moment",
  "date": "A date or short location",
  "story": "The story behind the photo."
}
```

`image`, `alt`, and `caption` are required; `date` and `story` are optional. The entries appear in the order listed; the first three also appear on the park easels. Run `npm run validate:world` to check the photo paths and required fields. Add or update the files and redeploy the site to publish changes; there is no in-app upload tool. An empty array shows a friendly empty album and blank frames.

Visitors can start Milo’s optional stamp trail from his conversation or Help; progress stays on their device. Market Match is an untimed pairs game at the arcade. The café's general dialogue works immediately, and the owner can add personal questions and answers using [the café content guide](docs/cafe-stories.md).

Non-interactable town residents are defined in `src/content/residents.json`. They have small feet-level collision bodies but no interaction prompts; idle and walking motion respects reduced-motion settings. Their sprite sources and export process are documented in `art/residents/`.

The editable individual explorer and NPC frames remain the source of truth. After changing explorer frames, run `bash scripts/build-runtime-sheets.sh` (or `--check` to verify pixels); after changing NPC frames, run `python3 scripts/build-npc-display-sheets.py` (or `--check`). The entry image uses a lossless WebP with a PNG fallback; `bash scripts/validate-entry-art.sh` checks decoded pixels and dimensions. These art checks require FFmpeg and Pillow.

Phaser is pinned to 4.2.1. A small, version-checked compatibility patch removes its global visibility/focus listeners at destruction without overwriting host handlers. `postinstall`, `predev`, and `prebuild` apply the patch automatically; review it before upgrading Phaser. `npm run test:phaser` exercises the actual imported distribution with a simulated DOM.

`src/features/adventure/` contains the React experience, controller bridge, and single Phaser scene. Exit pauses the scene and returns to character selection; entering again resumes the same position, even if the explorer changes. The scene is destroyed when the component unmounts or the graphics context fails. Future portfolio integration is documented in the revised implementation plan.

## Art status

The selected style reference, proof sheets, and review GIFs are in `art/concepts/` and `art/proofs/`. `art/animation-work/` contains provisional character-frame sources and reviews. `art/tiles-work/` contains draft prop sources, tests, and preview imagery. The editor installation and asset QA workflow are documented in `docs/asset-workflow.md`.

The 96×128 character frames, grass/paving edges, props, NPC idle animations and arcade art are drafts with editable sources; native-scale and device visual review remain outstanding. Optional town music uses the existing sound setting and starts after a visitor gesture; the loop is `public/game/audio/pixelland-loop.mp3`. Garden Glide is controlled by tap, click, or Space; its difficulty rises gradually through 100 gates. Its best score and three achievements are stored on the current browser/device. The five-minute achievement adds time only while the page is visible and carries it across visits. Help contains an interaction list for visitors who cannot use the movement controls. See `docs/release-checklist.md` for completed checks and outstanding device playtesting.
