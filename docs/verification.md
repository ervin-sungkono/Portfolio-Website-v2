# Verification and remaining work

Documentation reconciled on **23 October 2026 (Asia/Jakarta)**. This document separates current repository observations from historical application checks. [Architecture](architecture.md) owns implementation/operations; [UI behavior](responsive-and-motion.md) owns presentation and interaction rules.

## Repository snapshot — 23 October 2026

- Local branch: `feat/portfolio-rework-phase-1`, at `112dcebc1a22f5d94fd592b829a155b8ba3c27cf`. A fresh remote-head read matched this commit.
- Remote `main`: `6a2c71db6627ee06648a642c64d9c7ac426dfc8f`.
- [PR #2](https://github.com/ervin-sungkono/Portfolio-Website-v2/pull/2) was read on this date: open, draft, unmerged, targeting `main`, with head `112dceb`.
- The 23 October working tree included the component-directory/CSS reorganization and related page/import changes, plus a temporary helper script. The reorganization was checked with typechecking, CSS lint, a production build, source-scoped formatting, and whitespace checks; these checks passed. The full formatting check still reports the pre-existing issue in unchanged `next.config.ts`. These checks do not replace browser, responsive, or accessibility coverage.
- `112dceb` disables image transformation globally with `images.unoptimized: true`. The former active-optimizer guidance and 10 October image results are no longer evidence of current delivery behavior.
- No current production-runtime, live-provider, Search Console, field-performance, or hosted image-usage inspection was performed. A source/PR read is not a deployment verification.

This pass read all seven previous `/docs` files and reconciled them into the three references above. Current behavior replaces the old design proposal and superseded findings. Useful dated audit/test evidence is retained below; obsolete prototype settings, repeated verification narratives, model/subagent logs, peer-site comparisons, and old live-site claims are removed. Earlier detail remains in Git history.

Only documentation checks apply to this pass: formatting of the three documents, README, and AGENTS; local Markdown file/fragment references; and whitespace checks on those files. Application builds, browser runs, audits, and provider tests are not rerun by a documentation cleanup. The historical results below must not be relabelled as fresh passes.

Documentation validation passed for all five edited Markdown files: Prettier, 22 local file/fragment references, and scoped Git whitespace checks. No repository references to the four removed document paths remained.

## Public component split — 25 October 2026

From refreshed `origin/dev` at `87ca9cd`, reusable public links, cards, motion wrappers, and the theme control were organized under `src/components/common`. This was checked locally with Node.js 22.14: `npm ci`, typecheck, CSS lint, all 11 unit tests, whole-repository formatting, a production build using the documented dummy CAPTCHA key, the 25 existing Chromium browser tests, one new theme persistence/navigation browser test, and `git diff --check`. The first build paused after route generation with Next.js's security upgrade notice; an unchanged retry passed. CI's Node.js 24 run and deployed behavior remain separate evidence.

The browser suite does not establish full responsive or accessibility coverage. Next.js 16.4.0 reported a known security vulnerability; a dependency upgrade belongs in a separate reviewed change.

## Repeatable checks

Use Node.js 24 and the committed lockfile. Setup and browser commands are in [README](../README.md#development).

| Command                | Scope                                                                                                                       |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`    | Strict application TypeScript. The application tsconfig excludes `tests`.                                                   |
| `npm run lint:css`     | Stylelint across `src/**/*.css`, using `stylelint.config.cjs`.                                                              |
| `npm test`             | 11 current unit tests: validation, boundaries, streamed JSON, plain-text formatting, and offline Nodemailer JSON transport. |
| `npm run build`        | Production build and static route generation.                                                                               |
| `npm run format:check` | Whole-repository Prettier; use scoped checks for documentation-only changes when unrelated work is present.                 |
| `git diff --check`     | Whitespace in the relevant diff.                                                                                            |
| `npm run test:browser` | 26 current Chromium regressions against a production build, not the dev server.                                             |

`.github/workflows/checks.yml` installs Node.js 24/dependencies and runs formatting, CSS lint, typechecking, unit tests, a dummy-CAPTCHA production build, Chromium installation, and browser tests on the configured main/rework push and PR events. This describes the workflow definition; inspect an actual run before claiming remote CI passed.

### Browser suite coverage

| Spec in `tests/browser`  | Cases | Coverage                                                                                                                                                                |
| ------------------------ | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `contact.spec.ts`        | 3     | Pending CAPTCHA/read-only fields, one submission snapshot, draft retention on failure, clearing on mocked success.                                                      |
| `contact-api.spec.ts`    | 2     | Permitted Unicode requests above the old cap, 64 KiB limit, origin, and honeypot checks.                                                                                |
| `project-routes.spec.ts` | 2     | Known project rendering and unknown-project 404/noindex recovery without JavaScript.                                                                                    |
| `cursor.spec.ts`         | 9     | Raw pointer/frame geometry, clearance and shape changes, rendered contrast, nested targets, reflow/removal, native fallbacks, reduced motion, touch, and no JavaScript. |
| `parallax.spec.ts`       | 9     | Hero crossfade/reverse scroll, fixed target geometry, travel/coverage, focus hold, reduced motion, coarse pointers, oversized/narrow/short contexts, and no JavaScript. |
| `theme.spec.ts`          | 1     | Theme destination label and persisted selection across public navigation.                                                                                               |

The browser server uses `127.0.0.1:3103`, clears provider secrets, and does not reuse an existing server. Form tests mock CAPTCHA/delivery; the offline Nodemailer test uses JSON transport. These tests do not send real email. The public dummy CAPTCHA key must be present at build time; rebuild with the real public key before any deployment that needs live CAPTCHA.

The suite is focused regression coverage. It is not a complete responsive, accessibility, particle, external-asset, or live-provider test suite. Broader checks below were separate dated reviews.

## Consolidated historical evidence

### Hero, selected-image parallax, and cursor — 18 October 2026

The recorded Node.js 24 checks passed production build, strict TypeScript, CSS lint, all 11 unit tests, changed-file formatting, and whitespace. The complete suite recorded **25 Chromium regressions passing**, including nine cursor and nine crossfade/parallax cases. Full-project formatting was limited by the temporary `next.config.ts` edit at that time; targeted passes did not establish a repository-wide pass.

Hero checks covered stationary link/caption/frame geometry, reversible crossfade, active/inert project switching, focus holding its project through motion-eligibility changes, and normal-flow fallbacks. Crop review retained ±1rem for the two compact supporting project images; the lead and one AudioWaves preview use ±1.5rem. The second hero image was still a placeholder and received no real-image crop review.

Cursor checks covered direct pointer placement, 32px idle reticle, 8px target clearance, plus-to-ring feedback, geometry tracking during scroll/reflow, removed targets, native text/disabled-control fallbacks, exit/return, reduced motion, touch, and no JavaScript. Rendered-pixel samples checked plus/corner visibility below the navbar in both themes with decorative canvas noise hidden. That contrast regression is not a WCAG conformance assessment.

Additional Home samples covered both themes at 320, 390, 820, 1024, and 1440px, plus 200% root-font enlargement. No horizontal document overflow or page runtime errors were recorded. Start/middle/end hero and parallax-limit screenshots were reviewed at 1024/1440px. The exact existing image bytes were served as browser fixtures for crop/layout checks; some cursor checks aborted images. These observations do not establish hosted delivery. Root-font enlargement was not actual browser zoom.

### Contact/API and project recovery — 11 October 2026

The recorded Node.js 24.19 checks passed production build, strict application/test checks, 11 unit tests, seven then-current browser/API regressions, CSS lint, formatting, and whitespace. The later cursor/parallax additions brought browser coverage to the 25 cases above.

Tests exercised read-only fields during CAPTCHA/delivery, a synchronous duplicate guard, draft retention/clearing, Unicode and six-byte escaped JSON payloads, the exact 64 KiB byte boundary, cancellation of oversized streams, origin/honeypot checks, and unconfigured-provider fallback. Known project pages returned 200; unknown project slugs returned 404/noindex and visible recovery without JavaScript. Offline Nodemailer output verified plain-text construction with no network transport. Gmail acceptance and receipt were not tested.

Additional About, Contact, and unknown-project checks covered both themes at the five representative widths and enlarged text, with one H1, no document overflow, and no runtime errors recorded. These results predate the current directory/CSS refactor.

### Accessibility, identity, and metadata — 9–10 October 2026

The 9 October audit findings were remediated in the rework. They are retained here as resolved historical findings rather than active defects:

| Original finding                             | Implemented remediation and recorded evidence                                                                                                               |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mobile menu obscured later keyboard focus    | Toggle precedes links; leaving the header closes the disclosure; Escape restores toggle focus. Forward/reverse Tab and short-menu scrolling were exercised. |
| Hero accessible name omitted visible caption | Visible caption supplies the link name.                                                                                                                     |
| Weak contact/search boundaries               | Dedicated control-border token; contact contrast measured about 4.09:1 light and 4.58:1 dark against the form at review.                                    |
| Theme action remained generic                | Button labels describe the destination theme; persistence checked.                                                                                          |
| Repeated generic project actions             | Redundant title/arrow links removed; walkthrough/source names include the project.                                                                          |

Follow-up axe-core checks reported zero automated violations on eight sampled routes in both themes using the recorded WCAG 2/2.1 A/AA and 2.2 AA tags. Keyboard, text-spacing, and 200% root-font checks recorded no horizontal overflow. Automated scans and absence of overflow do not prove complete conformance or that every element is unclipped.

The full name was propagated to visible identity, credits, alternatives, page/social metadata, and structured data. JavaScript-disabled Chromium checked **23 public routes and two filtered collection URLs** for server-visible content, a main H1, full-name titles, ervincs.com canonicals, matching social metadata, parsed profile schema, sitemap coverage, and unknown-project 404/noindex. Filtered URLs canonicalized to their collections. Those local results do not prove production indexing or Google's selected canonical.

### Layout and particles — 10 October 2026

Local production-build reviews covered Home, About, Projects, Design, Engineering, Contact, WeTrack, and ChatGPT Clone at 320, 390, 820, 1024, and 1440px in both themes, with additional root-font/text-spacing and short-screen samples. Reviews checked stacked reading order, three-column desktop collections, balanced Design endings, menu focus, filter recovery, and full-frame image coverage. No overflow or page runtime errors were recorded in those samples.

The final whole-viewport particle review checked one normal-page canvas across top/middle/bottom scrolling and navigation; the standalone 404 had one dedicated canvas and recovery restored the shared field. Counts/FPS, nearby connectors, movement beyond six seconds, 404 pause/resume, theme changes, reduced-motion destruction, data saver, and no-JavaScript content were checked. Eight routes in both themes recorded zero automated axe violations. Some visibility handling was exercised through simulated events rather than actual background-tab lifecycle measurement.

The former homepage side-margin field, settling timer, section snapping, translated/scaled hero, and rotating cursor were subsequently replaced. Their old measurements and proposals are not current behavior.

### Image optimizer baseline — 10 October 2026, now inactive

Before the 23 October transformation bypass, local production-build requests returned WebP output at requested widths, then cache HITs after initial MISSes. Project derivatives had a 31-day cache lifetime; longer upstream Dribbble caching prevailed. Static-import output had immutable caching. Nine malformed/unknown path/query/width/quality requests returned 400. A 1920 request for YouTube Clone preserved its native 1909px width without enlargement.

Browser source-selection samples covered seven image-bearing routes at the five widths and 1×/2× density. At 1440px/2×, the first project/design cards selected 768px instead of the previous 1920px. Exact original image fixtures supported deterministic layout/crop reviews; separate local optimizer requests fetched real upstream files through a temporary QA proxy. No proxy workaround was added to application code.

These observations establish only that earlier local optimizer baseline. `images.unoptimized: true` now bypasses normal Next Image transformations; prior derivative/cache/source-selection results do not apply to current rendering. They never established hosted billing savings or the cause of a production usage spike.

## Remaining work

- **Browser coverage:** run the focused browser suite for the component-directory/import/CSS reorganization before merge; the checks above do not establish interactive or responsive behavior.
- **Images:** investigate the temporary optimizer bypass and revalidate before enabling transformations again. Check actual hosted delivery, original download sizes, cache behavior, and usage separately. Review the ChatGPT Clone hero crop when its image is supplied.
- **Manual accessibility:** NVDA/VoiceOver, actual browser zoom, real devices, and Windows forced-colors focus visibility remain unverified. Root-font enlargement and axe scans do not replace them.
- **Live contact:** a real CAPTCHA challenge, provider acceptance, and Gmail inbox receipt require an explicit user request and verified hostname/provider configuration. Automated tests must continue to avoid real email.
- **Dependencies:** obtain a fresh dependency audit before release. The 11 October record included development-only Stylelint/braces alerts; this pass neither reran that audit nor established that they were resolved.
- **Release environment:** verify Vercel project/team, target commit/branch, runtime, public CAPTCHA build key, and preview/production headers. The historical legacy runtime was Node.js 18; current production settings need inspection.
- **Public outcomes:** confirm current source/demo/CV/remote-image links and social preview artwork on the authorized hosted release. Search Console submission/indexing, selected canonicals, rankings, field Core Web Vitals, and production image costs remain unverified.

CMS and professional-content expansion remain deferred scope, as recorded in [architecture](architecture.md#scope-and-stack). No merge, production promotion, DNS change, or production-secret change is authorized by this documentation update.
