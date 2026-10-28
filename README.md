# Ervin Cahyadinata Sungkono's Portfolio

Portfolio built with Next.js 16.4 App Router, React, and strict TypeScript. Public pages render on the server with focused client components for navigation, contact, and decorative motion. The owner can manage published projects, blog posts, homepage copy, taxonomy, and images through a GitHub-backed `/admin` workspace without a database or separate backend.

The blog feature is on `codex/portfolio-blog`, based on `origin/codex/pr5-release-readiness`. PR #6 remains draft/open, and the follow-up PR will target its branch. See [verification](docs/verification.md) for the dated PR #5/6 evidence and blog verification results and remaining hosted checks. The owner-managed CMS uses the existing public GitHub content repository; hosted OAuth and application cutover checks remain pending.

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
npm run lint
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

The documentation was updated for the blog feature on **28 October 2026 (Asia/Jakarta)**. Each topic has one primary reference:

| Document                                                                      | Contents                                                                                                             |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| [Architecture and operations](docs/architecture.md)                           | Code/content boundaries, CMS and blog storage/publishing, provenance, SEO, contact, images, and release constraints. |
| [Visual system, responsive layout, and motion](docs/responsive-and-motion.md) | Design tokens, page composition, accessibility, blog layout, hero crossfade, parallax, and cursor.                   |
| [Verification and remaining work](docs/verification.md)                       | Dated repository observations, automated coverage, and unresolved checks, including blog validation.                 |

`images.unoptimized` is currently enabled as a temporary workaround. See [image delivery](docs/architecture.md#image-delivery) before relying on earlier optimizer/cache results. Component structure and style ownership are documented in [architecture](docs/architecture.md#code-boundaries).

## Updating content

Without CMS configuration, the site reads `src/content/profile.ts`, `projects.json`, `designs.json`, and `engineering.ts`; there are no bundled blog posts. With `GITHUB_ADMIN_ID` and `GITHUB_REPO` set, runtime GitHub content replaces projects, published blog posts, and homepage copy through `src/lib/content.ts`. Configured storage errors do not silently fall back to bundled projects or posts. Designs, verified identity/experience, engineering studies, CV, and team attribution remain application content.

The blog archive is `/blog`; published articles use `/blog/<slug>`. Posts live in the optional `content/posts/` directory in the existing CMS repository and are managed from `/admin` → **Blog Posts**. A missing directory or no published posts produces an empty archive; no sample posts are seeded.

Follow [GitHub CMS setup and operation](docs/architecture.md#github-cms) for the five environment variables, OAuth setup, safe initialization, and publishing. Blog posts use the existing CMS and shared content boundary; see [blog posts](docs/architecture.md#blog-posts). For a legacy content review, use the [LLM mapping instructions](docs/web-assets-migration-agent.md). The content repository must be separate from the application and must not be a Vercel deployment source. Content publishes invalidate ISR without redeploying.

The `web-assets/master` migration is complete at `ce10d45`; `legacy` preserves the original `3a62ce0` tree. The hosted application cutover is still pending. The one-off converter has been removed and must not be rerun; see [migration evidence and release checks](docs/verification.md#authorized-web-assets-publication).

Run `npm run test:cms:browser` for the isolated production CMS workflow; it uses simulated GitHub storage and encrypted test sessions, never a real GitHub write or email. It replaces the local `.next` build with a fixture build; rebuild normally before development or release.

Contact variables and provider behavior are documented in [contact integration](docs/architecture.md#contact-integration) and `.env.example`. Professional content expansion remains deferred. Read [AGENTS.md](AGENTS.md) before implementation work.
