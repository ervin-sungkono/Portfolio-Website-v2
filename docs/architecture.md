# Phase 1 decisions

The portfolio is intended for engineering hiring managers. Selected projects, current experience, and source links appear early. The full project and design collections retain their original content. The design uses restrained typography, light/dark colour tokens, responsive grids, keyboard focus styles, and reduced-motion support.

## Boundaries

Routing and rendering belong to `src/app`. Repeated UI belongs to `src/components`. Content is owned by `src/content` and accessed through `src/lib/content.ts`. Contact validation is shared between browser and API; provider access stays in a `server-only` module. There are no generic repositories, dependency-injection containers, application-wide providers, or premature CMS abstractions.

The CMS is phase 2. The content boundary provides one place to add fetching, caching, publication rules, and draft previews when the provider is known. Authentication, editor UI, migrations, webhooks, and scheduled LinkedIn imports are deferred.

## Source provenance

Content reviewed on 7 October 2026.

- Original assets, links, routes, and integration conventions: https://github.com/ervin-sungkono/Portfolio-Website-v2 at `6a2c71db6627ee06648a642c64d9c7ac426dfc8f`.
- Screenshots and technology icons: https://github.com/ervin-sungkono/web-assets.
- All 17 original project descriptions, URLs, and topics: owner’s GitHub repository metadata. WeTrack and ChatGPT Clone notes use their public READMEs. Team context is stated without inventing individual responsibilities.
- All 16 design titles, links, and artwork: https://dribbble.com/ErvinCS and linked public shots.
- Experience and education: public indexed version of https://www.linkedin.com/in/ervin-cahyadinata-sungkono. Samsung since December 2024; Pharma Metric Labs March to September 2024; Kalbe February 2023 to February 2024; BINUS Computer Science 2020 to 2024. LinkedIn is not polled at runtime. No unverified Samsung duties or outcomes are claimed.
- Original CV preserved; its currency has not been independently verified.

## Engineering showcase

Added on 8 October 2026. Typed showcase content lives in `src/content/engineering.ts` and is exported through the existing content module. A shared Server Component links engineering capabilities to the relevant project walkthroughs. Project pages render documented features, clearly labelled tradeoff analysis, proposed next validation steps, and original source references. WeTrack retains its team credits. Next Pokedex's rendering summary uses the repository description rather than inferring route-level behaviour from its generic README.

`/engineering` documents this portfolio's actual boundaries and decisions. Its source links target the feature branch while the preview is under review; change `portfolioSourceRef` to `main` after merge. Related-project selection is a small pure function prioritising common technologies and then category, with no search service or similarity library. Project detail metadata uses each project's title and screenshot when shared. No dependencies or client-side state were added.

## Responsive layout and motion

Added on 8 October 2026 after the engineering showcase. Motion 14 adds focused browser islands for entry reveals, desktop image tilt, scroll progress, and a reticle cursor. Content remains server-rendered and visible without JavaScript. Pointer position uses direct Motion values rather than application state or spring interpolation. The cursor loads only for desktop fine-pointer/hover capability with motion enabled; reduced-motion CSS disables decorative transforms and progress. The native cursor remains available. Section snapping was replaced with a desktop sticky hero and scroll-linked parallax. Small motion wrappers receive server-rendered content; the root document keeps normal scrolling. Phone/tablet and oversized hero content use an ordinary layout.

Shared relative typography and spacing tokens replace page-specific pixel sizing. The fluid values interpolate between documented endpoints; 48rem and 64rem breakpoints respond to available content width. See [responsive layout and motion](responsive-and-motion.md) for sources, sizing calculations, and component responsibilities.

## Engineering Editorial presentation

The October 2026 visual pass keeps the same rendering and content boundaries. Page-local CSS Modules define asymmetric work and artwork galleries, editorial detail layouts, grouped skills, and contact presentation; the shared experience component renders a vertical timeline. Collection filtering remains server-rendered GET navigation, and the unfiltered project collection separates featured work from the archive without duplicates. Shared tokens govern typography, colors, spacing, and image treatments. See [visual design](visual-design-2026.md). No content store, provider integration, or application dependency was added.

## Particle accents and collection density

The standalone, viewport-height 404 uses tsParticles 4.4. Its Server Component keeps recovery text and links usable without JavaScript. A shared client island selectively loads basic circle/movement features, interactivity, repulsion, and links. The root layout mounts one continuous connector field behind all normal pages, covering the full viewport throughout scrolling and navigation. The isolated body stacking context keeps the field above the page background and behind content; opaque image/card/form/header surfaces remain readable. Counts are bounded at 44 particles from 48rem width and 18 below, with a 20fps cap and no normal-page pause button as requested. Reduced motion and data saver skip loading; touch, short screens, and enlarged text retain full viewport coverage with the smaller composition where applicable. The layout detects the standalone 404 marker and destroys its normal field so the dedicated 404 never runs alongside it. The 404 retains its existing pause/resume control, smaller coarse-pointer count, and gentle desktop repulsion. Hidden tabs and offscreen fields pause without clearing the visitor’s pause choice. Engine instances, observers, and listeners are destroyed on cleanup.

Project featured work and archives/results use three desktop columns. Archives/results use two tablet columns and one phone column; tablet featured work keeps a full-width lead card followed by a pair. Design uses the same base density with balanced closing rows based on the filtered item count; natural caption sizing and equal image proportions avoid internal row holes without visual reordering.

## Deployment

Build the feature branch as a Vercel preview with Node.js 24. The production project’s legacy Node.js 18 setting needs updating before merging this migration. Confirm Gmail credentials remain valid and reCAPTCHA permits the final hostname. The public origin in `src/lib/metadata.ts` is `https://ervincs.com`; preview URLs never enter canonical metadata and a stale `SITE_URL` variable has no effect.

## Verification boundaries

Validation tests cover malformed input, lengths, header injection, trimming, and plain-text formatting. Build and typechecking verify routes. Browser checks exercise navigation, filters, theme persistence, responsive overflow, and contact feedback. Mocked API success tests do not prove Gmail delivery. Verify a real message with owner-approved testing before production rollout.
