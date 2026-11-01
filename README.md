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

Configure the server-side GitHub PAT and content repository before reading public content locally; the Dribbble token supplies selected design details. Owner sign-in also needs the Auth.js settings. See [CMS setup](docs/architecture.md#github-cms). Contact provider credentials are needed only for live contact integration. ESLint applies the Next.js Core Web Vitals and TypeScript recommendations; Stylelint applies the standard CSS rules. Both enforce LF line endings and final newlines, while `.editorconfig` and `.gitattributes` set the repository defaults. The available checks are:

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

For the public regression suite, use the read-only fixture for GitHub identity and an empty Dribbble response. It reads the actual public `web-assets/master` documents and needs network access, but no production API credentials. Build with the dummy public CAPTCHA key, then run the suite:

```sh
(
  export NEXT_PUBLIC_RECAPTCHA_KEY=review-test-key GITHUB_PAT=fixture-public-token GITHUB_REPO=web-assets DRIBBBLE_TOKEN=fixture-dribbble-token
  export NODE_OPTIONS=--import=./tests/support/fixtures/public-runtime.mjs
  npm run build
  npm run test:browser
)
```

In PowerShell:

```powershell
powershell -NoProfile -Command {
  $env:NEXT_PUBLIC_RECAPTCHA_KEY = 'review-test-key'
  $env:GITHUB_PAT = 'fixture-public-token'
  $env:GITHUB_REPO = 'web-assets'
  $env:DRIBBBLE_TOKEN = 'fixture-dribbble-token'
  $env:NODE_OPTIONS = '--import=./tests/support/fixtures/public-runtime.mjs'
  npm run build
  npm run test:browser
}
```

The public fixture does not test real OAuth or Dribbble. Form tests mock CAPTCHA/delivery; no real email is sent. Rebuild without the fixture and with the real public site key before deploying a build that needs live CAPTCHA. Set `PLAYWRIGHT_EXECUTABLE_PATH` to a system Chromium executable if the bundled browser is unavailable. This suite is focused regression coverage, rather than a full accessibility or responsive audit.

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

Portfolio content is read from the configured public GitHub repository at build time and after on-demand revalidation. The owner workspace edits projects, homepage copy, taxonomy, and the selected Dribbble shot IDs; `/admin/import` maps accessible GitHub repositories into project drafts. Profile, skills, project walkthroughs, and the ordered design selection are in `content/portfolio.json`. Design titles, links, and images come from Dribbble at runtime. There is no checked-in application data fallback. After editing content directly on GitHub, use **Refresh public content** in the owner workspace.

Follow [GitHub CMS setup and operation](docs/architecture.md#github-cms) for credentials, initialization, importing, and publishing. For a legacy content review, use the [LLM mapping instructions](docs/web-assets-migration-agent.md). The content repository must be separate from the application and must not be a Vercel deployment source. Content publishes invalidate ISR without redeploying.

Run `npm run test:cms:browser` for the isolated production CMS browser workflow, `npm run test:http:fixture` for its real HTTP boundary checks, or `npm run test:cms:fixture` for both. They use simulated GitHub storage and encrypted test sessions, never a real GitHub write or email. Each command replaces the local `.next` build with a fixture build; use an isolated checkout while a development server is running and rebuild normally afterward.

Contact variables and provider behavior are documented in [contact integration](docs/architecture.md#contact-integration) and `.env.example`. Professional content expansion remains deferred. Read [AGENTS.md](AGENTS.md) before implementation work.
