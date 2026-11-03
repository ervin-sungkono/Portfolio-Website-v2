# Portfolio architecture and operations

Updated for the GitHub and Dribbble CMS flow on **3 November 2026 (Asia/Jakarta)**. This document owns application boundaries, content, metadata, contact integration, and image delivery. [UI behavior](responsive-and-motion.md) owns presentation and interaction; [verification](verification.md) records dated evidence, repository status, and remaining checks.

## Scope and stack

The portfolio preserves verified project facts, artwork, CV, social links, and team credits through server-rendered pages. The stack is Next.js 16.4.3 App Router, React 19.2, strict TypeScript, native CSS, next-themes, Motion 14, Nodemailer 10.2, Auth.js 5 beta, Zod 4, and React Hook Form. Install with the committed lockfile using Node.js 24; the package requires Node.js 22 or newer, while the isolated CMS browser fixture runner requires Node.js 24.

The owner-only GitHub CMS lives inside this Next.js application. A separate public repository stores JSON and modest images; there is no database, separate backend, or object-storage provider. The earlier Neon-based PR #3 is closed and unmerged. Professional content expansion remains deferred: do not infer new responsibilities, contributions, seniority, or measured outcomes from the implementation.

## Code boundaries

| Location                 | Responsibility                                                                     |
| ------------------------ | ---------------------------------------------------------------------------------- |
| `src/app`                | Routes, layouts, metadata endpoints, page composition, and the contact API.        |
| `src/components`         | Reusable UI and focused browser interactions.                                      |
| `src/styles/globals.css` | Shared theme, typography, spacing, layout utilities, and accessibility primitives. |
| `web-assets/content`     | Published profile, engineering walkthroughs, projects, and selected design IDs.    |
| `src/lib/content.ts`     | Collection exports, project lookup, filtering, and related-project selection.      |
| `src/lib/metadata.ts`    | Public origin and shared page/social metadata.                                     |
| `src/lib/contact`        | Shared validation, bounded request parsing, and server-only provider integration.  |
| `src/lib/image-sizes.ts` | Layout-specific image slot hints.                                                  |

Components use PascalCase directories with `index.tsx`, and a `type.ts` where useful. Shared links, cards, experience, and motion wrappers live in `src/components/common`; `src/components/layout` owns site-wide layout and motion. Page sections live under `home`, `about`, `project`, `design`, `contact`, or `admin`, while routes in `src/app` compose them and retain metadata and data loading. Component-specific CSS Modules are named `style.module.css` and imported from the component's own directory; route-owned modules use the same name beside the route. Existing shared global styles remain in their established stylesheets. The shared scroll hook is at `src/lib/hooks/use-scroll-motion.ts`. See [verification](verification.md) for dated check coverage and its limits.

Pages and content stay in Server Components. Header navigation, contact submission, motion, and particles use small Client Components. Server-rendered content passes into motion wrappers and remains visible without JavaScript. Continuous pointer and scroll coordinates use Motion values or engine state rather than React state on each frame. Media subscriptions, observers, event listeners, animation frames, and particle engines clean up when their scope ends.

Keep functions and boundaries small. Add abstractions or dependencies only when the requested behavior needs them. Read the relevant installed Next.js guide in `node_modules/next/dist/docs/` before changing framework APIs.

## Routes and collections

Public pages are `/`, `/about`, `/project`, `/project/[slug]`, `/design`, and `/contact`. The content snapshot has 17 project detail pages, for 22 public pages in total, and 16 design entries.

- Project search/category filters use shareable GET URLs with server rendering. The Design page shows all available selected shots in saved order, without category filters.
- GitHub content uses explicit `featured` flags and `sortOrder`; unfiltered archives exclude featured entries. Filtering searches the complete published collection.
- Project details can render newly published slugs after deployment. Their content is cached and invalidated after publication. Unknown/unpublished slugs use 404/noindex recovery; the current checks and any no-JavaScript limits are recorded in [verification](verification.md).
- Related projects prioritize shared technologies, then category, through a small pure function.
  Preserve public slugs, destinations, assets, and attribution during maintenance. Framework route filenames retain their required names.

