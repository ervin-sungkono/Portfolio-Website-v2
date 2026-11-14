# Verification and remaining work

This document distinguishes repeatable command coverage from dated observations. A command definition is not evidence that it passed. Record the actual environment, date, scope, and limits when running checks; do not reuse historical results as a current pass.

## Repeatable checks

Use Node.js 24, npm, and the committed lockfile. Setup and browser fixture examples are in [README](../README.md#development).

| Command                   | Coverage                                                                                              |
| ------------------------- | ----------------------------------------------------------------------------------------------------- |
| `npm run lint`            | ESLint for application and repository sources                                                         |
| `npm run lint:css`        | Stylelint over `src/**/*.css`                                                                         |
| `npm run typecheck`       | Application TypeScript; excludes tests                                                                |
| `npm run typecheck:tests` | Separate test TypeScript project                                                                      |
| `npm test`                | Vitest unit and API/storage integration tests                                                         |
| `npm run build`           | Production build; public content source configuration is required unless using the documented fixture |
| `npm run format:check`    | Whole-repository Prettier; scope to changed docs when unrelated unformatted files are present         |
| `git diff --check`        | Whitespace in the diff                                                                                |
| `npm run test:browser`    | Playwright public regressions against a production build                                              |
| `npm run test:live`       | Public browser regressions against existing localhost:3000; does not start/restart server             |

CI uses a separate job to build with `tests/support/fixtures/cms-runtime.mjs`, then runs `npx playwright test --config=playwright.cms.config.ts` with isolated fixture credentials and override storage. CMS unit and API/storage integration tests are available through `npm test`. `npm run test:browser` normally uses a production build. The documented public fixture uses a dummy CAPTCHA key and a read-only runtime shim; it does not test real OAuth, Dribbble, CAPTCHA, or email. No automated email should be sent.

GitHub Actions workflow definitions describe intended CI checks, not actual run status. Inspect the run for the relevant commit before reporting CI success. Browser coverage is targeted regression coverage, not a full responsive or accessibility audit.

## Full public verification before PR update — 14 November 2026

After the blog integration and architecture cleanup, the read-only public fixture production build and all 43 public Chromium checks passed on Node.js 24.22.1. The full repository Prettier check also passed. Coverage includes blog recovery with and without JavaScript, portfolio route reflow, mobile navigation, project focus and galleries, hero input and motion, theme selection, the cursor, and mocked contact behavior. This supplements the 144 unit/integration and 39 CMS browser checks recorded below; it does not establish current hosted OAuth, provider writes, email delivery, or deployment behavior.

The PR update exposed an existing workflow definition error: GitHub rejected `runner.temp` in the CMS job-level environment before starting any jobs. The override-file path now belongs to the Playwright step's environment, where the runner context is available. The linked `ervin-sungkono` preview built successfully; a separate linked `ervins-little-world-adventure` project failed because its configured `adventure` root directory is absent. Deployment settings were not changed.

## Architecture simplification — 14 November 2026

Two read-only audits reviewed exported-symbol references, dependencies, module ownership, and duplicate logic against the existing working tree, including the uncommitted blog integration. No confirmed dead production modules or unused direct dependencies were identified. The focused refactor centralized snapshot and Dribbble contracts, project defaults, collection staging, SHA checks, media validation, and date formatting. Source files decreased from 214 to 213 and source lines from 22,485 to 22,416; package.json and the lockfile were unchanged by this review.

On Node.js 24.22.1, all 144 unit/integration tests, application and test typechecks, ESLint, Stylelint, scoped Prettier, whitespace checks, and an isolated CMS production build passed. All 39 CMS Chromium checks and three public blog checks passed against simulated providers. Added checks cover retaining null SHA baselines, avoiding duplicate draft saves, and rejecting ordered project/post deletion conflicts before creating Git objects.

The full public browser suite was not rerun for this focused refactor. Live OAuth/provider writes, email delivery, hosted cache behavior, screen readers, and physical-device performance were not tested. The large editor/importer orchestration and separate index implementations were retained to avoid broader state or publishing changes.

## Blog and CMS integration — 14 November 2026

On Node.js 24.22.1, 141 unit/integration tests, application and test typechecks, ESLint, Stylelint, scoped Prettier, and whitespace checks passed. Production builds passed with the read-only public fixture and with isolated CMS fixtures containing either no post index or existing published posts. The populated build prerendered the three published fixture articles; unpublished and unindexed drafts were excluded from public discovery.

All 42 public Chromium checks and all 39 CMS Chromium checks passed. An additional JavaScript-enabled article-404 hydration check passed against the isolated fixture. After the final draft-restoration adjustment, a fresh production build and 11 focused CMS checks passed again. New coverage includes GFM tables, checklists, strikethrough and code blocks; safe shared Markdown rendering; Markdown whitespace retention; draft reload recovery; original-SHA conflicts and explicit rebasing; post/index publication alongside a project in one submission; unpublishing and deleting posts; public refresh retries without another finalization; sitemap updates; and server-rendered articles added after an empty build. Draft checks cover clearing a restored new-post slug, replacing a staged deletion while preserving its original SHA, and canceling deletion when the original content is restored without a commit. Dashboard checks include Blog Posts in keyboard order, responsive forms, and independent table scrolling. Public checks cover archive reflow and complete 404 HTML without JavaScript. Light/dark mobile editor and public article screenshots were inspected.

The fixtures simulate GitHub identity, writes, and Dribbble, and contact requests are mocked. No real GitHub content commits, OAuth sessions, CAPTCHA verification, email delivery, deployment, screen-reader audit, or physical-device performance checks were performed. Ignored sitemap/robots files generated in 2024 were removed from this checkout because they overrode the App Router metadata routes; this local cleanup is documented in README.

## PR review fixes — 13 November 2026

On Node.js 24.22.1, both fixture production builds, application and test typechecks, ESLint, Stylelint, scoped Prettier checks, and 122 unit/integration tests passed. The read-only public fixture passed 40 Chromium checks, including hero wheel, keyboard, touch and no-JavaScript behavior and the project gallery. The isolated CMS fixture passed all 34 browser checks; after tightening the final submit and project-switch synchronization, 23 relevant CMS browser checks passed again against a fresh build.

The CMS fixture simulates GitHub and publication, and contact tests mock delivery. Proxy tests simulate deployment protection and trusted-host selection; an actual protected Vercel deployment, live OAuth, provider writes, email delivery, physical devices, and screen readers were not tested.

## Project focus and hero scrolling — 13 November 2026

On Node.js 24.22.1, application and test typechecks, ESLint, Stylelint, Prettier, whitespace checks, and 112 unit and integration tests passed. Ten Chromium checks against the existing localhost development server covered project-card keyboard focus in light and dark themes at mobile and desktop sizes; directional one-slide wheel scrolling at 1024 and 1440 pixels; rapid gestures, nested scrolling, keyboard controls, parallax, reduced motion, and the no-JavaScript fallback. These checks do not replace manual screen-reader or physical-device testing.

## Accessibility and hero review — 13 November 2026

An axe-core audit of six local public routes found no reported violations in desktop light and dark themes or mobile light theme, including the open mobile navigation and a selected hero slide. An isolated CMS fixture audit found and verified a fix for accessible names on the hero-order controls; it reported no remaining violations across the six CMS sections, wizard steps, open selects, dialogs, and mobile dark import view. Keyboard checks covered public tab order, mobile navigation, hero slide controls, project gallery, and CMS dialogs and selects. Automated checks do not establish WCAG conformance; a manual screen-reader and real-device audit has not been performed.

The local hero browser regression passed for discrete wheel gestures, native scrolling, separate visual parallax, keyboard focus, reduced motion, and no-JavaScript fallback. The complete isolated CMS browser suite passed 29 checks, including the temporary accessibility audit. Contact requests were mocked and GitHub writes were simulated.

## CMS browser verification — 11 November 2026

On Node.js 24.22.1, an isolated fixture production build passed, followed by all 28 CMS Chromium checks in one run. The fixture simulates GitHub, Dribbble, and publishing; no live credentials, provider writes, or email delivery were tested.

## Dashboard and public UI review — 8 November 2026

Using Node.js 24, the isolated fixture production build, ESLint, Stylelint, test typecheck, Prettier, and 123 unit and integration tests passed. CMS Chromium checks passed across separate runs for the editor, internal scrolling at multiple viewport heights, draft publication and conflict recovery, image deletion, design selection, import, and motion. Public fixture checks passed for contact, project cards and search, and the mobile menu. The general public route sweep could not complete because the fixture does not contain the real `wetrack-app` project slug. A separate read-only localhost check observed hero wheel navigation and an uncropped initial card at one desktop viewport.

The fixtures simulate GitHub and CAPTCHA; they do not establish live OAuth, provider writes, CAPTCHA verification, email delivery, or real-device performance.

Later on 8 November, the public responsive Chromium suite passed against the already-running `localhost:3000` development server: all six portfolio routes, including `wetrack-app`, at five widths in light and dark themes, with enlarged text at 320 and 820 pixels, plus two mobile-menu checks. CAPTCHA was mocked. This verifies that local server's rendered behavior, not a deployed or production build.

## Development cleanup — 7 November 2026

On Node.js 24.22.1, 99 unit/integration tests, application and test typechecks, ESLint, and Prettier passed after the authentication and repository cleanup. An isolated CMS fixture passed 23 Chromium tests, and a subsequent production build passed with the simplified image configuration. Tests used simulated GitHub identities; live OAuth was not exercised.

## Architecture and motion review — 7 November 2026

On Node.js 24.22.1, application and test typechecks, ESLint, Stylelint, Prettier, whitespace checks, and 100 unit/integration tests passed. Isolated production builds passed 36 public and 22 CMS Chromium checks; a new artwork throttling and offscreen-pause check passed separately. Two HTTP fixture checks passed earlier in the review. Light, dark, and mobile About artwork previews were inspected locally.

In a headless Chromium comparison at a 512-pixel artwork size and device pixel ratio 2, the optimized scene used 15 draw calls and a 640 × 640 drawing buffer, compared with 26 calls and 768 × 768 before optimization. This does not establish frame rates on physical devices.

The CMS fixture simulates provider access and publication; the public fixture reads the public GitHub content tree with simulated identity and Dribbble responses. Real OAuth, provider writes, hosted cache behavior, CAPTCHA verification, and email delivery were not tested.

## Remaining checks before release

- Verify actual Vercel project/team, target branch and commit, runtime, and deployment headers.
- Recheck image behavior and hosted usage before considering optimizer reactivation.
- Confirm live OAuth/provider setup and current external source/demo/CV/social links.
- Real CAPTCHA acceptance, Gmail receipt, production indexing, field Core Web Vitals, and third-party image costs require separate evidence.
- Manual screen-reader, browser-zoom, forced-colors, and real-device behavior are not established by automated suites.
