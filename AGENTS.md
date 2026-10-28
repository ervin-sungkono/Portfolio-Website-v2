# Portfolio agent handoff

Updated **28 October 2026 (Asia/Jakarta)**. PR #5 (`codex/github-portfolio-cms` → `dev`) is the base for PR #6 (`codex/pr5-release-readiness` → `codex/github-portfolio-cms`), which remains draft/open. Blog work is in [PR #7](https://github.com/ervin-sungkono/Portfolio-Website-v2/pull/7), targeting PR #6. The mobile hero follow-up is on `codex/mobile-hero-crossfade`, based on `codex/portfolio-blog`. Inspect live repository and PR state before continuing.

## Repository and branch

- Repository: https://github.com/ervin-sungkono/Portfolio-Website-v2.
- Start ordinary public component work from `dev`. For the blog feature, continue from `codex/portfolio-blog` and target `codex/pr5-release-readiness` so the reviewed work can flow through PR #6 before its `dev` release. The GitHub-backed CMS is the current implementation; the earlier Neon proposal is historical. See [verification](docs/verification.md) for dated PR #5/6 evidence and the blog verification results and remaining hosted checks.
- Check Git status, active branch, and remote head before editing. Preserve unrelated or concurrent work. Components use the directory and nested CSS organization described in the architecture and responsive/motion references; don't mistake historical checks for validation of later edits.
- Existing explicit user instructions take precedence over project defaults. A dated document is not fresh Git, CI, deployment, or provider evidence.

## Read first and maintain documentation

Read `README.md` and `docs/architecture.md`, then the relevant sections of:

| Document                        | Owns                                                                                      |
| ------------------------------- | ----------------------------------------------------------------------------------------- |
| `docs/architecture.md`          | Application boundaries, content/provenance, SEO, contact, images, and release operations. |
| `docs/responsive-and-motion.md` | Visual system, responsive rules, accessibility, and current motion behavior.              |
| `docs/verification.md`          | Dated observations, check coverage, historical evidence, and remaining work.              |

Keep each topic in its owning document and link to it elsewhere. Update current guidance when behavior changes; retain only useful dated evidence and unresolved limitations. Replace completed proposals and superseded findings instead of adding parallel dated documents. Record the actual checks performed, their date, and their limits; do not turn old results into a fresh pass.

## Setup and checks

Use Node.js 24, npm, and the committed `package-lock.json`; the package requires Node.js 22 or later. Use `npm ci` for setup and maintenance, including hosted environments, then `npm run dev`.

```sh
npm run typecheck
npm run lint:css
npm test
npm run build
npm run format:check
git diff --check
```

Application changes should pass relevant type, CSS lint, unit/browser, build, formatting, and whitespace checks. `npm run test:browser` covers contact/API boundaries, project 404 recovery, cursor behavior, and hero/parallax. `npm run test:cms:browser` uses isolated GitHub storage and encrypted test sessions to verify publishing/ISR and editor behavior; rebuild normally afterward because it replaces `.next` with a fixture build. These are focused suites, not full accessibility conformance checks. Use Node.js 24 for the test loader and follow README for the dummy CAPTCHA key. Inspect actual CI runs before claiming a remote pass.

Documentation-only work needs formatting, local link/fragment validation, and whitespace checks. Scope checks to the changed files when unrelated work is present, and report that scope accurately.

## Architecture and maintenance

- Stack: Next.js 16.4.3 App Router, React 19.2, strict TypeScript, native CSS/CSS Modules, Motion 14, Auth.js 5 beta, Zod, and React Hook Form. Read installed Next.js documentation before using its APIs. Avoid unrelated framework/dependency upgrades.
- Follow KISS, DRY, and YAGNI. Prefer small functions and existing boundaries; add dependencies or abstractions only when the task needs them.
- `src/app` owns routes/layouts/metadata/API handlers. Prefer Server Components for pages/content and focused client islands for browser interaction.
- `src/components` uses PascalCase component directories with `index.tsx`, a colocated style file, and `type.ts` when types are needed. Put reusable public links, controls, cards, and motion wrappers in `src/components/common`. `src/styles/globals.css` owns shared tokens/primitives; pages retain CSS Modules.
- Use PascalCase for standalone React `.tsx`/`.jsx` filenames and component directories. Preserve established `index.tsx` directory entry points and framework-required route filenames such as `page.tsx`, `layout.tsx`, and `not-found.tsx`.
- `src/content` owns profile/engineering facts and project/design snapshots. Access project/design/blog collections through `src/lib/content.ts`; do not duplicate lookups. Blog posts are GitHub-only with no bundled samples; use the existing `PostsPanel` and optional `content/posts` collection. Shared motion eligibility lives in `src/lib/hooks/use-scroll-motion.ts`.
- `src/lib/metadata.ts` owns public metadata; `src/lib/contact` owns validation and server-only providers. Preserve routes, slugs, assets, CV/social/source links, team credits, GET filters, and unknown-project 404/noindex behavior.
- Preserve `portfolioSourceRef` in `src/content/engineering.ts` during public UI changes. Update source links in a separately reviewed change.
- `next.config.ts` currently sets `images.unoptimized: true` as a temporary workaround. Describe image delivery accordingly. Re-enabling transformations needs fresh validation; historical cache/source-selection results do not apply to current rendering.