The 404 markup and its module live together in `src/app/not-found/`. The framework-required `src/app/not-found.tsx` delegates to that view. The project proxy buffers the same `/not-found` page and returns it with a 404 status, noindex, and no-store headers; the directly accessible `/not-found` route is also noindex. Header navigation treats the recovery document as a project path so the proxied HTML hydrates consistently at the visitor's requested URL.

## Content and provenance

`profile.name` in `web-assets/content/portfolio.json` is authoritative: **Ervin Cahyadinata Sungkono**. Use the full name in visible identity, accessible alternatives, metadata, and structured data. Existing account URLs remain unchanged.

Edit profile facts, skills, and project walkthroughs in the content repository's `content/portfolio.json`; the owner CMS edits homepage copy, projects, taxonomy, and the ordered selection of Dribbble shot IDs. Design titles, links, and images are read from Dribbble on the server. Access public collections through `src/lib/content.ts`. The homepage selects up to three featured projects, so ordering is editorial. WeTrack, ChatGPT Clone, and Next Pokedex have walkthroughs with documented features, tradeoff analysis, original sources, and explicitly proposed validation steps. WeTrack's team credits remain visible.

The inherited content was reviewed on **7 October 2026**; the documentation date does not refresh those external facts:

| Material                                             | Source and limit                                                                                                                                                |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Original routes, assets, and integration conventions | [Legacy portfolio](https://github.com/ervin-sungkono/Portfolio-Website-v2/tree/6a2c71db6627ee06648a642c64d9c7ac426dfc8f).                                       |
| Project descriptions, URLs, and topics               | Owner's public GitHub repository metadata. WeTrack and ChatGPT Clone notes use their READMEs; Next Pokedex's rendering summary uses its repository description. |
| Screenshots and technology icons                     | Owner's [web-assets repository](https://github.com/ervin-sungkono/web-assets).                                                                                  |
| Design titles and artwork                            | [ErvinCS on Dribbble](https://dribbble.com/ErvinCS) and linked shots.                                                                                           |
| Experience and education                             | The owner's public [LinkedIn profile](https://www.linkedin.com/in/ervin-cahyadinata-sungkono), recorded in the content repository; it is not polled at runtime. |
| CV                                                   | Original link retained; its currency has not been independently verified.                                                                                       |

`src/lib/content.ts` is the public content boundary. Portfolio documents come from GitHub and selected design details come from Dribbble; there is no bundled portfolio-data fallback. A cold read of unavailable or invalid GitHub content fails visibly. When Dribbble is unavailable, the affected design section displays an unavailable message. The generic application shell remains available so the owner can reach CMS setup.

## GitHub CMS

### Setup and source separation

Configure these server-only variables from `.env.example` in local `.env.local` or the intended Vercel environment:

| Variable             | Purpose                                                                                                       |
| -------------------- | ------------------------------------------------------------------------------------------------------------- |
| `AUTH_SECRET`        | Random secret for Auth.js encrypted sessions; use at least 32 random characters.                              |
| `AUTH_GITHUB_ID`     | GitHub OAuth application's client ID.                                                                         |
| `AUTH_GITHUB_SECRET` | GitHub OAuth application's client secret.                                                                     |
| `GITHUB_REPO`        | Separate public content repository name, without an owner or slash.                                           |
| `GITHUB_PAT`         | Server-side GitHub personal access token for owner identity, repository discovery, content reads, and writes. |
| `DRIBBBLE_TOKEN`     | Server-side Dribbble OAuth access token used to list the owner's shots.                                       |

Create an OAuth application with callback `https://<deployment-host>/api/auth/callback/github`; for local development use `http://localhost:3000/api/auth/callback/github` with a separate development OAuth app. OAuth requests `read:user` for sign-in only. The PAT needs access to the public content repository, including contents read/write; to list private repositories it also needs the corresponding repository access. Automatic creation requires a token permitted to create repositories; otherwise create the public repository with an initial README commit first. Grant only the access needed and keep every credential out of `NEXT_PUBLIC_`, browser storage, URLs, and logs. The PAT's `/user` response supplies the content owner, and GitHub supplies the configured repository's default branch; these are not separate settings.

Do not connect the content repository as a Vercel deployment source. Only application source changes need builds. A template installer supplies their own OAuth app, PAT, Dribbble token, repository name, and Auth secret. GitHub configuration does not change the canonical public origin `https://ervincs.com`.

Opening `/admin` shows setup or GitHub sign-in. The OAuth identity must match the numeric ID returned by the PAT's GitHub `/user` endpoint at sign-in and on privileged requests; a missing, revoked, or unverifiable PAT fails closed. Rotating to a PAT for a different account changes the authorized owner. The encrypted HttpOnly, SameSite session retains the identity, not the OAuth access token; client session JSON exposes only allowlisted identity fields. The PAT and Dribbble token remain in trusted server code and never appear in CMS responses. Next.js resolves the `server-only` build marker itself; there is no `server-only` npm dependency.

### Modules and storage

- `src/lib/cms/schemas.ts`: shared strict Zod documents and mutations, used by React Hook Form and server validation.
- `github.ts`, `github-repositories.ts`, `repository.ts`: GitHub access, repository discovery, owner/default-branch resolution, typed reads, and reference validation.
- `git-data.ts`, `git-identity.ts`, `draft-finalization.ts`: create media/content blobs and one Git tree/commit for the final browser draft, then update the branch once.
- `initialization.ts`, `project-index.ts`, `media.ts`, `media-path.ts`: repository setup, project-index validation, staged-media verification, and content-hashed paths.
- `auth.ts`, `auth-policy.ts`, `http.ts`: trusted credential retrieval, owner policy, same-origin mutations, bounded JSON requests, and private responses.
- `public.ts`, `cache.ts`, `publishing.ts`: public cached projection, batch invalidation, and separation of commit success from cache failures.
- `src/lib/dribbble.ts`: server-side Dribbble shot listing, pagination, and mapping into public design details.
- `src/components/admin/CmsDraftProvider`: repository-scoped browser Cache Storage for pending document edits and image bytes, with an exclusive Web Lock for one editing tab per origin. Editing requires a secure context and a Web Locks-capable browser; drafts remain local to the browser profile.
- `src/components/admin/CmsEditor` and `GitHubImport`: structured forms, design selection, and repository mapping; per-section saves update the browser draft, while a final submit calls the application's CMS endpoints.
- `src/proxy.ts` and `/api/content/project`: publication checks before project rendering, using the same cached public content boundary. Missing projects return a buffered recovery document with HTTP 404/noindex/no-store. This avoids Next.js PPR's blank no-JavaScript recovery and status replacement during rewrites. Internal requests use the platform's `VERCEL_URL` or local `127.0.0.1:PORT` (default 3000), never a visitor-supplied Host. Set `PORT` when running the app locally on another port.

Storage uses `content/site.json`, `content/portfolio.json`, `content/categories.json`, `content/technologies.json`, `content/project-index.json`, and `content/projects/<slug>.json`. The filename is the URL identity; project JSON has no duplicate slug. Strict version-2 projects have a nullable `githubRepositoryId`, which must be unique when present. The version-2 portfolio stores an ordered list of selected Dribbble IDs, not shot metadata. The CMS maintains the project index because raw GitHub URLs cannot list directories. Registries use stable IDs, projects refer to those IDs, and images use repository-relative paths under `media/projects/<slug>/` or `media/technologies/`. The application's existing route remains `/project/<slug>`.

### Initialization and editing

After authorized sign-in, choose **Initialize repository** only for a new or compatible public content repository. Public requests and builds never initialize storage. For a new repository, GitHub creates the initial branch and README. An existing repository without an initial branch first needs a README commit; a compatible README-only repository can then be initialized without replacing its README. The CMS adds missing seed documents and the project index in one Git commit. A new repository also needs an explicitly supplied `content/portfolio.json` matching `portfolioSchema` before public pages can render. Each CMS Git commit sets both author and committer to `Portfolio CMS <cms@portfolio.local>`, including bootstrap. Keep that email unassociated with the owner's GitHub account; GitHub may still show the authenticated account as the API actor. Retries inspect existing content and only complete an exact known seed subset. Private, legacy `web-assets`, unrelated populated, and incompatible repositories stop with an actionable error; nothing is erased or reset.

Project, site-profile, category, and technology forms save drafts to browser Cache Storage; design toggles update the draft directly. The draft is keyed to the selected content repository and remains available after a page reload in that browser profile, subject to browser storage quotas, eviction, and manual clearing. Editing requires a secure context and Web Locks support. An exclusive origin lock allows one `/admin` or `/admin/import` tab to edit at a time; another tab remains read-only until the owner closes it and reloads. A browser before-unload prompt warns when a draft write is pending or needs retry. The draft is not sent to GitHub until the owner confirms **Submit all changes**. If a document changed after it was loaded, the server returns HTTP 409 and the editor shows the current repository value beside the local draft. The owner must explicitly choose **Use reviewed versions as baseline** before submitting those fields again; the draft is retained through the conflict and review.

One confirmed submit validates the complete draft and publishes changed documents, the updated project index, deletes, and staged images in one Git commit and one branch update. Project references and media are checked against the resulting snapshot before the update; an unattached staged image must be added to a project or technology icon, or removed from the draft, before submission. A changed configured repository or default branch is rejected for review, as is a concurrent branch move. All committed content is public in GitHub, including `published: false` and earlier revisions; unpublishing only hides it from the portfolio.

On `/admin/import`, choose an accessible GitHub repository and map it to a new or existing project. Review suggested metadata and complete the shared project form before saving it to the browser draft. Refreshing GitHub metadata leaves the draft untouched; applying available fields fills only blanks. The owner must acknowledge that final submission will place metadata from a private repository or a staged image in the public content repository, even for an unpublished project. The Designs panel provides show/hide controls without editing shot details. Missing selected IDs remain saved until explicitly removed.

Images accept PNG, JPEG, and WebP only, at most 1 MiB, with matching MIME, extension, and byte signatures. Arbitrary SVG uploads are rejected. Existing technology SVG references are checked. Selecting **Stage images in browser draft** stores image bytes and content-hashed paths in Cache Storage; the owner can remove staged images before submission. For project media, the first staged image fills an empty cover and later images are added to the gallery. The browser sends each remaining image to `/api/cms/media` only after final submission is confirmed; the server validates it and creates a Git blob. Those blobs join the document changes in the same tree and commit. A failed submission leaves the browser draft available for retry.

### Publishing and ISR

At build time and after invalidation, the server derives the public source from the PAT owner and GitHub's repository metadata, resolves the latest branch commit through GitHub's public commit feed, then loads and validates all JSON at that immutable revision via raw GitHub URLs. Next.js Cache Components retains the result without time-based revalidation; individual project lookups also carry `project:<slug>` tags. Cache keys and cached results do not contain credentials. Authenticated editor reads use GitHub's REST API and bypass the public cache. A failed cold read is visible; a failed background refresh may retain the previous cached result. Selected design details are fetched from Dribbble's `GET /v2/user/shots`, following its pagination links, and cached for public rendering; failed API responses are not cached as successful empty selections.

The finalizer validates all changed documents and media at one branch revision, updates `content/project-index.json` when projects change, and writes the resulting tree through one commit and branch update. It then invalidates the affected cache tags and paths in a batch. `revalidateTag(tag, 'max')` marks data stale; visitors may briefly receive the previous version while regeneration runs. “Cache refreshed” means invalidation was accepted, not instant global delivery.

Design selection is part of the same browser draft and final commit. If cache invalidation fails after a successful commit, the editor retains a pending-refresh marker; **Retry public refresh** sends only cache invalidation and does not write another content commit. The owner can also use **Refresh public content** after direct GitHub edits. Dribbble's [published API terms](https://developer.dribbble.com/terms/) restrict storage of its data; whether saved shot IDs and ISR-cached responses are permitted requires clarification from Dribbble.

`partialPrefetching` is explicitly disabled while migrating the existing portfolio to Cache Components. Existing project detail paths are prerendered at build time; new published paths can render after an authorized refresh without a build. Collection GET filters use blocking server rendering so native navigation remains usable. Direct GitHub edits require an authorized refresh; manually added or deleted project files also require the matching project-index update because refresh only invalidates caches. There is no webhook or scheduled refresh. Content commits never call a deploy hook or Vercel deployment API. `images.unoptimized: true` still serves original GitHub assets; the CMS does not enable image transformations.

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
