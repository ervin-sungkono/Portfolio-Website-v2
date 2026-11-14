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
