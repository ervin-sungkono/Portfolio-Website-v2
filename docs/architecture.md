# Portfolio architecture and operations

Updated for CSS ownership on **1 November 2026 (Asia/Jakarta)**. This document owns application boundaries, content, metadata, contact integration, and image delivery. [UI behavior](responsive-and-motion.md) owns presentation and interaction; [verification](verification.md) records dated evidence, repository status, and remaining checks.

## Scope and stack

The portfolio preserves verified project facts, artwork, CV, social links, and team credits through server-rendered pages. The stack is Next.js 16.4.3 App Router, React 19.2, strict TypeScript, native CSS, next-themes, Motion 14, Nodemailer 10.2, Auth.js 5 beta, Zod 4, and React Hook Form. Install with the committed lockfile using Node.js 24; the package requires Node.js 22 or newer, while the isolated CMS browser fixture runner requires Node.js 24.

The owner-only GitHub CMS lives inside this Next.js application. A separate public repository stores JSON and modest images; there is no database, separate backend, or object-storage provider. The earlier Neon-based PR #3 is closed and unmerged. Professional content expansion remains deferred: do not infer new responsibilities, contributions, seniority, or measured outcomes from the implementation.

## Code boundaries

| Location                 | Responsibility                                                                     |
| ------------------------ | ---------------------------------------------------------------------------------- |
| `src/app`                | Routes, layouts, metadata endpoints, page composition, and the contact API.        |
| `src/components`         | Reusable UI and focused browser interactions.                                      |
| `src/styles/globals.css` | Shared theme, typography, spacing, layout utilities, and accessibility primitives. |
| `web-assets/content`     | Published profile, engineering walkthroughs, projects, and design records.         |
| `src/lib/content.ts`     | Collection exports, project lookup, filtering, and related-project selection.      |
| `src/lib/metadata.ts`    | Public origin and shared page/social metadata.                                     |
| `src/lib/contact`        | Shared validation, bounded request parsing, and server-only provider integration.  |
| `src/lib/image-sizes.ts` | Layout-specific image slot hints.                                                  |

Components use PascalCase directories with `index.tsx`, and a `type.ts` where useful. Shared links, cards, experience, and motion wrappers live in `src/components/common`; `src/components/layout` owns site-wide layout and motion. Page sections live under `home`, `about`, `project`, `design`, `contact`, or `admin`, while routes in `src/app` compose them and retain metadata and data loading. Component-specific CSS Modules are named `style.module.css` and imported from the component's own directory; route-owned modules use the same name beside the route. Existing shared global styles remain in their established stylesheets. The shared scroll hook is at `src/lib/hooks/use-scroll-motion.ts`. See [verification](verification.md) for dated check coverage and its limits.

Pages and content stay in Server Components. Header navigation, contact submission, motion, and particles use small Client Components. Server-rendered content passes into motion wrappers and remains visible without JavaScript. Continuous pointer and scroll coordinates use Motion values or engine state rather than React state on each frame. Media subscriptions, observers, event listeners, animation frames, and particle engines clean up when their scope ends.

Keep functions and boundaries small. Add abstractions or dependencies only when the requested behavior needs them. Read the relevant installed Next.js guide in `node_modules/next/dist/docs/` before changing framework APIs.

## Routes and collections

Public pages are `/`, `/about`, `/project`, `/project/[slug]`, `/design`, and `/contact`. The content snapshot has 17 project detail pages, for 22 public pages in total, and 16 design entries.

- Project search/category filters and design categories use shareable GET URLs with server rendering.
- GitHub content uses explicit `featured` flags and `sortOrder`; unfiltered archives exclude featured entries. Filtering searches the complete published collection.
- Project details can render newly published slugs after deployment. Their content is cached and invalidated after publication. Unknown/unpublished slugs use 404/noindex recovery; the current checks and any no-JavaScript limits are recorded in [verification](verification.md).
- Related projects prioritize shared technologies, then category, through a small pure function.
  Preserve public slugs, destinations, assets, and attribution during maintenance. Framework route filenames retain their required names.

