# Portfolio agent handoff

Updated **24 October 2026 (Asia/Jakarta)**. Continue from `dev`, where rework PR #2 has been merged; CMS PR #3 targets `dev`. Check live repository and remote state before relying on these notes.

## Repository and branch

- Repository: https://github.com/ervin-sungkono/Portfolio-Website-v2.
- The CMS implementation is under review in [PR #3](https://github.com/ervin-sungkono/Portfolio-Website-v2/pull/3), targeting `dev`.
- Start feature work from the selected branch, not the legacy `main` implementation. Check `git status`, the active branch, and remote head before editing; preserve unrelated work.
- Dated verification is historical evidence, not a fresh result. New explicit user instructions take precedence over these project defaults.

## Read first and maintain documentation

Read `README.md` and `docs/architecture.md`, then the relevant sections of:

| Document                        | Owns                                                                                      |
| ------------------------------- | ----------------------------------------------------------------------------------------- |
| `docs/architecture.md`          | Application boundaries, content/provenance, SEO, contact, images, and release operations. |
| `docs/responsive-and-motion.md` | Visual system, responsive rules, accessibility, and current motion behavior.              |
| `docs/verification.md`          | Dated observations, check coverage, historical evidence, and remaining work.              |

Keep each topic in its owning document and link to it elsewhere. Update current guidance when behavior changes; retain only useful dated evidence and unresolved limitations. Replace completed proposals and superseded findings instead of adding parallel dated documents. Record the actual checks performed, their date, and their limits; do not turn old results into a fresh pass.

## Setup and checks

Use Node.js 24, npm, and the committed lockfile (`npm ci`). The package requires Node.js 22 or newer.

The checked-in content snapshots remain the default local source. To provision or run the CMS, follow [docs/cms.md](docs/cms.md); do not put credentials in source control or expose server-only variables through `NEXT_PUBLIC_*` names.

Available checks:

```sh
npm run typecheck
npm run lint:css
npm test
npm run build
npm run format:check
git diff --check
```

Application changes should pass relevant type, CSS lint, unit/browser, build, formatting, and whitespace checks. `npm run test:browser` covers contact/API boundaries, project 404 recovery, cursor behavior, and hero/parallax; it is not a complete responsive or accessibility suite. Follow README for the production build and dummy CAPTCHA key. CI is configured for Node.js 24; inspect its actual run before claiming it passed.

Documentation-only work needs formatting, local link/fragment validation, and whitespace checks. Scope checks to the changed files when unrelated work is present, and report that scope accurately.

## Architecture and maintenance

- Stack: Next.js 16.4.3 App Router, React 19.2, strict TypeScript, native CSS/CSS modules, Motion 14.0.0, PostgreSQL, Drizzle ORM, Better Auth 1.7, and Vercel Blob private storage. Read installed Next.js documentation before using its APIs. Avoid unrelated framework or dependency upgrades.
- Follow KISS, DRY, and YAGNI. Prefer small readable functions and existing boundaries; add dependencies or abstractions only when the task needs them.
- `src/app` owns public/admin routes, layouts, metadata, and API handlers. Prefer Server Components for pages and content; keep browser interaction in focused client islands.
- `src/components` owns reusable UI and motion. `src/styles/globals.css` owns shared theme, spacing, typography, and responsive tokens; CSS modules own local styles.
- `src/content` owns typed profile/engineering content and project/design JSON. Access collections through `src/lib/content.ts`; do not scatter duplicate content lookups.
- `src/lib/metadata.ts` owns the public origin and shared SEO helpers. `src/lib/contact` owns shared validation and server-only provider integration. `src/lib/cms` owns server-only CMS auth, storage, revisions, publishing, caching, and private media delivery.
- PostgreSQL access uses separate `portfolio_public`, `portfolio_cms`, and `portfolio_auth` runtime roles; offline migrations and owner bootstrap use a separate migration principal. Keep direct migration URLs out of runtime configuration and preserve the migration SQL's least-privilege grants.
- The public content boundary defaults to static snapshots. Database mode reads only the published projection and must fail closed when configured database access fails; do not add a snapshot fallback to database mode.
- Project detail pages resolve on request in both source modes and use the published-projection cache in database mode. Keep `generateStaticParams` out of this route. `src/proxy.ts` checks slugs before rendering: static mode uses the snapshot slug set; database mode makes one fresh parameterized query with `portfolio_public` per detail navigation. Missing slugs rewrite to the dedicated request-time `/project-not-found` recovery page with HTTP 404, `noindex`, and `no-store`; this prevents a cached generated 404 from hiding a newly published project. A failed database query returns 503 without snapshot fallback. Do not replace this with a dynamic `notFound()` boundary alone, which leaves Flight-only recovery without JavaScript.
- Preserve existing routes, project slugs, assets, CV/social/source links, and team credits. Collections use server-rendered GET filters. Unknown project slugs return 404/noindex.
- Engineering source links use `portfolioSourceRef` in `src/content/engineering.ts`. Keep it pointed at `dev` while CMS PR #3 is under review; update it after that PR merges.

## Identity, SEO, and scope

- The owner's full name is **Ervin Cahyadinata Sungkono**. `profile.name` in `src/content/profile.ts` is authoritative. Use the full name in visible identity text, accessible alternatives, page titles/descriptions, social metadata, and structured data; do not reintroduce the shortened alias.
- The public origin is **https://ervincs.com**, defined in `src/lib/metadata.ts`. Preview hostnames must not enter canonical URLs, sitemap, robots, or structured data. A `SITE_URL` variable does not control the current origin.
- Preserve distinct route descriptions and matching social metadata. Filtered collection URLs canonicalize to the unfiltered collection. Structured data must match visible, verified facts; serialize it safely.
- Write natural, specific descriptions of the owner's actual work. Do not promise search rankings, stuff keywords, invent metrics, or claim unverified seniority or personal team contributions.
- Professional portfolio content improvements remain deferred. Do not invent or expand facts, achievements, metrics, or responsibilities as part of CMS work.
- The CMS feature under review in PR #3 targets `dev`. Keep its scope to existing project, design, and profile records, the authenticated `/admin` editor, revision history, publication, and private media. Do not add public signup, OAuth, new content categories, imports, or unrelated CMS layers.
- Authentication uses Better Auth password login plus verified TOTP and backup codes. Public signup is disabled; owner creation is an offline one-time bootstrap. Publishing and unpublishing require a password-and-factor session created within the previous 30 minutes.
- Drafts and immutable revisions are separate from the public projection. Use optimistic revision checks; keep each publication's public projection, audit record, and cache outbox event in one database transaction.
- CMS media must stay in one private Blob store under `BLOB_PRIVATE_READ_WRITE_TOKEN`. Accept only normalized PNG/JPEG/WebP up to 5 MiB and 16 megapixels. Public URLs go through `/media/published/{id}/{sha256}` and require a matching SQL published-media row; private preview images are `no-store` and unoptimized. Published registry rows are retained after content is unpublished; one-year immutable URLs and browser/CDN copies cannot be recalled. Never introduce a public Blob store/token.
- Partition public-content cache scope by database host, port, name, runtime role, validated `options=endpoint=...` routing value, deployment/CMS environment, and preview branch. Keep preview and production data/cache scopes distinct; reject unexpected database URL parameters.

## Responsive behavior, motion, and accessibility

- Follow documented rem tokens, fluid sizing, and content-fit thresholds. Check full-name branding, typography, grids, spacing, and controls during text enlargement/reflow; avoid arbitrary device overrides.
- Preserve native scrolling. The desktop hero uses a stationary project crossfade; selected images use bounded parallax. Do not restore section snapping or intercept wheel events. The second hero image remains an explicit placeholder until supplied.
- Decorative motion respects reduced motion. Pinning/parallax falls back to ordinary flow for mobile/coarse pointers, short viewports, or content that cannot fit. Server-rendered content stays visible without JavaScript.
- The cursor is desktop fine-pointer/hover only, decorative, and hidden from assistive technology. Its position uses direct Motion values without springs or delay. Native cursor fallbacks must work; image-tilt springs are separate.
- Keep continuous pointer/scroll updates out of React state. Clean up listeners, media subscriptions, observers, animation frames, and engines.
- Preserve skip navigation, landmarks, heading order, keyboard access, visible focus, contrast, and accessible names including visible labels.
- Mobile navigation is a disclosure: toggle before links, Escape closes and returns focus, leaving the header closes it, and short viewports can scroll all links into view. Do not introduce a modal focus trap.
- Keep `--control-border` separate from decorative borders. Theme labels describe the destination. Project actions identify their project and avoid redundant links. Forms retain labels, associated errors/live status, first-error focus, and drafts after failure.
- For UI changes, exercise keyboard navigation and both themes at 320, 390, 820, 1024, and 1440px, enlarged text/reflow, reduced motion, and relevant input/fallback contexts. Add focused browser/axe checks when relevant and report actual coverage.
- Historical automated results do not prove WCAG conformance. NVDA/VoiceOver, actual browser zoom, forced colors, and real-device checks remain outstanding; root-font enlargement is not browser zoom.

## Contact integration and release boundaries

- Real provider configuration is only needed for integration testing. UI, unit tests, typechecking, and build can run without production credentials. Refer to `.env.example` for `EMAIL`, `EMAIL_PASS`, `NEXT_PUBLIC_RECAPTCHA_KEY`, and `RECAPTCHA_SECRET`; the legacy server alias `RECAPTCHA_KEY` is supported.
- Never print or commit secrets. Keep provider code server-only and preserve validation/abuse checks and graceful failure with a LinkedIn fallback.
- Do not send real email during automated tests. Live delivery testing requires an explicit user request and verified reCAPTCHA hostname/provider configuration. Gmail receipt remains unverified.
- The current review scope is CMS PR #3 and preview. Neon and Blob are not provisioned for hosted release. Do not merge, promote production, change DNS/domain settings, or modify production secrets unless the user authorizes that action.
- Before deployment work, verify the actual Vercel project/team, branch, commit, runtime, and target. The legacy production configuration was Node.js 18; verify/update the production runtime for this migration before a future release.
- Report what changed, what was checked, and material limitations. Update relevant documentation when behavior or architecture changes. Never imply that a preview proves production indexing, field Core Web Vitals, remote asset availability, or email delivery.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
