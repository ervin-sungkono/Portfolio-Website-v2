# Architecture and operations

This document owns code/content boundaries, metadata, CMS operation, contact integration, image delivery, and release limits. See [responsive and motion](responsive-and-motion.md) for UI behavior and [verification](verification.md) for check coverage and dated evidence.

## Code boundaries

| Area                     | Responsibility                                                                           |
| ------------------------ | ---------------------------------------------------------------------------------------- |
| `src/app`                | Routes, layouts, metadata, page composition, API handlers                                |
| `src/components`         | Reusable UI and focused browser interactions                                             |
| `src/styles/globals.css` | Shared theme tokens, typography, layout and accessibility primitives                     |
| `web-assets/content`     | Published profile, engineering walkthroughs, projects, selected Dribbble IDs             |
| `src/lib/content.ts`     | Public collections, lookups, filters, related-project selection                          |
| `src/lib/metadata.ts`    | Canonical public origin and shared metadata                                              |
| `src/lib/contact`        | Validation, bounded request parsing, server-only delivery                                |
| `src/lib/cms`            | CMS schemas, auth policy, GitHub repository operations, publication and cache boundaries |

The app uses Next.js 16.4 App Router, React 19, strict TypeScript, CSS/CSS Modules, Motion, Auth.js, Zod, React Hook Form, and Nodemailer. Shared UI belongs in `src/components/common`; route sections and admin UI stay scoped to their respective component directories. `Contact` groups shared message validation, formatting, and bounded body parsing; provider access remains in the server-only contact service. The CMS repository module owns project-index serialization and comparison. Use the installed Next.js docs before changing framework APIs.

## Request and publishing flows

- Public pages in `src/app` use `src/lib/content.ts`; the CMS public reader resolves and validates the GitHub content tree through `src/lib/cms/public.ts`, `repository.ts`, and `schemas.ts`.
- The owner editor and importer live in `src/components/admin`. `CmsDraftProvider` stores local drafts and media; `CmsEditor/useCmsDraftAutosave.ts` stages form changes into that draft.
- CMS requests enter `src/app/api/cms`, check the owner through `src/lib/cms/auth.ts`, and publish through `draft-finalization.ts`, `git-data.ts`, and `publishing.ts`. Cache invalidation follows a successful commit.
- A project page renders `ProjectHeader`, `ProjectGallery`, `ProjectStory`, and `RelatedProjects` directly. `src/proxy.ts` uses `/not-found` for complete project recovery HTML; `src/app/not-found.tsx` shares that view with the framework fallback.

Public pages are `/`, `/about`, `/project`, `/project/[slug]`, `/design`, and `/contact`. Server rendering supplies the content; client components handle navigation, forms, and motion. `src/proxy.ts` and `/api/content/project` preserve project not-found responses as complete 404/noindex/no-store documents, including without JavaScript. Do not replace this path with a rewrite that loses the HTTP status or recovery HTML.

The former `/engineering` URL permanently redirects to the engineering overview on the home page. On Vercel, the project proxy uses the platform-provided production domain for production checks and the deployment URL for previews. Protected previews require Vercel's automation bypass to be configured and its system environment variables exposed; internal requests reject redirects and never derive their destination from the incoming host header.

## Content and provenance

The content repository is separate from this application and is public. `profile.name` in `content/portfolio.json` is authoritative: **Ervin Cahyadinata Sungkono**. Preserve verified project facts, public slugs, assets, links, CV/social destinations, and team attribution. Professional content expansion remains deferred; do not infer roles, metrics, or outcomes.

The owner-maintained profile, skills, and project walkthroughs live in `content/portfolio.json`. The CMS manages homepage copy, projects, taxonomy, image references, and an ordered selection of Dribbble shot IDs. Design titles, links, and images are fetched from Dribbble. Application content reads go through `src/lib/content.ts`; there is no checked-in fallback. Directly adding or removing project documents also requires updating `content/project-index.json`; cache refresh does not rebuild that index.

The site document can select up to three published project slugs for the hero, in order; without a selection the hero uses the first three featured projects. Saving this optional field requires the updated reader to be deployed first, because older strict readers reject the additional field. Final submission validates the selection against the resulting published projects.

## GitHub CMS

The single-owner CMS uses GitHub OAuth for sign-in and a server-side GitHub PAT for owner identity and repository access. The PAT `/user` identity must match the OAuth identity. The encrypted session stores the GitHub user ID without copying the OAuth access token, and protected CMS requests compare that ID to the current PAT owner. A server-side Dribbble token supplies design details. Never use `NEXT_PUBLIC_` for secrets, expose provider tokens to browser code, or connect the content repository as the Vercel deployment source. The application has no database or separate backend.

Configure `.env.local` from `.env.example`:

| Variable                               | Use                                                           |
| -------------------------------------- | ------------------------------------------------------------- |
| `AUTH_SECRET`                          | Auth.js encrypted session secret                              |
| `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET` | GitHub OAuth app credentials                                  |
| `GITHUB_PAT`                           | Server-side owner identity and content repository access      |
| `GITHUB_REPO`                          | Separate public content repository name, without owner prefix |
| `DRIBBBLE_TOKEN`                       | Server-side Dribbble API access                               |

Use the callback `https://<deployment-host>/api/auth/callback/github`; local development uses `http://localhost:3000/api/auth/callback/github` and should have its own OAuth app. Grant only required repository access. Repository creation requires token permission to create repositories; otherwise initialize a compatible README-only repository. The PAT determines the owner and GitHub metadata determines the default branch.

`src/lib/cms/schemas.ts` defines strict documents. The repository contains `content/site.json`, `portfolio.json`, `categories.json`, `technologies.json`, `project-index.json`, and `projects/<slug>.json`; project media is under `media/projects/<slug>/`, optional technology icons under `media/technologies/`. The filename is the project URL identity. Version 2 projects use nullable unique `githubRepositoryId`; portfolio design selection stores IDs in order, not copied shot metadata.