The 404 markup and its module live together in `src/app/not-found/`. The framework-required `src/app/not-found.tsx` delegates to that view. The project proxy buffers the same `/not-found` page and returns it with a 404 status, noindex, and no-store headers; the directly accessible `/not-found` route is also noindex. Header navigation treats the recovery document as a project path so the proxied HTML hydrates consistently at the visitor's requested URL.

## Content and provenance

`profile.name` in `web-assets/content/portfolio.json` is authoritative: **Ervin Cahyadinata Sungkono**. Use the full name in visible identity, accessible alternatives, metadata, and structured data. Existing account URLs remain unchanged.

Edit profile facts, skills, designs, and project walkthroughs in the content repository's `content/portfolio.json`; the owner CMS edits homepage copy, projects, and taxonomy. Access public collections through `src/lib/content.ts`. The homepage selects up to three featured projects, so ordering is editorial. WeTrack, ChatGPT Clone, and Next Pokedex have walkthroughs with documented features, tradeoff analysis, original sources, and explicitly proposed validation steps. WeTrack's team credits remain visible.

The inherited content was reviewed on **7 October 2026**; the documentation date does not refresh those external facts:

| Material                                             | Source and limit                                                                                                                                                |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Original routes, assets, and integration conventions | [Legacy portfolio](https://github.com/ervin-sungkono/Portfolio-Website-v2/tree/6a2c71db6627ee06648a642c64d9c7ac426dfc8f).                                       |
| Project descriptions, URLs, and topics               | Owner's public GitHub repository metadata. WeTrack and ChatGPT Clone notes use their READMEs; Next Pokedex's rendering summary uses its repository description. |
| Screenshots and technology icons                     | Owner's [web-assets repository](https://github.com/ervin-sungkono/web-assets).                                                                                  |
| Design titles and artwork                            | [ErvinCS on Dribbble](https://dribbble.com/ErvinCS) and linked shots.                                                                                           |
| Experience and education                             | The owner's public [LinkedIn profile](https://www.linkedin.com/in/ervin-cahyadinata-sungkono), recorded in the content repository; it is not polled at runtime. |
| CV                                                   | Original link retained; its currency has not been independently verified.                                                                                       |

`src/lib/content.ts` is the public content boundary. All published records come from GitHub; there is no bundled portfolio-data fallback. A cold build or cache refresh fails visibly if the required remote content is unavailable or invalid. The generic application shell remains available so the owner can reach CMS setup.

## GitHub CMS

### Setup and source separation

Configure these server-only variables from `.env.example` in local `.env.local` or the intended Vercel environment:

| Variable                | Purpose                                                                          |
| ----------------------- | -------------------------------------------------------------------------------- |
| `AUTH_SECRET`           | Random secret for Auth.js encrypted sessions; use at least 32 random characters. |
| `AUTH_GITHUB_ID`        | GitHub OAuth application's client ID.                                            |
| `AUTH_GITHUB_SECRET`    | GitHub OAuth application's client secret.                                        |
| `GITHUB_ADMIN_ID`       | Owner's immutable numeric GitHub user ID.                                        |
| `GITHUB_REPO`           | Separate public content repository name, without an owner or slash.              |
| `GITHUB_CONTENT_OWNER`  | Public repository owner login; required for a non-default source.                |
| `GITHUB_CONTENT_BRANCH` | Public repository branch; required for a non-default source.                     |

Create an OAuth application with callback `https://<deployment-host>/api/auth/callback/github`; for local development use `http://localhost:3000/api/auth/callback/github` with a separate development OAuth app. The provider requests `read:user repo`. The `repo` permission is broad; application writes are constrained to the configured repository and allowlisted paths. Never expose these variables through `NEXT_PUBLIC_`, browser storage, URLs, or logs. Public reads default to `ervin-sungkono/web-assets` on `master` without an OAuth token; changing the owner or repository also requires the matching public owner and branch variables.

Do not connect the content repository as a Vercel deployment source. Only application source changes need builds. A template installer supplies their own OAuth app, numeric ID, repository name, and Auth secret; no repository picker, database, or extra read token is required. GitHub configuration does not change the canonical public origin `https://ervincs.com`.

Opening `/admin` shows setup or GitHub sign-in. Sign-in accepts only the configured GitHub account ID. Auth.js keeps its OAuth access token in an encrypted HttpOnly, SameSite cookie; client session JSON exposes only the allowlisted identity fields. Every CMS mutation checks that encrypted owner session and verifies the token's current identity with GitHub again. Expired/revoked credentials require another sign-in. Auth/admin responses and CMS APIs do not expose the access token. Next.js resolves the `server-only` build marker itself; there is no `server-only` npm dependency.

### Modules and storage

- `src/lib/cms/schemas.ts`: shared strict Zod documents and mutations, used by React Hook Form and server validation.
- `github.ts`, `repository.ts`: bounded GitHub access, numeric owner/default-branch resolution, typed files, reads, media/reference validation, and custom-identity commits.
- `initialization.ts`, `content-mutations.ts`, `project-index.ts`, `media.ts`: initialization, optimistic JSON publishing/deletion, project-index synchronization, and immutable image uploads.
- `auth.ts`, `auth-policy.ts`, `http.ts`: trusted credential retrieval, owner policy, same-origin mutations, bounded JSON requests, and private responses.
- `public.ts`, `cache.ts`, `publishing.ts`: public cached projection, invalidation policy, and separation of commit success from cache failures.
- `src/components/admin/CmsEditor`: structured project, site-profile, category, technology, and image forms; no GitHub API calls or credentials in components. Panels and messages have nested PascalCase directories; the editor's own `style.css` keeps shared form primitives, avoiding duplicated control styles.
- `src/proxy.ts` and `/api/content/project`: publication checks before project rendering, using the same cached public content boundary. Missing projects return a buffered recovery document with HTTP 404/noindex/no-store. This avoids Next.js PPR's blank no-JavaScript recovery and status replacement during rewrites. Internal requests use the platform's `VERCEL_URL` or local `127.0.0.1:PORT` (default 3000), never a visitor-supplied Host. Set `PORT` when running the app locally on another port.

Storage uses `content/site.json`, `content/portfolio.json`, `content/categories.json`, `content/technologies.json`, `content/project-index.json`, and `content/projects/<slug>.json`. The filename is the URL identity; project JSON has no duplicate ID/slug. The CMS maintains the project index because raw GitHub URLs cannot list directories. Registries use stable IDs, projects refer to those IDs, and images use repository-relative paths under `media/projects/<slug>/` or `media/technologies/`. The application's existing route remains `/project/<slug>`.

### Initialization and editing

After authorized sign-in, choose **Initialize repository** only for a nonexistent or empty public repository, or to reuse a compatible CMS repository. Public requests and builds never initialize storage. The initializer creates a public repository if needed, reads its actual default branch, and writes README plus the three seed documents and project index. A new repository also needs an explicitly supplied `content/portfolio.json` matching `portfolioSchema` before public pages can render. Each CMS Contents API commit sets both author and committer to `Portfolio CMS <cms@portfolio.local>`, including bootstrap. Keep that email unassociated with the owner's GitHub account; GitHub may still show the authenticated account as the API actor. Retries inspect existing content and only complete an exact known seed subset. Private, legacy `web-assets`, unrelated populated, and incompatible repositories stop with an actionable error; nothing is erased or reset.

The editor retains drafts after validation, network, or SHA conflicts. Every update compares the loaded file's blob SHA; a stale version returns HTTP 409. Category/technology edits validate references against the current snapshot. Publish/unpublish/delete validate authoritative documents and media before writing. Separate concurrent file writes are not transactional: use one publishing tab for taxonomy changes to avoid a category deletion racing with a project update; manual Git repair can be needed if such a race occurs. All content is public in GitHub, including `published: false` and earlier revisions; unpublishing only hides it from the portfolio.

Images accept PNG, JPEG, and WebP only, at most 1 MiB, with matching MIME, extension, and byte signatures. Arbitrary SVG uploads are rejected. Existing technology SVG references are checked. Uploads use content-hashed names, then the owner selects the returned path in the project/icon form. Upload and JSON commits are separate; an abandoned upload may leave an unused public file. Git history and existing browser/CDN copies cannot be made private by unpublishing.

### Publishing and ISR

At build time and after invalidation, the public reader resolves the latest branch commit through GitHub's public commit feed, then loads and validates all JSON at that immutable revision via raw GitHub URLs. This avoids the unauthenticated REST core limit and keeps one consistent revision across files. Next.js Cache Components retains the result without time-based revalidation; individual project lookups also carry `project:<slug>` tags. Cache keys include the public repository and branch, never session credentials. Authenticated editor reads use GitHub's REST API and bypass the public cache. A failed cold read is visible; a failed background refresh may retain the previous cached result.

After GitHub confirms a project write or delete, the CMS synchronizes the index before invalidating affected tags and paths. The project and index are separate optimistic commits, so a failed index update leaves the accepted project commit intact and reports a pending refresh; **Retry public refresh** repairs the index and retries invalidation. `revalidateTag(tag, 'max')` marks data stale; visitors may briefly receive the previous version while regeneration runs. “Cache refreshed” means invalidation was accepted, not instant global delivery. The owner can also use **Refresh public content** after direct GitHub edits; it rebuilds the index and invalidates all public content.

`partialPrefetching` is explicitly disabled while migrating the existing portfolio to Cache Components. Existing project detail paths are prerendered at build time; new published paths can render after an authorized refresh without a build. Collection GET filters use blocking server rendering so native navigation remains usable. Direct GitHub edits require an authorized refresh; there is no webhook or scheduled refresh. Content commits never call a deploy hook or Vercel deployment API. `images.unoptimized: true` still serves original GitHub assets; the CMS does not enable image transformations.

### Legacy content mapping and rollback

Use [the LLM mapping instructions](web-assets-migration-agent.md) to audit old content against the shared schemas. The prior one-off conversion utility was removed after the authorized migration; no ongoing runtime behavior depends on it. The instructions treat `web-assets/legacy` as read-only source, compare it with the already migrated `master`, and require a mapping report before edits. No executable converter is maintained.

On 25 October the owner separately authorized publishing to `web-assets/master`, with the old master preserved on `legacy`. Existing `images/` and `icons/` remain as compatibility directories until the application release; initialization can reuse them only with complete, valid CMS documents and never bootstraps over asset-only legacy storage. [Verification](verification.md#authorized-web-assets-publication) records exact refs, author/committer, schema/media read-back, and rollback limits.

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

- Remote optimizer patterns are not configured while transformations are disabled. Local patterns allow query-free `/_next/static/media/**` paths; define and validate a suitable remote allowlist before enabling optimization.
- Allowed widths are 96, 192, 320, 480, 640, 768, 960, 1200, 1600, and 1920 pixels, with quality 75 and WebP output. The 1920 candidate accommodates original screenshots up to 1909px wide.
- Minimum remote cache TTL is **2,678,400 seconds (31 days)**. When optimization is enabled, a longer upstream lifetime can take precedence. Changed remote artwork should receive a new filename/URL.
- `src/lib/image-sizes.ts` describes actual slots in the 75rem container, including collection columns, featured cards, homepage compositions, hero, and artwork. Update hints when those layouts change.

Re-enabling optimization needs a focused change and fresh checks of source selection at 1×/2× density, exact URL rejection, output, image coverage, and hosted cache/usage. Old local results or a redeploy do not prove current hosted delivery or savings. Image cropping, tilt, and parallax remain presentation concerns described in [UI behavior](responsive-and-motion.md).

## Release boundaries

Public component work normally targets `dev`; the earlier Neon CMS PR #3 was closed without merging. Preview work does not authorize merging, production promotion, DNS/domain changes, or production-secret changes. Before deployment, verify the actual Vercel project/team, branch, commit, runtime, and target. Node.js 18 was the historical legacy-production setting; the current production runtime has not been inspected in this pass and must be checked before release.

Production indexing, real Gmail receipt, field Core Web Vitals, external-link currency, and hosted image availability require their own evidence. See [remaining verification](verification.md#remaining-work) before making release claims.
