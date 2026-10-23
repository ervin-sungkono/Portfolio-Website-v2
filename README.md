# Ervin Cahyadinata Sungkono's Portfolio

Phase 1 rework of the original portfolio using Next.js 16.4 App Router, React, and strict TypeScript. Existing projects, artwork, public routes, CV, social links, and team credits are preserved. Pages render on the server with focused client components for navigation, contact, and decorative motion.

Development continues on `feat/portfolio-rework-phase-1` in [draft PR #2](https://github.com/ervin-sungkono/Portfolio-Website-v2/pull/2), targeting `main`. See the [dated repository snapshot](docs/verification.md#repository-snapshot--23-october-2026) before treating recorded results as current checks.

## Development

Use Node.js 24 (the package requires Node.js 22 or newer), npm, and the committed lockfile.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Production credentials are only needed for live contact integration. The available checks are:

```sh
npm run typecheck
npm run lint:css
npm test
npm run build
npm run format:check
git diff --check
```

Run `npm start` after a production build to serve it locally. GitHub Actions runs the configured checks with Node.js 24. Text files use LF endings through `.gitattributes`. See [verification coverage](docs/verification.md#repeatable-checks) for what each command checks.

### Browser regressions

The Playwright suite covers contact/API boundaries, project recovery without JavaScript, the desktop cursor, and hero/parallax behavior. It runs against a production build. Install Chromium once:

```sh
npx playwright install chromium
```

Build with the dummy public CAPTCHA key, then run the suite:

```sh
NEXT_PUBLIC_RECAPTCHA_KEY=review-test-key npm run build
npm run test:browser
```

In PowerShell:

```powershell
$env:NEXT_PUBLIC_RECAPTCHA_KEY = 'review-test-key'
npm run build
npm run test:browser
Remove-Item Env:NEXT_PUBLIC_RECAPTCHA_KEY
```

The test server clears provider secrets and form tests mock CAPTCHA/delivery; no real email is sent. Rebuild with the real public site key before deploying a build that needs live CAPTCHA. Set `PLAYWRIGHT_EXECUTABLE_PATH` to a system Chromium executable if the bundled browser is unavailable. This suite is focused regression coverage, rather than a full accessibility or responsive audit.

## Documentation

The documentation was consolidated on **23 October 2026 (Asia/Jakarta)**. Each topic has one primary reference:

| Document                                                                      | Contents                                                                                                          |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| [Architecture and operations](docs/architecture.md)                           | Code/content boundaries, provenance, SEO, contact configuration, current image delivery, and release constraints. |
| [Visual system, responsive layout, and motion](docs/responsive-and-motion.md) | Design tokens, page composition, accessibility, hero crossfade, parallax, cursor, and particles.                  |
| [Verification and remaining work](docs/verification.md)                       | Current repository observations, automated coverage, consolidated dated evidence, and unresolved checks.          |

`images.unoptimized` is currently enabled as a temporary workaround. See [image delivery](docs/architecture.md#image-delivery) before relying on earlier optimizer/cache results. Component structure and style ownership are documented in [architecture](docs/architecture.md#code-boundaries).

## Updating content

Edit `src/content/profile.ts`, `projects.json`, `designs.json`, and `engineering.ts`; collection access belongs in `src/lib/content.ts`. Featured projects are the first three entries in `projects.json`. Keep public slugs, original assets/links, team attribution, the full name **Ervin Cahyadinata Sungkono**, and the public origin **https://ervincs.com** consistent.

Contact variables and provider behavior are documented in [contact integration](docs/architecture.md#contact-integration) and `.env.example`. CMS work and professional content expansion remain deferred. Read [AGENTS.md](AGENTS.md) before implementation work.
