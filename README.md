# Ervin Cahyadinata Sungkono's Portfolio

Portfolio built with Next.js 16.4 App Router, React, and strict TypeScript. Public pages render on the server with focused client components for navigation, contact, and decorative motion. The owner can manage published projects, homepage copy, taxonomy, and images through a GitHub-backed `/admin` workspace without a database or separate backend.

Development starts from `dev`. The previous Neon-based [PR #3](https://github.com/ervin-sungkono/Portfolio-Website-v2/pull/3) was closed without merging; this implementation follows the separate public GitHub content repository architecture. See [verification](docs/verification.md) for dated checks and remaining integration work.

## Development

Use Node.js 24 (the package requires Node.js 22 or newer), npm, and the committed lockfile.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Production credentials are only needed for live contact integration. ESLint applies the Next.js Core Web Vitals and TypeScript recommendations; Stylelint applies the standard CSS rules. Both enforce LF line endings and final newlines, while `.editorconfig` and `.gitattributes` set the repository defaults. The available checks are:

```sh
npm run typecheck
npm run typecheck:tests
npm run lint
npm run lint:css
npm test
npm run build
npm run format:check
git diff --check
```

`npm test` runs Vitest's logic and handler integration tests without a running server. Tests use mocked providers and isolated GitHub fixtures. Test files are organized under `tests/unit`, `tests/integration`, `tests/e2e`, and `tests/support`. `npm run typecheck:tests` checks test TypeScript separately from the application.

Run `npm start` after a production build to serve it locally. GitHub Actions runs the configured checks with Node.js 24. Text files use LF endings through `.gitattributes`. See [verification coverage](docs/verification.md#repeatable-checks) for what each command checks.

### Browser regressions

The Playwright suite covers contact form behavior, project recovery without JavaScript, theme selection, the desktop cursor, and hero/parallax behavior. It normally runs against a production build. Install Chromium once:

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

To exercise the public browser suite against an already-running `http://localhost:3000`, use `npm run test:live`. It does not start or restart the server; contact form requests are intercepted. Assertions that name projects assume the expected portfolio content is present in that server's configuration.

## Documentation

The documentation was consolidated on **23 October 2026 (Asia/Jakarta)**. Each topic has one primary reference:

| Document                                                                      | Contents                                                                                                          |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| [Architecture and operations](docs/architecture.md)                           | Code/content boundaries, provenance, SEO, contact configuration, current image delivery, and release constraints. |
| [Visual system, responsive layout, and motion](docs/responsive-and-motion.md) | Design tokens, page composition, accessibility, hero crossfade, parallax, cursor, and particles.                  |
| [Verification and remaining work](docs/verification.md)                       | Current repository observations, automated coverage, consolidated dated evidence, and unresolved checks.          |

`images.unoptimized` is currently enabled as a temporary workaround. See [image delivery](docs/architecture.md#image-delivery) before relying on earlier optimizer/cache results. Component structure and style ownership are documented in [architecture](docs/architecture.md#code-boundaries).

## Updating content

Portfolio content is read from the public `ervin-sungkono/web-assets` repository at build time and after on-demand revalidation. Projects, homepage copy, and taxonomy can be edited in the CMS; profile, skills, designs, and project walkthroughs are in `content/portfolio.json` in that repository. There is no checked-in application data fallback. After editing that document directly on GitHub, use **Refresh public content** in the owner workspace.

Follow [GitHub CMS setup and operation](docs/architecture.md#github-cms) for OAuth setup, source overrides, initialization, and publishing. For a legacy content review, use the [LLM mapping instructions](docs/web-assets-migration-agent.md). The content repository must be separate from the application and must not be a Vercel deployment source. Content publishes invalidate ISR without redeploying.

Run `npm run test:cms:browser` for the isolated production CMS browser workflow, `npm run test:http:fixture` for its real HTTP boundary checks, or `npm run test:cms:fixture` for both. They use simulated GitHub storage and encrypted test sessions, never a real GitHub write or email. Each command replaces the local `.next` build with a fixture build; use an isolated checkout while a development server is running and rebuild normally afterward.

Contact variables and provider behavior are documented in [contact integration](docs/architecture.md#contact-integration) and `.env.example`. Professional content expansion remains deferred. Read [AGENTS.md](AGENTS.md) before implementation work.
