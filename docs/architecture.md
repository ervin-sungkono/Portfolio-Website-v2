# Architecture and implementation decisions

Reviewed against the repository on **23 October 2026 (Asia/Jakarta)**. This document owns application boundaries, content, metadata, contact integration, and image delivery. [UI behavior](responsive-and-motion.md) owns presentation and interaction; [verification](verification.md) records dated evidence, repository status, and remaining checks.

## Scope and stack

The stack is Next.js 16.4 App Router, React 19.2, strict TypeScript, native CSS/CSS Modules, Motion 14, PostgreSQL, Drizzle ORM, Better Auth, and private Vercel Blob storage. Routing and rendering belong to `src/app`. Repeated UI belongs to `src/components`. `src/lib/content.ts` is the public content boundary, and `src/lib/cms` contains server-only CMS storage, authentication, revision, publication, and cache code. Contact validation is shared between browser and API; provider access stays in a `server-only` module. The CMS uses focused boundaries without a generic repository layer or application-wide state provider.

The CMS implementation is under review in PR #3 targeting `dev`. It manages the existing project, design, and profile record types. Professional content expansion remains deferred; CMS validation preserves the existing verified facts and does not supply new biography or achievement claims.

## Public route rendering

Project detail pages render on request in both snapshot and database modes. The guard in `src/proxy.ts` checks static slugs against the checked-in JSON list or, in database mode, runs a fresh parameterized existence query with the public role before rendering. A missing slug rewrites to the dedicated request-time `/project-not-found` recovery page with HTTP 404, `noindex`, and `no-store`; the page waits for the request before rendering so Next.js cannot attach the generated static 404's long CDN cache lifetime. This allows a newly published project slug to become reachable immediately after the fresh guard query succeeds. Direct requests to `/project-not-found` also receive HTTP 404, `noindex`, and `no-store`. A failed database check returns HTTP 503 and does not fall back to snapshots. Known database-backed details then read content through the published-projection cache. The guard adds one existence query per database-mode project detail navigation; it keeps unknown CMS slugs from reaching a dynamic `notFound()` boundary that only returns Flight recovery content without JavaScript. The route intentionally has no `generateStaticParams`: the former empty parameter list with ISR produced runtime 500 responses, and database entries must not require a build to become reachable.

The proxy preserves the original request URL with `skipProxyUrlNormalize`. This keeps recovery rewrites internal when the server binds to IPv4 loopback; Next.js's default localhost normalization otherwise sends recovery through an external self-proxy.

## CMS data and security boundaries

The public content boundary resolves the configured source at request time in both modes. This prevents a build made before database setup from retaining prerendered snapshots after runtime configuration switches to database mode. The public content boundary defaults to the checked-in snapshots. `CMS_CONTENT_SOURCE=database` switches public reads to the PostgreSQL published projection; if that connection or projection fails, the request fails rather than falling back to snapshot content. This keeps a misconfigured database from silently presenting a different version of the portfolio.

PostgreSQL access is split among three runtime roles and an offline migration principal. `portfolio_public` can read only the published content and media projections. `portfolio_cms` reads and changes drafts, revisions, publication records, audit events, outbox rows, and media metadata. `portfolio_auth` serves Better Auth and its owner-membership check. The migration principal owns schema changes and one-time owner bootstrap; its direct connection URL is kept outside runtime settings. Runtime URLs use the provider's pooled endpoint and enforce TLS with certificate verification for remote connections.

Each edit appends an immutable revision and uses the editor's expected revision number to reject stale writes. Publication writes the public content projection, published media registry entries, audit event, and cache outbox event in one SQL transaction. Unpublishing removes the projection and records its audit/outbox event in one transaction. The outbox makes cache refresh retryable after a committed database change. Public cache identity includes a non-reversible namespace derived from database host, port, name, runtime role, validated endpoint-routing value (`options=endpoint=...`) when present, deployment/CMS environment, and preview branch. The URL parser permits only one each of `sslmode`, `channel_binding`, and a validated `options` endpoint value; credentials and unrecognized parameters do not enter the key.

Better Auth provides password login, TOTP, and ten encrypted backup codes. Public signup and OAuth are disabled. Password reset revokes sessions, but no self-service email-reset flow is configured. The initial owner is created by an offline bootstrap command and must enroll a verified TOTP factor before editing. Publish and unpublish require a password-and-factor session established within the last 30 minutes. Private draft previews are excluded from indexing; their media endpoint is authenticated, `no-store`, and unoptimized. See [CMS setup and operations](cms.md) for configuration, bootstrap, migration, publishing, and recovery steps.

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

The current component layout uses PascalCase directories containing `index.tsx`, `type.ts`, and `style.css`; the shared scroll hook is at `src/lib/motion/use-scroll-motion.ts`. Component styles use prefixed selectors and native nesting, while page styles remain CSS Modules. The documentation pass did not rerun application checks; see [verification](verification.md) for the recorded coverage and its limits.

