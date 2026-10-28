# Portfolio architecture and operations

Reviewed for the blog feature on **28 October 2026 (Asia/Jakarta)**. This document owns application boundaries, content, metadata, contact integration, and image delivery. [UI behavior](responsive-and-motion.md) owns presentation and interaction; [verification](verification.md) records dated evidence, repository status, and remaining checks.

## Scope and stack

The portfolio preserves verified project facts, artwork, CV, social links, and team credits through server-rendered pages, with an owner-authored Markdown blog. The stack is Next.js 16.4.3 App Router, React 19.2, strict TypeScript, native CSS, next-themes, Motion 14, Nodemailer 10.2, Auth.js 5 beta, Zod 4, React Hook Form, and React Markdown 10.1.0. Install with the committed lockfile using Node.js 24; the package requires Node.js 22 or newer, while the isolated test loader requires Node.js 24.

The owner-only GitHub CMS lives inside this Next.js application. A separate public repository stores JSON and modest images; there is no database, separate backend, or object-storage provider. The GitHub-backed CMS is the current implementation; the earlier Neon proposal is historical and is not part of this release. Professional content expansion remains deferred: do not infer new responsibilities, contributions, seniority, or measured outcomes from the implementation.

## Code boundaries

| Location                 | Responsibility                                                                        |
| ------------------------ | ------------------------------------------------------------------------------------- |
| `src/app`                | Routes, layouts, metadata endpoints, page composition, and the contact API.           |
| `src/components`         | Reusable UI and focused browser interactions.                                         |
| `src/styles/globals.css` | Shared theme, typography, spacing, layout utilities, and accessibility primitives.    |
| `src/content`            | Profile facts, engineering walkthroughs, projects, and design snapshots.              |
| `src/lib/content.ts`     | Project and blog collection access, lookup, filtering, and related-project selection. |
| `src/lib/metadata.ts`    | Public origin and shared page/social metadata.                                        |
| `src/lib/contact`        | Shared validation, bounded request parsing, and server-only provider integration.     |
| `src/lib/image-sizes.ts` | Layout-specific image slot hints.                                                     |

Components use PascalCase directories with `index.tsx`, a colocated style file, and `type.ts` when needed. Reusable public links, controls, cards, and motion wrappers live in `src/components/common`; page-specific components remain in their existing directories. The shared scroll hook is at `src/lib/motion/use-scroll-motion.ts`. Component styles use prefixed selectors and native nesting, while page styles remain CSS Modules. See [verification](verification.md) for dated check coverage and its limits.

Pages and content stay in Server Components. Header navigation, contact submission, and decorative motion use small Client Components. Server-rendered content passes into motion wrappers and remains visible without JavaScript. Continuous pointer and scroll coordinates use Motion values rather than React state on each frame. Media subscriptions, observers, event listeners, and animation frames clean up when their scope ends.

Keep functions and boundaries small. Add abstractions or dependencies only when the requested behavior needs them. Read the relevant installed Next.js guide in `node_modules/next/dist/docs/` before changing framework APIs.

## Routes and collections

Public pages are `/`, `/about`, `/project`, `/project/[slug]`, `/design`, `/contact`, `/blog`, and `/blog/[slug]`. The snapshot includes 17 project detail pages and 16 design entries; the blog routes serve only published CMS posts.

- Project search/category filters and design categories use shareable GET URLs with server rendering.
- Snapshot mode features the first three projects in snapshot order. GitHub mode uses explicit `featured` flags and sorts projects by `sortOrder`, then stable slug; unfiltered archives exclude featured entries. Filtering searches the complete published collection.
- GitHub category filters include labels referenced by published projects only. They sort by category `sortOrder`, then stable category ID, and deduplicate repeated labels after sorting. Snapshot category filters preserve first appearance in project order.
- Project details can render newly published slugs after deployment. Their content is cached and invalidated after publication. Unknown/unpublished slugs use 404/noindex recovery; the current checks and any no-JavaScript limits are recorded in [verification](verification.md).
- The blog archive and detail pages read published posts through the same cached public catalog. Posts sort by `publishedAt` descending, then slug ascending; a post's `published` flag controls visibility, while its date is editorial and does not schedule publication. With no published posts, the archive shows an empty state.
- Related projects prioritize shared technologies, then category, through a small pure function.
  Preserve public slugs, destinations, assets, and attribution during maintenance. Framework route filenames retain their required names.

