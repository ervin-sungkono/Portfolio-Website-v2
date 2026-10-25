# Portfolio architecture and operations

Reviewed for component organization on **25 October 2026 (Asia/Jakarta)**. This document owns application boundaries, content, metadata, contact integration, and image delivery. [UI behavior](responsive-and-motion.md) owns presentation and interaction; [verification](verification.md) records dated evidence, repository status, and remaining checks.

## Scope and stack

Phase 1 preserves the owner's projects, artwork, public routes, CV, social links, and team credits while presenting engineering work through server-rendered pages. The stack is Next.js 16.4.0 App Router, React 19.2, strict TypeScript, native CSS, Motion 14.0.0, selectively loaded tsParticles 4.4.0 features, and Nodemailer 10.1. Install with the committed lockfile; Node.js 24 is recommended and CI uses it. The package requires Node.js 22 or newer.

CMS integration remains phase 2. There is no database, authentication, editor/admin UI, CMS SDK, scheduled import, global state library, or background content synchronization. Professional content expansion also remains deferred. Do not infer new responsibilities, personal team contributions, seniority, or measured outcomes from the implementation.

## Code boundaries

| Location                 | Responsibility                                                                     |
| ------------------------ | ---------------------------------------------------------------------------------- |
| `src/app`                | Routes, layouts, metadata endpoints, page composition, and the contact API.        |
| `src/components`         | Reusable UI and focused browser interactions.                                      |
| `src/styles/globals.css` | Shared theme, typography, spacing, layout utilities, and accessibility primitives. |
| `src/content`            | Profile facts, engineering walkthroughs, projects, and design snapshots.           |
| `src/lib/content.ts`     | Collection exports, project lookup, filtering, and related-project selection.      |
| `src/lib/metadata.ts`    | Public origin and shared page/social metadata.                                     |
| `src/lib/contact`        | Shared validation, bounded request parsing, and server-only provider integration.  |
| `src/lib/image-sizes.ts` | Layout-specific image slot hints.                                                  |

Components use PascalCase directories with `index.tsx`, a colocated style file, and `type.ts` when needed. Reusable public links, controls, cards, and motion wrappers live in `src/components/common`; page-specific components remain in their existing directories. The shared scroll hook is at `src/lib/motion/use-scroll-motion.ts`. Component styles use prefixed selectors and native nesting, while page styles remain CSS Modules. See [verification](verification.md) for dated check coverage and its limits.

Pages and content stay in Server Components. Header navigation, contact submission, motion, and particles use small Client Components. Server-rendered content passes into motion wrappers and remains visible without JavaScript. Continuous pointer and scroll coordinates use Motion values or engine state rather than React state on each frame. Media subscriptions, observers, event listeners, animation frames, and particle engines clean up when their scope ends.

Keep functions and boundaries small. Add abstractions or dependencies only when the requested behavior needs them. Read the relevant installed Next.js guide in `node_modules/next/dist/docs/` before changing framework APIs.

## Routes and collections

Public pages are `/`, `/about`, `/project`, `/project/[slug]`, `/design`, `/engineering`, and `/contact`. The content snapshot has 17 project detail pages, for 23 public pages in total, and 16 design entries.

- Project search/category filters and design categories use shareable GET URLs with server rendering.
- The first three projects form featured work; unfiltered archives exclude those entries rather than duplicating them. Filtering searches the complete collection.
- Project details use `generateStaticParams` and `dynamicParams = false`. Unknown slugs return the server-rendered 404 with `noindex` and recovery links, including without JavaScript.
- Related projects prioritize shared technologies, then category, through a small pure function.
- `/engineering` links to source and verification documents. `portfolioSourceRef` in `src/content/engineering.ts` targets `feat/portfolio-rework-phase-1` while under review; change it to `main` after merge.

Preserve public slugs, destinations, assets, and attribution during maintenance. Framework route filenames retain their required names.

## Content and provenance

`profile.name` in `src/content/profile.ts` is authoritative: **Ervin Cahyadinata Sungkono**. Use the full name in visible identity, accessible alternatives, metadata, and structured data. Existing account URLs remain unchanged.

Edit profile facts in `profile.ts`, collection entries in `projects.json` and `designs.json`, and walkthroughs/capability links in `engineering.ts`. Access project/design collections through `src/lib/content.ts`. The homepage selects the first three projects, so ordering is editorial. WeTrack, ChatGPT Clone, and Next Pokedex have walkthroughs with documented features, tradeoff analysis, original sources, and explicitly proposed validation steps. WeTrack's team credits remain visible.

The inherited content was reviewed on **7 October 2026**; the documentation date does not refresh those external facts:

| Material                                             | Source and limit                                                                                                                                                |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Original routes, assets, and integration conventions | [Legacy portfolio](https://github.com/ervin-sungkono/Portfolio-Website-v2/tree/6a2c71db6627ee06648a642c64d9c7ac426dfc8f).                                       |
| Project descriptions, URLs, and topics               | Owner's public GitHub repository metadata. WeTrack and ChatGPT Clone notes use their READMEs; Next Pokedex's rendering summary uses its repository description. |
| Screenshots and technology icons                     | Owner's [web-assets repository](https://github.com/ervin-sungkono/web-assets).                                                                                  |
| Design titles and artwork                            | [ErvinCS on Dribbble](https://dribbble.com/ErvinCS) and linked shots.                                                                                           |
| Experience and education                             | The owner's public [LinkedIn profile](https://www.linkedin.com/in/ervin-cahyadinata-sungkono), recorded in `profile.ts`; it is not polled at runtime.           |
| CV                                                   | Original link retained; its currency has not been independently verified.                                                                                       |

Future CMS work should replace the exports/lookups at the content boundary once its scope is requested. No speculative adapter is needed in phase 1.

## Identity and discovery

The public origin is **https://ervincs.com**, defined in `src/lib/metadata.ts`. A `SITE_URL` environment variable does not control it. Canonicals, social URLs, sitemap, robots, and structured data must use this origin in both local and preview builds.

Routes have distinct descriptions and matching Open Graph/Twitter metadata. Filtered collection URLs canonicalize to the unfiltered collection. About renders ProfilePage/Person structured data using visible profile facts; serialization escapes `<`. Project shares use the project's title and screenshot. These are discovery foundations, without a promise of indexing or search rank.

`src/app/robots.ts` and `src/app/sitemap.ts` own discovery endpoints. An old checkout may contain ignored generated `public/robots.txt`, `public/sitemap.xml`, or `public/sitemap-0.xml`; remove those obsolete files if present so they do not shadow the routes. Preview `noindex` is expected; actual deployment headers and production indexing require separate checks.

## Contact integration

The form validates on both client and server, associates errors with fields, focuses the first invalid field, announces status, and preserves drafts after errors. Fields are read-only during CAPTCHA verification and delivery; a synchronous guard prevents duplicate submissions. A successful provider acceptance clears the draft. Acceptance does not establish inbox receipt.

The Node.js API handler at `src/app/api/contact/route.ts`:

1. Rejects a supplied foreign Origin and non-JSON content types.
2. Reads at most **64 KiB** from the request stream, cancelling oversized input before JSON parsing. This accommodates permitted Unicode and escaped JSON field lengths.
3. Validates field types/lengths and rejects the honeypot. CAPTCHA tokens are limited to 4096 characters.
4. Returns a graceful LinkedIn fallback when provider configuration is absent.
5. Verifies invisible reCAPTCHA v2 and sends plain-text mail through Gmail. The configured account is sender and recipient; the visitor's address is `replyTo`.

Provider code stays in a `server-only` module. Errors return usable feedback without exposing credentials or provider details. See `.env.example` for configuration:

| Variable                    | Purpose                                                         |
| --------------------------- | --------------------------------------------------------------- |
| `EMAIL`                     | Gmail sender and recipient.                                     |
| `EMAIL_PASS`                | Gmail app password; server-only.                                |
| `NEXT_PUBLIC_RECAPTCHA_KEY` | Public invisible reCAPTCHA v2 site key, embedded at build time. |
| `RECAPTCHA_SECRET`          | Server-only verification secret.                                |

UI work, unit tests, typechecking, and builds do not require production credentials. Browser tests mock CAPTCHA/delivery and clear provider secrets in their server configuration. Never print or commit secret values. A real delivery test requires an explicit user request and verified hostname/provider setup.

## Image delivery

### Active behavior on 23 October

Commit `112dceb` sets **`images.unoptimized: true`** in `next.config.ts` as a temporary workaround. Next Image remains responsible for component markup and dimensions, but normal image rendering currently serves original sources without Next's image transformations or generated responsive variants. The existing `sizes` hints and optimizer settings must not be described as active transformation or cache savings.

Project screenshots use the original GitHub asset URLs; design artwork retains its Dribbble URLs and queries. Local avatar, organization, and header images use static imports with content-hashed paths. Explicit SVG/GIF and small-header-image bypasses remain. Original files in `public/images` also support existing references and metadata.

With transformation bypassed, browser requests to remote originals are governed by those hosts. The configured optimizer allowlist does not restrict direct browser fetching. Current hosted image loading, transfer size, Vercel usage, and billing have not been measured in this review.

### Retained optimizer configuration

These settings remain for a future reactivation; the 10 October optimizer results in [verification](verification.md) are historical:

- Remote patterns derive from all project/design image entries and constrain exact protocol, host, port, path, and query. Dribbble keeps its existing `?resize=1200x0`; unrelated paths/queries are excluded from optimizer requests. Local patterns allow query-free `/_next/static/media/**` paths.
- Allowed widths are 96, 192, 320, 480, 640, 768, 960, 1200, 1600, and 1920 pixels, with quality 75 and WebP output. The 1920 candidate accommodates original screenshots up to 1909px wide.
- Minimum remote cache TTL is **2,678,400 seconds (31 days)**. When optimization is enabled, a longer upstream lifetime can take precedence. Changed remote artwork should receive a new filename/URL; arbitrary cache-busting queries are not allowed by the patterns.
- `src/lib/image-sizes.ts` describes actual slots in the 75rem container, including collection columns, featured cards, homepage compositions, hero, and artwork. Update hints when those layouts change.

Re-enabling optimization needs a focused change and fresh checks of source selection at 1×/2× density, exact URL rejection, output, image coverage, and hosted cache/usage. Old local results or a redeploy do not prove current hosted delivery or savings. Image cropping, tilt, and parallax remain presentation concerns described in [UI behavior](responsive-and-motion.md).

## Release boundaries

Public component work targets `dev`; CMS work is reviewed separately in PR #3. Preview work does not authorize merging, production promotion, DNS/domain changes, or production-secret changes. Before deployment, verify the actual Vercel project/team, branch, commit, runtime, and target. Node.js 18 was the historical legacy-production setting; the current production runtime has not been inspected in this pass and must be checked before release.

Production indexing, real Gmail receipt, field Core Web Vitals, external-link currency, and hosted image availability require their own evidence. See [remaining verification](verification.md#remaining-work) before making release claims.