Pages and content stay in Server Components. Header navigation, contact submission, motion, and particles use small Client Components. Server-rendered content passes into motion wrappers and remains visible without JavaScript. Continuous pointer and scroll coordinates use Motion values or engine state rather than React state on each frame. Media subscriptions, observers, event listeners, animation frames, and particle engines clean up when their scope ends.

Keep functions and boundaries small. Add abstractions or dependencies only when the requested behavior needs them. Read the relevant installed Next.js guide in `node_modules/next/dist/docs/` before changing framework APIs.

## Routes and collections

Public pages are `/`, `/about`, `/project`, `/project/[slug]`, `/design`, `/engineering`, and `/contact`. The content snapshot has 17 project detail pages, for 23 public pages in total, and 16 design entries.

- Project search/category filters and design categories use shareable GET URLs with server rendering.
- The first three projects form featured work; unfiltered archives exclude those entries rather than duplicating them. Filtering searches the complete collection.
- Project details resolve on request in both content-source modes. Unknown slugs use the dedicated 404 recovery route described in [Public route rendering](#public-route-rendering).
- Related projects prioritize shared technologies, then category, through a small pure function.
- `/engineering` links to source and verification documents. `portfolioSourceRef` in `src/content/engineering.ts` targets `dev` while CMS PR #3 is under review; update it after that PR merges.

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

The content boundary resolves either the checked-in snapshots or the configured published database projection; drafts remain available only to the authenticated CMS.

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

Existing project/design URLs use the exact remote allowlist; local assets use static imports where applicable. The optimizer configuration retains ten widths, quality 75, WebP, layout-specific `sizes`, and a 31-day minimum cache lifetime. These settings are currently inactive for normal image requests because `images.unoptimized: true` is enabled. Changed remote artwork should use a new source URL. CMS images use one private Blob store, with public delivery gated by the SQL publication registry and private previews authenticated, no-store, and unoptimized. See [CMS setup and operations](cms.md) for storage rules and limits.

Commit `112dceb` sets **`images.unoptimized: true`** in `next.config.ts` as a temporary workaround. Next Image remains responsible for component markup and dimensions, but normal image rendering currently serves original sources without Next's image transformations or generated responsive variants. The existing `sizes` hints and optimizer settings must not be described as active transformation or cache savings.

CMS changes are under review in PR #3 targeting `dev`. Hosted Neon and Blob resources have not been provisioned, and no production release has been made. For a future release, use Node.js 24, keep preview and production database/cache scopes separate, provision the private Blob token, and configure the role-separated URLs from the runbook. The public origin in `src/lib/metadata.ts` is `https://ervincs.com`; preview URLs never enter canonical metadata and a stale `SITE_URL` variable has no effect.

With transformation bypassed, browser requests to remote originals are governed by those hosts. The configured optimizer allowlist does not restrict direct browser fetching. Current hosted image loading, transfer size, Vercel usage, and billing have not been measured in this review.

Contact fields are read-only during a submission, with a synchronous duplicate-submission guard. The request-body reader enforces a 64 KiB byte cap so permitted field lengths also fit when encoded as Unicode or JSON escapes; CAPTCHA tokens retain their 4096-character limit. Provider integration remains server-only.

These settings remain for a future reactivation; the 10 October optimizer results in [verification](verification.md) are historical:

- Remote patterns derive from all project/design image entries and constrain exact protocol, host, port, path, and query. Dribbble keeps its existing `?resize=1200x0`; unrelated paths/queries are excluded from optimizer requests. Local patterns allow query-free `/_next/static/media/**` paths.
- Allowed widths are 96, 192, 320, 480, 640, 768, 960, 1200, 1600, and 1920 pixels, with quality 75 and WebP output. The 1920 candidate accommodates original screenshots up to 1909px wide.
- Minimum remote cache TTL is **2,678,400 seconds (31 days)**. When optimization is enabled, a longer upstream lifetime can take precedence. Changed remote artwork should receive a new filename/URL; arbitrary cache-busting queries are not allowed by the patterns.
- `src/lib/image-sizes.ts` describes actual slots in the 75rem container, including collection columns, featured cards, homepage compositions, hero, and artwork. Update hints when those layouts change.

Re-enabling optimization needs a focused change and fresh checks of source selection at 1×/2× density, exact URL rejection, output, image coverage, and hosted cache/usage. Old local results or a redeploy do not prove current hosted delivery or savings. Image cropping, tilt, and parallax remain presentation concerns described in [UI behavior](responsive-and-motion.md).

## Release boundaries

The rework is merged to `dev`; CMS PR #3 targets `dev`. Preview work does not authorize production promotion, DNS/domain changes, or production-secret changes. Before deployment, verify the actual Vercel project/team, branch, commit, runtime, and target. Node.js 18 was the historical legacy-production setting; verify the current production runtime before release.

Production indexing, real Gmail receipt, field Core Web Vitals, external-link currency, and hosted image availability require their own evidence. See [remaining verification](verification.md#remaining-work) before making release claims.
