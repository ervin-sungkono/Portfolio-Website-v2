# Portfolio agent handoff

## Repository and branch

- Repository: https://github.com/ervin-sungkono/Portfolio-Website-v2.
- Current rework branch: `feat/portfolio-rework-phase-1`.
- Draft PR: https://github.com/ervin-sungkono/Portfolio-Website-v2/pull/2, targeting `main`.
- Start continuation work from the rework branch, not the legacy `main` implementation. Check `git status`, the active branch, and remote head before editing; preserve unrelated work.
- These instructions describe the handoff on 10 October 2026. Verify current Git/deployment state rather than treating dated verification as a fresh result. New explicit user instructions take precedence over these project defaults.

## Read first

Read `README.md`, `docs/architecture.md`, and the sections relevant to your task in `docs/responsive-and-motion.md`, `docs/verification.md`, and `docs/portfolio-audit-2026-10-09.md`. The latest remediation entry in the verification document supersedes the earlier audit findings it resolves.

## Setup and commands

Use Node.js 24 (the package requires Node.js 22 or later), npm, and the committed `package-lock.json`.

```sh
npm ci
npm run dev
```

For a hosted Codex environment, select the repository above and the rework branch for the task. Use `npm ci` as both setup and maintenance scripts so cached dependencies match the selected branch. No tools or files from an earlier scratch workspace are required.

Available checks:

```sh
npm run typecheck
npm test
npm run build
npm run format:check
git diff --check
```

Run checks appropriate to the change. Application changes should pass typechecking, relevant tests, build, formatting, and whitespace checks. Documentation-only changes need formatting and whitespace checks. There is no lint script. `npm test` currently runs five contact unit tests, not browser or accessibility tests.

## Architecture and maintenance

- Stack: Next.js 16.4.0 App Router, React 19.2, strict TypeScript, native CSS/CSS modules, and Motion 14.0.0. Read installed Next.js documentation before using its APIs. Avoid unrelated framework or dependency upgrades.
- Follow KISS, DRY, and YAGNI. Prefer small readable functions and existing boundaries; add dependencies or abstractions only when the task needs them.
- `src/app` owns routes, layouts, metadata, and API handlers. Prefer Server Components for pages and content; keep browser interaction in focused client islands.
- `src/components` owns reusable UI and motion. `src/styles/globals.css` owns shared theme, spacing, typography, and responsive tokens; CSS modules own local styles.
- `src/content` owns typed profile/engineering content and project/design JSON. Access collections through `src/lib/content.ts`; do not scatter duplicate content lookups.
- `src/lib/metadata.ts` owns the public origin and shared SEO helpers. `src/lib/contact` owns shared validation and server-only provider integration.
- Preserve existing routes, project slugs, assets, CV/social/source links, and team credits. Collections use server-rendered GET filters. Unknown project slugs return 404/noindex.
- Engineering source links use `portfolioSourceRef` in `src/content/engineering.ts`. Keep it pointed at the rework branch while under review; update it to `main` only after the implementation is merged.

## Identity, SEO, and content scope

- The owner's full name is **Ervin Cahyadinata Sungkono**. `profile.name` in `src/content/profile.ts` is authoritative. Use the full name in visible identity text, accessible alternatives, page titles/descriptions, social metadata, and structured data; do not reintroduce the shortened alias.
- The public origin is **https://ervincs.com**, defined in `src/lib/metadata.ts`. Preview hostnames must not enter canonical URLs, sitemap, robots, or structured data. A `SITE_URL` variable does not control the current origin.
- Preserve distinct route descriptions and matching social metadata. Filtered collection URLs canonicalize to the unfiltered collection. Structured data must match visible, verified facts; serialize it safely.
- Write natural, specific descriptions of the owner's actual work. Do not promise search rankings, stuff keywords, invent metrics, or claim unverified seniority or personal team contributions.
- Professional portfolio content improvements were deferred by the user on 9 October 2026. Do not expand them unless newly requested.
- CMS work is phase 2 and deferred. Do not add database, authentication, editor/admin UI, scheduled imports, or speculative CMS layers without a new request.

## Responsive behavior and motion

- Use the documented rem-based tokens, fluid sizing calculations, and content-fit breakpoints. Check typography, full-name logo/header, grids, spacing, and controls at phone/tablet widths, text enlargement, and reflow. Avoid accumulating arbitrary device-specific overrides.
- The requested scroll behavior is a desktop sticky hero with scroll-linked parallax. Preserve native scrolling; do not restore nearest-section scroll snapping or intercept wheel events.
- Disable decorative motion with reduced-motion preference. Pinning/parallax must fall back to normal flow for mobile/coarse pointers, short viewports, or content that cannot fit. Server-rendered content stays visible with JavaScript disabled.
- The decorative cursor is desktop fine-pointer/hover only and hidden from assistive technology. Pointer position uses direct Motion values with no delayed movement or position springs. Keep the native cursor usable. Image-tilt springs are separate from cursor position.
- Clean up event listeners, media subscriptions, and observers. Keep continuous pointer/scroll updates out of React application state.

## Accessibility requirements

- Preserve skip navigation, landmarks, heading hierarchy, keyboard access, visible focus, adequate contrast, and meaningful accessible names that include visible labels.
- The mobile navigation is a disclosure, not a modal: the toggle precedes its links in DOM and visual order; Escape closes it and returns focus to the toggle; leaving the header closes it. Short viewports must scroll all links into view without obscuring focused controls.
- Keep the dedicated `--control-border` contrast token separate from decorative borders. Theme toggle labels describe the destination action. Card actions identify their project and avoid redundant links.
- Preserve associated form labels, error descriptions/live status, first-error focus, and drafts after unsuccessful submissions.
- For UI changes, exercise keyboard navigation and both themes at representative widths (320, 390, 820, 1024, and 1440 px), enlarged text/reflow, and reduced motion. Add browser/axe checks when relevant; there is no committed Playwright/axe suite, so explain the tooling and coverage actually used.
- Historical automated checks are recorded in `docs/verification.md`; they do not establish full WCAG conformance. Manual NVDA/VoiceOver testing and actual browser zoom remain unverified. Do not label root-font enlargement as browser zoom.

## Contact integration and release boundaries

- Real provider configuration is only needed for integration testing. UI, unit tests, typechecking, and build can run without production credentials. Refer to `.env.example` for `EMAIL`, `EMAIL_PASS`, `NEXT_PUBLIC_RECAPTCHA_KEY`, and `RECAPTCHA_SECRET`; the legacy server alias `RECAPTCHA_KEY` is supported.
- Never print or commit secrets. Keep provider code server-only and preserve validation/abuse checks and graceful failure with a LinkedIn fallback.
- Do not send real email during automated tests. Live delivery testing requires an explicit user request and verified reCAPTCHA hostname/provider configuration. Gmail receipt remains unverified.
- The current release scope is the rework branch/draft PR and preview. Do not merge, promote production, change DNS/domain settings, or modify production secrets unless the user authorizes that action. Existing authorization for a task does not need repeated confirmation.
- Before deployment work, verify the actual Vercel project/team, branch, commit, runtime, and target. The legacy production configuration was Node.js 18; verify/update the production runtime for this migration before a future release.
- Report what changed, what was checked, and material limitations. Update relevant documentation when behavior or architecture changes. Never imply that a preview proves production indexing, field Core Web Vitals, remote asset availability, or email delivery.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
