# Ervin Cahyadinata Sungkono’s Portfolio

Phase 1 rework of the original portfolio, built with Next.js 16.4 App Router, React, and strict TypeScript. The original logo, avatar, screenshots, Dribbble artwork, CV, social links, and five public routes are preserved.

## Development

Requires Node.js 22 or newer (Node.js 24 recommended).

```sh
npm ci
cp .env.example .env.local
npm run dev
```

```sh
npm run typecheck
npm test
npm run build
npm start
```

## Architecture

- `src/app`: routes, metadata, layouts, and contact API.
- `src/components`: shared navigation, footer, cards, experience, and contact form.
- `src/content`: typed profile facts and project/design content snapshots.
- `src/lib/content.ts`: single content boundary used by pages.
- `src/lib/contact`: shared validation and server-only Gmail/reCAPTCHA services.
- `src/styles`: design tokens and responsive page styles. Small component styles use CSS Modules.

Pages are Server Components. The header, contact form, small motion islands, and selectively loaded particle accents use browser JavaScript. Project detail pages are generated at build time; search and category filters use shareable query parameters and server rendering. There is no database, CMS SDK, global state library, or background synchronisation in phase 1.

## Updating content

Edit `src/content/profile.ts`, `projects.json`, and `designs.json`. Put featured projects first in `projects.json`; the homepage selects the first three. Keep existing slugs stable because they are public URLs. Typed walkthroughs, capability links, and portfolio architecture decisions live in `src/content/engineering.ts`.

## Engineering showcase

The homepage and About page link capabilities to specific projects. WeTrack, ChatGPT Clone, and Next Pokedex have walkthroughs with context, documented implementation, tradeoff analysis, source references, and explicitly proposed next validation steps. Team attribution stays visible; no individual ownership or measured outcomes are inferred.

`/engineering` explains this site's architecture with links to the relevant source files and verification notes. Related projects use shared technologies and category to help visitors continue browsing. Showcase content renders on the server and passes into small Motion wrappers for selected entry and pointer effects. See [Engineering Editorial visual design](docs/visual-design-2026.md) for the current presentation system and [responsive layout and motion](docs/responsive-and-motion.md) for the shared sizing rules, desktop sticky/parallax scenes, and animation boundaries.

`portfolioSourceRef` in `src/content/engineering.ts` points source links to the rework branch while the preview is under review. Switch it to `main` once the rework is merged.

Images point to the owner’s existing `web-assets` repository and original Dribbble CDN. The optimizer accepts the exact image URLs in the project/design snapshots, including their queries. Add local images to `public/images` and import them statically in components for content-hashed delivery. Remote images have a 31-day minimum cache lifetime: publish changed artwork under a new filename/URL and update its content entry instead of overwriting a cached URL. See [image delivery](docs/image-delivery.md) for sizing and cache rules.

CMS integration is deferred to phase 2. Replace the exports and lookup functions in `src/lib/content.ts` when a CMS is selected. No speculative CMS adapters or admin screens are included.

## Contact and email

The form validates on client and server, focuses invalid fields, preserves drafts on errors, and clears fields only after Gmail accepts a message. The API checks origin, limits the body to 16 KiB, rejects the honeypot, verifies invisible reCAPTCHA v2, and sends a plain-text email to the owner with the visitor’s address as `replyTo`.

| Variable                    | Purpose                                          |
| --------------------------- | ------------------------------------------------ |
| `EMAIL`                     | Gmail sender and recipient                       |
| `EMAIL_PASS`                | Gmail app password; server-only                  |
| `NEXT_PUBLIC_RECAPTCHA_KEY` | Invisible reCAPTCHA v2 public site key           |
| `RECAPTCHA_SECRET`          | reCAPTCHA secret; server-only                    |
| `RECAPTCHA_KEY`             | Existing deployment alias for `RECAPTCHA_SECRET` |

Set secrets in `.env.local` or the hosting dashboard. Never commit values. Existing Vercel names remain compatible. Register production and preview hostnames in reCAPTCHA. If configuration or delivery is unavailable, the form reports an error and points visitors to LinkedIn.

## Search metadata

The public origin is `https://ervincs.com`, defined once in `src/lib/metadata.ts`. Canonical links, social metadata, robots.txt, and the sitemap use that origin, including in previews. `SITE_URL` is no longer used, so a stale deployment variable cannot override the canonical domain. Each route has a descriptive title and summary; the About page includes ProfilePage/Person structured data using the same public profile facts as the page.

After promoting this rework, submit `https://ervincs.com/sitemap.xml` in Google Search Console and inspect the production URLs. Vercel preview deployments retain their `X-Robots-Tag: noindex` header. Metadata improves page identification and search snippets; it does not guarantee indexing or rankings.

See [architecture and source notes](docs/architecture.md) for provenance and phase 2 considerations.
