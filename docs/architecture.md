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

## Deployment

Build the feature branch as a Vercel preview with Node.js 24. The production project’s legacy Node.js 18 setting needs updating before merging this migration. Confirm Gmail credentials remain valid and reCAPTCHA permits the final hostname. Keep `SITE_URL` set to production so preview URLs do not enter canonical metadata.

## Verification boundaries

Validation tests cover malformed input, lengths, header injection, trimming, and plain-text formatting. Build and typechecking verify routes. Browser checks exercise navigation, filters, theme persistence, responsive overflow, and contact feedback. Mocked API success tests do not prove Gmail delivery. Verify a real message with owner-approved testing before production rollout.