After sign-in, **Initialize repository** is for a new or compatible repository only. It adds seed documents and index without replacing existing README content; incompatible or populated repositories stop rather than reset. A new repository needs a valid `content/portfolio.json` before public pages can render. Do not initialize over incompatible or asset-only content.

CMS forms and the GitHub import wizard save drafts and staged image bytes to this browser profile's Cache Storage. Drafts are not uploaded until **Submit draft**. **Delete draft** asks for confirmation before clearing unsubmitted changes. A secure context and Web Locks support are required; one `/admin` or `/admin/import` tab per origin may edit. Storage quota, eviction, or clearing site data can remove an unsubmitted draft. A conflict returns the current server value and retains the local draft for review. Confirmed submission validates the full draft and writes changed content, index updates, deletions, and staged media in one Git commit/branch update. All committed content is publicly readable, including `published: false` documents and history. Private-repository metadata or staged images become public when submitted.

Editor and importer synchronize form values against the loaded repository baseline, removing a staged document when its values are restored. A saved empty draft can be rebound to a different repository or branch; drafts containing changes or a pending public refresh are retained for explicit recovery.

The Images section loads the managed project and technology media catalog through the owner-only `/api/cms/media` endpoint. Deleting a committed image stages its file removal and removes references from the resulting project and technology drafts. When a deleted image is a project cover, the first gallery image is promoted; a project with no replacement cover must be edited before deletion. Final submission checks the image's recorded Git SHA, rejects any remaining references, and publishes the removal in the same commit as the content changes. The review shown before confirmation lists affected fields, projects, taxonomy, designs, and media. Deleting a file does not erase earlier public Git history.

Uploads accept PNG, JPEG, and WebP up to 1 MiB with matching MIME, extension, and byte signature; arbitrary SVG uploads are rejected. Media must be referenced by a project or technology before final submission. CMS commits do not deploy the app. Cache invalidation follows commit success; visitors may briefly see stale content while regeneration runs. **Retry public refresh** appears only when a successful commit leaves cache invalidation pending; it only retries cache invalidation and does not make another Git commit. Direct GitHub edits do not automatically invalidate caches, so public content may remain stale until regeneration or a subsequent CMS publication. Project additions and removals also require a matching `content/project-index.json` update.

The public reader resolves the configured repository at an immutable Git revision and validates JSON before caching. Selected Dribbble details are also cached on the server. Both can be fetched during prerendering and again after invalidation or a cache miss; the configuration does not guarantee provider calls occur only at build time. Runtime cache persistence depends on the hosting environment. There is no webhook or scheduled refresh. Dribbble API terms may limit retention of API responses; check the current terms before changing caching behavior.

## Identity and discovery

The public origin is `https://ervincs.com` in `src/lib/metadata.ts`; `SITE_URL` does not override it. Canonicals, Open Graph/Twitter URLs, sitemap, robots, and structured data use that origin. Filtered collection URLs canonicalize to the unfiltered collection. Structured data must match visible facts and serialize safely. These settings do not prove search indexing or ranking.

## Contact integration

`src/app/api/contact/route.ts` rejects foreign origins and non-JSON requests, caps streamed request bodies at 64 KiB, validates fields and honeypot, bounds CAPTCHA token length, and verifies reCAPTCHA v3 success, the `contact` action, request hostname, and a score of at least 0.5 before sending plain-text mail via Gmail. The standard badge is hidden on the contact page, with Google’s required reCAPTCHA branding and policy links kept visible in the form. Register a v3 site/secret pair for every hostname that serves the form; replace any previous v2 keys and use a separate key for testing environments. If provider configuration is absent, the API gives a LinkedIn fallback. `src/lib/contact` owns shared validation and server-only delivery. UI validation, field errors, first-error focus, status announcements, duplicate-submit protection, and failed-draft retention are part of the contract.

| Variable                    | Use                                                  |
| --------------------------- | ---------------------------------------------------- |
| `EMAIL`, `EMAIL_PASS`       | Gmail sender/recipient and app password; server-only |
| `NEXT_PUBLIC_RECAPTCHA_KEY` | Public reCAPTCHA v3 site key included at build time  |
| `RECAPTCHA_SECRET`          | Server-only reCAPTCHA v3 verification                |

Tests mock CAPTCHA and delivery. A provider acceptance response does not prove inbox receipt. Never send real mail in automated checks; live verification needs an explicit request and confirmed provider/domain setup.

## Image delivery

`next.config.ts` currently sets `images.unoptimized: true` as a temporary workaround. Next Image markup/dimensions remain, but remote images are served from their original sources without Next image transformations or generated responsive variants. Project screenshots use GitHub asset URLs, selected design artwork uses Dribbble URLs, and local static images use content-hashed paths. Browser fetches go directly to the remote hosts; current hosted transfer, availability, cache behavior, and Vercel usage have not been measured.

The config restricts local optimizer paths and widths and sets a 31-day minimum TTL. There is no configured remote optimizer allowlist while optimization is disabled. Before re-enabling it, configure and validate remote patterns, output, source selection, URL rejection, and hosted cache/usage. `src/lib/image-sizes.ts` documents layout slot hints; cropping/parallax behavior belongs to [responsive and motion](responsive-and-motion.md).

## Release boundaries

Preview and development work do not authorize merge, production promotion, DNS/domain changes, or production-secret changes. Before an authorized deployment, confirm the actual Vercel project/team, branch, commit, runtime, and target. Current production settings have not been inspected here. Production indexing, real email receipt, field performance, hosted image behavior, and third-party link currency need separate evidence.