## Content and provenance

`profile.name` in `src/content/profile.ts` is authoritative: **Ervin Cahyadinata Sungkono**. Use the full name in visible identity, accessible alternatives, metadata, and structured data. Existing account URLs remain unchanged.

Edit profile facts in `profile.ts`, collection entries in `projects.json` and `designs.json`, and walkthroughs/capability links in `engineering.ts`. Access projects, designs, and blog posts through their existing public content boundaries. The homepage selects the first three projects, so ordering is editorial. WeTrack, ChatGPT Clone, and Next Pokedex have walkthroughs with documented features, tradeoff analysis, original sources, and explicitly proposed validation steps. WeTrack's team credits remain visible.

The inherited content was reviewed on **7 October 2026**; the documentation date does not refresh those external facts:

| Material                                             | Source and limit                                                                                                                                                |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Original routes, assets, and integration conventions | [Legacy portfolio](https://github.com/ervin-sungkono/Portfolio-Website-v2/tree/6a2c71db6627ee06648a642c64d9c7ac426dfc8f).                                       |
| Project descriptions, URLs, and topics               | Owner's public GitHub repository metadata. WeTrack and ChatGPT Clone notes use their READMEs; Next Pokedex's rendering summary uses its repository description. |
| Screenshots and technology icons                     | Owner's [web-assets repository](https://github.com/ervin-sungkono/web-assets).                                                                                  |
| Design titles and artwork                            | [ErvinCS on Dribbble](https://dribbble.com/ErvinCS) and linked shots.                                                                                           |
| Experience and education                             | The owner's public [LinkedIn profile](https://www.linkedin.com/in/ervin-cahyadinata-sungkono), recorded in `profile.ts`; it is not polled at runtime.           |
| CV                                                   | Original link retained; its currency has not been independently verified.                                                                                       |

`src/lib/content.ts` is the public content boundary in both modes. GitHub configuration replaces project and published-post reads and homepage copy; project/design snapshots, artwork, verified identity/experience, CV, and engineering/team-credit content remain in the application. There are no bundled sample posts. An unset GitHub source yields an empty blog; invalid or unavailable configured storage is never silently replaced with snapshots.

## GitHub CMS

### Setup and source separation

Configure these server-only variables from `.env.example` in local `.env.local` or the intended Vercel environment:

| Variable             | Purpose                                                                          |
| -------------------- | -------------------------------------------------------------------------------- |
| `AUTH_SECRET`        | Random secret for Auth.js encrypted sessions; use at least 32 random characters. |
| `AUTH_GITHUB_ID`     | GitHub OAuth application's client ID.                                            |
| `AUTH_GITHUB_SECRET` | GitHub OAuth application's client secret.                                        |
| `GITHUB_ADMIN_ID`    | Owner's immutable numeric GitHub user ID.                                        |
| `GITHUB_REPO`        | Separate public content repository name, without an owner or slash.              |

Create an OAuth application with callback `https://<deployment-host>/api/auth/callback/github`; for local development use `http://localhost:3000/api/auth/callback/github` with a separate development OAuth app. The provider requests `read:user repo`. The `repo` permission is broad; application writes are constrained to the configured repository and allowlisted paths. Never expose these variables through `NEXT_PUBLIC_`, browser storage, URLs, or logs. Public readers resolve the current owner login from GitHub's numeric-ID endpoint without any OAuth token.

Do not connect the content repository as a Vercel deployment source. Only application source changes need builds. A template installer supplies their own OAuth app, numeric ID, repository name, and Auth secret; no repository picker, database, or extra read token is required. GitHub configuration does not change the canonical public origin `https://ervincs.com`.

Opening `/admin` shows setup or GitHub sign-in. Sign-in accepts only the configured GitHub account ID. Auth.js keeps its OAuth access token in an encrypted HttpOnly, SameSite cookie; client session JSON exposes only the allowlisted identity fields. Every CMS mutation checks that encrypted owner session and verifies the token's current identity with GitHub again. Expired/revoked credentials require another sign-in. Auth/admin responses and CMS APIs do not expose the access token. Next.js resolves the `server-only` build marker itself; there is no `server-only` npm dependency.

### Modules and storage

- `src/lib/cms/schemas.ts`: shared strict Zod documents and mutations, used by React Hook Form and server validation.
- `github.ts`, `repository.ts`: bounded GitHub access, numeric owner/default-branch resolution, typed files, reads, media/reference validation, and custom-identity commits.
- `service.ts`, `media.ts`: initialization, optimistic JSON publishing/deletion, and immutable image uploads.
- `auth.ts`, `auth-policy.ts`, `http.ts`: trusted credential retrieval, owner policy, same-origin mutations, bounded JSON requests, and private responses.
- `public.ts`, `cache.ts`, `cache-policy.ts`, `publishing.ts`: public cached projection, invalidation, and separation of commit success from cache failures.
- `src/components/CmsEditor`: structured project, blog post, site-profile, category, technology, and image forms; no GitHub API calls or credentials in components. Each panel and `CmsMessage` has a nested PascalCase directory with `index.tsx`, `type.ts`, and component-specific `style.css`. The editor's own `style.css` keeps shared form primitives, avoiding duplicated control styles.
- `src/proxy.ts` and `/api/content/project`, `/api/content/post`: publication checks before project/post rendering, using the same cached public content boundary and shared existence-response helper. Missing content returns a buffered recovery document with HTTP 404/noindex/no-store; unavailable content returns HTTP 503/no-store instead of a false 404. This avoids Next.js PPR's blank no-JavaScript recovery and status replacement during rewrites. Internal requests use the platform's `VERCEL_URL` or local `127.0.0.1:PORT` (default 3000), never a visitor-supplied Host. Set `PORT` when running the app locally on another port.

Storage uses `content/site.json`, `content/categories.json`, `content/technologies.json`, `content/projects/<slug>.json`, and optional `content/posts/<slug>.json`. The filename is the URL identity; project/post JSON has no duplicate ID/slug. Registries use stable IDs, projects refer to those IDs, and images use repository-relative paths under `media/projects/<slug>/` or `media/technologies/`. No project index is committed. Public routes remain `/project/<slug>` and `/blog/<slug>`.

### Blog posts

Posts use the existing `CmsEditor` orchestrator, shared snapshot reader, and `/api/cms` mutation boundary. The `PostsPanel` creates, edits, publishes/unpublishes, and deletes posts with the same owner-session, expected-SHA, custom author/committer, commit-before-invalidation, draft-retention, and cache-retry behavior as other CMS sections.

The optional `content/posts/` directory may be absent; the reader then returns an empty post list. Existing repositories need no new initialization or migration. Each filename supplies a permanent lowercase slug of at most 100 characters. Its strict `PostDocument` schema version 1 contains title (120 characters), summary (240), Markdown `body` (30,000), `published` boolean, and ISO calendar date `publishedAt`. Body whitespace is preserved for Markdown indentation; blank bodies are rejected. Only `published: true` posts appear publicly. The date controls display and descending order (slug ascending breaks ties); it does not schedule publication. There are no bundled sample posts.

`getBlogPosts()` and `findBlogPost()` in `src/lib/content.ts` expose the published, slug-stable projection from the existing cached catalog; no OAuth token enters the public cache. Article metadata uses the title, summary, canonical `/blog/<slug>`, author, and publication date. `src/app/sitemap.ts` includes `/blog` and published post URLs under `https://ervincs.com`.

Post bodies render through `react-markdown` with `skipHtml`; there is no raw-HTML plugin, unsafe URL transform, or rich-text editor. The page maps Markdown `h1` to `h2` beneath its article `h1`. Blog posts have no media-upload flow, search, taxonomy, comments, RSS, or autosave. The shared CMS JSON reader allows up to 196,608 bytes for the 30,000-character Markdown payload; this does not change the contact API's 64 KiB limit or CMS image-upload limit.

### Initialization and editing

After authorized sign-in, choose **Initialize repository** only for a nonexistent or empty public repository, or to reuse a compatible CMS repository. Public requests and builds never initialize storage. The initializer creates a public repository if needed, reads its actual default branch, and writes README plus the three seed documents. Each Contents API commit sets both author and committer to `Portfolio CMS <cms@portfolio.local>`, including bootstrap. Keep that email unassociated with the owner's GitHub account; GitHub may still show the authenticated account as the API actor. Retries inspect existing content and only complete an exact known seed subset. Private, legacy `web-assets`, unrelated populated, and incompatible repositories stop with an actionable error; nothing is erased or reset.

The editor retains drafts after validation, network, or SHA conflicts. Every update compares the loaded file's blob SHA; a stale version returns HTTP 409 and preserves the unsaved draft. Explicit conflict reload refreshes only the selected section and discards that section's local draft. Category/technology edits validate references against the current snapshot. Publish/unpublish/delete validate authoritative documents and media before writing. Separate file commits are not a repository-wide transaction: keep one publishing tab for taxonomy work, and sequence category and project changes because a category deletion racing with a project update can still require manual Git repair. All content is public in GitHub, including `published: false` and earlier revisions; unpublishing only hides it from the portfolio.

Images accept PNG, JPEG, and WebP only, at most 1 MiB, with matching MIME, extension, and byte signatures. Arbitrary SVG uploads are rejected. Existing technology SVG references are checked. Uploads use content-hashed names, then the owner selects the returned path in the project/icon form. Upload and JSON commits are separate; an abandoned upload may leave an unused public file. Git history and existing browser/CDN copies cannot be made private by unpublishing.

### Publishing and ISR

Next.js Cache Components uses `cacheLife({ stale: 300, revalidate: 3600, expire: 86400 })` for the validated public catalog, including site, taxonomy, projects, and posts. These cache-profile values do not promise a hosted propagation time. The small portfolio shares one catalog loader rather than fetching each item per visitor; individual project and post lookups also carry `project:<slug>` or `post:<slug>` tags. Cache keys include the configured numeric ID/repository and never session credentials. Owner lookup is cached for one day. Authenticated editor reads bypass the public content cache. Unauthenticated REST limits still apply on cold reads; an upstream failure during background refresh can retain the prior good cached result, while an expired/cold cache can fail visibly.

Only after GitHub confirms a content commit does the API invalidate `projects`, `project:<slug>`, `posts`, `post:<slug>`, `site`, or `taxonomy` and the affected `/`, `/project`, detail, `/blog`, post, and sitemap paths. `revalidateTag(tag, 'max')` marks data stale; visitors may briefly receive the previous version while regeneration runs. “Cache refreshed” in the editor means invalidation was accepted, not instant global delivery. If invalidation fails after a commit, the saved result and commit link are retained with a **Retry public refresh** operation that does not write another Git commit.

`partialPrefetching` is explicitly disabled while migrating the existing portfolio to Cache Components. Project and blog detail routes render on request with cached content; collection GET filters use blocking server rendering so native navigation remains usable. There is no build-time slug allowlist. Public regression checks own the compatibility evidence. Direct GitHub edits appear after cache expiry or an authorized refresh, not via a webhook. Content commits never call a deploy hook or Vercel deployment API. `images.unoptimized: true` still serves original hashed GitHub assets; the CMS does not enable image transformations.

### Legacy content mapping and rollback

Use [the LLM mapping instructions](web-assets-migration-agent.md) to audit old content against the shared schemas. The prior one-off conversion utility was removed after the authorized migration; no ongoing runtime behavior depends on it. The instructions treat `web-assets/legacy` as read-only source, compare it with the already migrated `master`, and require a mapping report before edits. No executable converter is maintained.

The one-time content migration is complete: `web-assets/master` points to `ce10d45` (parent `3a62ce0`), and `legacy` preserves the original tree at `3a62ce0`. The hosted application cutover remains outstanding. Keep the compatibility `images/` and `icons/` directories through cutover. Do not rerun the removed conversion utility; later content work uses the CMS editor or a separately reviewed mapping. [Verification](verification.md#authorized-web-assets-publication) records exact refs, author/committer, schema/media read-back, and rollback limits.

Before a hosted cutover, capture the current deployment identity, application commit, content repository and branch heads, the `master` migration commit, `legacy` head, compatibility paths, and the current environment-variable names and targets (never their secret values). Roll back an application release through the known-good Vercel deployment and its matching configuration. Roll back content with a reviewed change on the actual current content branch that preserves later publications; do not blindly reset `master` or point the CMS reader at the historical `legacy` tree. Keep `legacy` intact until the cutover has been accepted.

## Identity and discovery

The public origin is **https://ervincs.com**, defined in `src/lib/metadata.ts`. A `SITE_URL` environment variable does not control it. Canonicals, social URLs, sitemap, robots, and structured data must use this origin in both local and preview builds.

Routes have distinct descriptions and matching Open Graph/Twitter metadata. Filtered collection URLs canonicalize to the unfiltered collection. About renders ProfilePage/Person structured data using visible profile facts; serialization escapes `<`. Project shares use the project's title and screenshot. Blog articles use their title, summary, author, publication date, and canonical slug in article metadata. These are discovery foundations, without a promise of indexing or search rank.

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

### Current behavior on 25 October

`next.config.ts` sets **`images.unoptimized: true`** as a temporary workaround. Next Image remains responsible for component markup and dimensions, but normal image rendering currently serves original sources without Next's image transformations or generated responsive variants. The existing `sizes` hints and optimizer settings must not be described as active transformation or cache savings.

Project screenshots use the original GitHub asset URLs; design artwork retains its Dribbble URLs and queries. Local avatar, organization, and header images use static imports with content-hashed paths. Explicit SVG/GIF and small-header-image bypasses remain. Original files in `public/images` also support existing references and metadata.

With transformation bypassed, browser requests to remote originals are governed by those hosts. The configured optimizer allowlist does not restrict direct browser fetching. Current hosted image loading, transfer size, Vercel usage, and billing have not been measured in this review.

### Retained optimizer configuration

These settings remain for a future reactivation; the 10 October optimizer results in [verification](verification.md) are historical:

- Remote patterns derive from all project/design image entries and constrain exact protocol, host, port, path, and query. Dribbble keeps its existing `?resize=1200x0`; unrelated paths/queries are excluded from optimizer requests. Local patterns allow query-free `/_next/static/media/**` paths.
- Allowed widths are 96, 192, 320, 480, 640, 768, 960, 1200, 1600, and 1920 pixels, with quality 75 and WebP output. The 1920 candidate accommodates original screenshots up to 1909px wide.
- Minimum remote cache TTL is **2,678,400 seconds (31 days)**. When optimization is enabled, a longer upstream lifetime can take precedence. Changed remote artwork should receive a new filename/URL; arbitrary cache-busting queries are not allowed by the patterns.
- `src/lib/image-sizes.ts` describes actual slots in the 75rem container, including collection columns, featured cards, homepage compositions, hero, and artwork. Update hints when those layouts change.

Re-enabling optimization needs a focused change and fresh checks of source selection at 1×/2× density, exact URL rejection, output, image coverage, and hosted cache/usage. Old local results or a redeploy do not prove current hosted delivery or savings. Image cropping, tilt, and parallax remain presentation concerns described in [UI behavior](responsive-and-motion.md).

## Hosted release checklist

These are required acceptance steps, not claims that hosted work has been completed. Hosted OAuth, publishing, cache, and application cutover checks remain pending; see [verification](verification.md#remaining-work).

### Isolated preview setup

- [ ] Use the existing `ervin-sungkono` Vercel project and its intended preview host, after confirming the deployment target. Keep contact delivery disabled and leave email/provider secrets unset. Do not create another Vercel project or content repository, and do not connect the content repository as a deployment source.
- [ ] Use the existing GitHub OAuth app if its callback is configured for the preview host, or a separate development OAuth app. The callback must be `https://<preview-host>/api/auth/callback/github`. Set the five CMS server variables for that preview only: `AUTH_SECRET`, `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`, `GITHUB_ADMIN_ID`, and `GITHUB_REPO`. Use a unique random Auth secret; keep values out of logs and reports.
- [ ] Reuse the existing public `web-assets` repository and its migrated CMS documents on `master`; do not initialize or rerun conversion. Confirm the preview uses Node.js 24 and is noindex. Record the starting application commit, actual CMS default branch and content commit, `master` and `legacy` heads, and the compatibility `images/` and `icons/` paths. Use one publishing tab.

### OAuth, editing, and cache behavior

- [ ] Sign in as the configured owner, sign out, and sign in again. Confirm unauthenticated reads/writes are rejected, wrong-owner access is rejected, session JSON contains no OAuth token, and admin/API responses are private and no-store.
- [ ] Confirm the existing repository points to the expected default branch and that CMS commits record the configured custom author and committer. Add a uniquely named `cms-release-check-<utc-timestamp>` project with an existing taxonomy entry and a harmless uploaded image in the existing repository. These public test commits remain in Git history after the project is unpublished/deleted; record their commit and test slug.
- [ ] Visit missing project and blog-post URLs, then use `/admin` to publish a project and post. Confirm each detail page, archive, and sitemap update without a deployment; confirm each prior 404 recovers with JavaScript disabled. For the project, confirm uploaded media loads from its original host. Check both the preview hostname and its Vercel alias, including the internal content-request origin.
- [ ] Record the content commit time, cache-invalidation result, and when each public route first shows the update. Invalidation marks cached data stale; it does not promise instant global delivery. The cache profile uses `stale: 300`, `revalidate: 3600`, and `expire: 86400`; these are cache parameters, not a hosted propagation SLA. Do not infer one from a single request.
- [ ] Unpublish and then delete the test project and blog post through the CMS. Record when each detail route returns 404/noindex and the sitemap drops it. Record any remaining public project-media path as an orphan; deleting a post has no media cleanup, and unpublish/delete do not erase repository history.
- [ ] Check an unavailable-upstream case using test fixtures only. Never inject failure into the hosted preview or production source. Confirm the application returns a temporary failure, not a false 404; a background refresh can retain a prior good result, while a cold/expired read can fail visibly.

### Public acceptance and production gate

- [ ] Validate the 17 expected project slugs, published blog posts and article metadata, shared CMS schemas, published references, every referenced media file, source/demo/CV links, and team credit. Review public pages in both themes with keyboard navigation at 320, 390, 820, 1024, and 1440px. Also check actual browser zoom, reduced motion, no JavaScript, Windows forced colors, and a screen reader; root-font enlargement is not browser zoom.
- [ ] Confirm public canonicals stay on `https://ervincs.com`, preview responses remain noindex, authenticated responses remain private/no-store, and hosted images still serve original unoptimized files. Record actual image transfer sizes. Do not send email or perform a live contact test.
- [ ] Before any separately authorized production promotion, verify the actual Vercel project/team, production domain and alias, Git branch/commit, Node.js runtime, and environment-variable targets. Build and smoke-test a fresh production-target candidate from the tested `dev` source with the intended production configuration. Never promote a CMS fixture build or a preview build.
- [ ] Capture the known-good production deployment, configuration targets, application commit, and content branch/commit before release. For application rollback, restore that deployment with its matching configuration. For content rollback, make a reviewed change on the actual current content branch that preserves later publications; do not reset a branch or discard `legacy`. Keep the `legacy` branch and compatibility paths until hosted cutover is accepted.
- [ ] Review the readiness follow-up against `codex/github-portfolio-cms`. Obtain passing CI for the resulting PR #5 merge candidate and complete hosted acceptance before preparing PR #5 for `dev`. After testing `dev`, prepare a release PR into the verified production branch and ensure untested changes cannot auto-promote. Merge and promotion require separate authorization.
- [ ] After a separately authorized production release, monitor runtime errors, GitHub rate limits, public cache behavior, and image delivery for 24 hours. Record observations; a preview does not establish these production outcomes.

## Release boundaries

Public component work targets `dev`; CMS work is reviewed separately from public UI changes. Preview work does not authorize merging, production promotion, DNS/domain changes, or production-secret changes. Before deployment, verify the actual Vercel project/team, branch, commit, runtime, and target. Node.js 18 was the historical legacy-production setting; the current production runtime has not been inspected in this pass and must be checked before release.

Production indexing, real Gmail receipt, field Core Web Vitals, external-link currency, and hosted image availability require their own evidence. See [remaining verification](verification.md#remaining-work) before making release claims.
