# Portfolio agent handoff

Updated **23 October 2026 (Asia/Jakarta)**. These instructions describe the rework and current documentation; inspect live repository state before continuing.

## Repository and branch

- Repository: https://github.com/ervin-sungkono/Portfolio-Website-v2.
- Continue from `feat/portfolio-rework-phase-1`. [PR #2](https://github.com/ervin-sungkono/Portfolio-Website-v2/pull/2) was confirmed open, draft, and targeting `main` on 23 October. The dated commit/remote snapshot is in `docs/verification.md`.
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

Application changes should pass relevant type, CSS lint, unit/browser, build, formatting, and whitespace checks. `npm run test:browser` covers contact/API boundaries, project 404 recovery, cursor behavior, and hero/parallax; it is not a complete responsive or accessibility suite. Follow README for the production build and dummy CAPTCHA key. CI is configured for Node.js 24; inspect its actual run before claiming it passed.

Documentation-only work needs formatting, local link/fragment validation, and whitespace checks. Scope checks to the changed files when unrelated work is present, and report that scope accurately.

## Architecture and maintenance

- Stack: Next.js 16.4.0 App Router, React 19.2, strict TypeScript, native CSS/CSS Modules, and Motion 14.0.0. Read installed Next.js documentation before using its APIs. Avoid unrelated framework/dependency upgrades.
- Follow KISS, DRY, and YAGNI. Prefer small functions and existing boundaries; add dependencies or abstractions only when the task needs them.
- `src/app` owns routes/layouts/metadata/API handlers. Prefer Server Components for pages/content and focused client islands for browser interaction.
- `src/components` owns reusable UI; `src/styles/globals.css` owns shared tokens/primitives. The current refactor colocates component `index.tsx`, `type.ts`, and prefixed/nested `style.css` in PascalCase directories; pages retain CSS Modules. Inspect and preserve this organization during related work.
- Use PascalCase for standalone React `.tsx`/`.jsx` filenames and component directories. Preserve established `index.tsx` directory entry points and framework-required route filenames such as `page.tsx`, `layout.tsx`, and `not-found.tsx`.
- `src/content` owns profile/engineering facts and JSON snapshots. Access project/design collections through `src/lib/content.ts`; do not duplicate lookups. Shared motion helpers currently live in `src/lib/motion`.
- `src/lib/metadata.ts` owns public metadata; `src/lib/contact` owns validation and server-only providers. Preserve routes, slugs, assets, CV/social/source links, team credits, GET filters, and unknown-project 404/noindex behavior.
- Keep `portfolioSourceRef` in `src/content/engineering.ts` on the rework branch while under review. Update it to `main` only after merge.
- `next.config.ts` currently sets `images.unoptimized: true` as a temporary workaround. Describe image delivery accordingly. Re-enabling transformations needs fresh validation; historical cache/source-selection results do not apply to current rendering.

## Identity, SEO, and scope

- The full name is **Ervin Cahyadinata Sungkono**; `profile.name` in `src/content/profile.ts` is authoritative. Use it in visible identity, accessible alternatives, metadata, and structured data.
- The public origin is **https://ervincs.com** in `src/lib/metadata.ts`. Preview hosts must not enter canonicals, sitemap, robots, or structured data. `SITE_URL` does not control the origin.
- Preserve distinct route descriptions and matching social metadata. Filtered URLs canonicalize to the unfiltered collection. Structured data must match visible verified facts and be serialized safely.
- Write specific, natural descriptions without invented metrics, seniority, personal team contributions, or ranking promises. Professional content expansion remains deferred until requested.
- CMS is deferred to phase 2. Do not add database/auth/admin UI, scheduled imports, or speculative CMS layers without a new request.

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

## Contact and release boundaries

- Production credentials are only needed for live integration. Use `.env.example` and the architecture reference; `RECAPTCHA_KEY` remains a supported legacy alias. Never print or commit secrets, and keep provider code server-only.
- Preserve request validation, the 64 KiB streamed-body cap, abuse checks, duplicate-submission prevention, read-only pending fields, draft retention, and graceful LinkedIn fallback.
- Automated tests must not send real email. Live delivery requires an explicit user request and verified hostname/provider setup; Gmail receipt remains unverified.
- Current release scope is the rework branch/draft PR and preview. Do not merge, promote production, change DNS/domains, or modify production secrets without authorization. Do not repeat requests for authorization already provided in the session.
- Before deployment, verify the actual Vercel project/team, branch, commit, runtime, and target. Node.js 18 was the historical legacy setting; inspect the current production runtime and ensure it supports this migration before release.
- Report changes, checks, and material limits. A preview does not prove production indexing, field Core Web Vitals, hosted image availability/cost, or real email receipt.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