## Identity, SEO, and scope

- The full name is **Ervin Cahyadinata Sungkono**; `profile.name` in `src/content/profile.ts` is authoritative. Use it in visible identity, accessible alternatives, metadata, and structured data.
- The public origin is **https://ervincs.com** in `src/lib/metadata.ts`. Preview hosts must not enter canonicals, sitemap, robots, or structured data. `SITE_URL` does not control the origin.
- Blog archive/article metadata and sitemap URLs use that canonical origin. Keep `published` as the visibility control and `publishedAt` as the editorial date/order; there is no scheduled publishing. Render Markdown with the existing `BlogBody` safe defaults (`skipHtml`), without raw-HTML plugins.
- Preserve distinct route descriptions and matching social metadata. Filtered URLs canonicalize to the unfiltered collection. Structured data must match visible verified facts and be serialized safely.
- Write specific, natural descriptions without invented metrics, seniority, personal team contributions, or ranking promises. Professional content expansion remains deferred until requested.
- The single-owner CMS uses GitHub OAuth and a separate public content repository, with shared schemas and server-only credential access. `src/lib/cms` owns auth/storage/publishing/cache boundaries; UI never calls GitHub directly. There is no explicit `server-only` npm dependency; Next.js resolves the marker. Do not add a database, separate backend, object-storage provider, multi-user roles, or speculative layers.
- `web-assets/master` contains the completed migration at `ce10d45`; `legacy` preserves the original `3a62ce0` tree. The hosted application cutover remains outstanding. Keep compatibility `images/` and `icons/` URLs through acceptance; do not rerun the removed converter. Refs and checks are in [verification](docs/verification.md); [LLM mapping instructions](docs/web-assets-migration-agent.md) describe future audits.
- Preserve the project/post response boundary in `src/proxy.ts`: Proxy uses the cached public reader via `/api/content/project` and `/api/content/post`; missing content returns complete 404/noindex/no-store HTML, while unavailable content returns 503 rather than a false 404. Keep the shared response helper and recovery UI. Replacing it with a runtime `notFound()` or PPR rewrite alone can regress JavaScript-disabled recovery. Internal origin comes from trusted platform configuration, not a request Host header.

## Responsive behavior, motion, and accessibility

- Follow documented rem tokens, fluid sizing, and content-fit thresholds. Check full-name branding, typography, grids, spacing, and controls during text enlargement/reflow; avoid arbitrary device overrides.
- Preserve native scrolling. The desktop hero uses a stationary project crossfade; selected images use bounded parallax. Do not restore section snapping or intercept wheel events. The second hero image remains an explicit placeholder until supplied.
- Decorative motion respects reduced motion. The hero has a preview-only mobile crossfade; its text scrolls normally. Short viewports or oversized previews fall back to ordinary flow. Shared card/artwork parallax remains desktop-only, including on touch devices. Server-rendered content stays visible without JavaScript.
- The cursor is desktop fine-pointer/hover only, decorative, and hidden from assistive technology. Its position uses direct Motion values without springs or delay. Native cursor fallbacks must work; image-tilt springs are separate.
- Keep continuous pointer/scroll updates out of React state. Clean up listeners, media subscriptions, observers, animation frames, and engines.
- Preserve skip navigation, landmarks, heading order, keyboard access, visible focus, contrast, and accessible names including visible labels.
- Mobile navigation is a disclosure: toggle before links, Escape closes and returns focus, leaving the header closes it, and short viewports can scroll all links into view. Do not introduce a modal focus trap.
- Keep `--control-border` separate from decorative borders. Theme labels describe the destination. Project actions identify their project and avoid redundant links. Forms retain labels, associated errors/live status, first-error focus, and drafts after failure.
- For UI changes, exercise keyboard navigation and both themes at 320, 390, 820, 1024, and 1440px, enlarged text/reflow, reduced motion, and relevant input/fallback contexts. Add focused browser/axe checks when relevant and report actual coverage.
- Historical automated results do not prove WCAG conformance. NVDA/VoiceOver, actual browser zoom, forced colors, and real-device checks remain outstanding; root-font enlargement is not browser zoom.

## Contact and release boundaries

- Production credentials are only needed for live integration. Use `.env.example` and the architecture reference. Never print or commit secrets, and keep provider code server-only.
- Preserve request validation, the 64 KiB streamed-body cap, abuse checks, duplicate-submission prevention, read-only pending fields, draft retention, and graceful LinkedIn fallback.
- Automated tests must not send real email. Live delivery requires an explicit user request and verified hostname/provider setup; Gmail receipt remains unverified.
- Current application release scope is development and preview. The owner separately authorized the `web-assets` master/legacy migration recorded in verification. Do not merge application changes, promote production, change DNS/domains, or modify production secrets without authorization.
- Follow the [hosted release checklist](docs/architecture.md#hosted-release-checklist) before deployment. Verify the actual Vercel project/team, branch, commit, runtime, and target. Node.js 18 was the historical legacy setting; inspect the current production runtime before release.
- Report changes, checks, and material limits. A preview does not prove production indexing, field Core Web Vitals, hosted image availability/cost, or real email receipt.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
