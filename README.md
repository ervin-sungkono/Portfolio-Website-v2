# Ervin Sungkono’s Portfolio

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

Pages are Server Components. Only the header and contact form require browser JavaScript. Project detail pages are generated at build time; search and category filters use shareable query parameters and server rendering. There is no database, CMS SDK, global state library, or background synchronisation in phase 1.

## Updating content

Edit `src/content/profile.ts`, `projects.json`, and `designs.json`. Put featured projects first in `projects.json`; the homepage selects the first three. Keep existing slugs stable because they are public URLs. Additional verified detail-page notes live in `src/lib/content.ts`.

Images point to the owner’s existing `web-assets` repository and original Dribbble CDN. Add local images to `public/images`; configure new remote hosts in `next.config.ts`.

CMS integration is deferred to phase 2. Replace the exports and lookup functions in `src/lib/content.ts` when a CMS is selected. No speculative CMS adapters or admin screens are included.

## Contact and email

The form validates on client and server, focuses invalid fields, preserves drafts on errors, and clears fields only after Gmail accepts a message. The API checks origin, limits the body to 16 KiB, rejects the honeypot, verifies invisible reCAPTCHA v2, and sends a plain-text email to the owner with the visitor’s address as `replyTo`.

| Variable                    | Purpose                                           |
| --------------------------- | ------------------------------------------------- |
| `EMAIL`                     | Gmail sender and recipient                        |
| `EMAIL_PASS`                | Gmail app password; server-only                   |
| `NEXT_PUBLIC_RECAPTCHA_KEY` | Invisible reCAPTCHA v2 public site key            |
| `RECAPTCHA_SECRET`          | reCAPTCHA secret; server-only                     |
| `RECAPTCHA_KEY`             | Existing deployment alias for `RECAPTCHA_SECRET`  |
| `SITE_URL`                  | Production URL for canonical metadata and sitemap |

Set secrets in `.env.local` or the hosting dashboard. Never commit values. Existing Vercel names remain compatible. Register production and preview hostnames in reCAPTCHA. If configuration or delivery is unavailable, the form reports an error and points visitors to LinkedIn.

See [architecture and source notes](docs/architecture.md) for provenance and phase 2 considerations.
