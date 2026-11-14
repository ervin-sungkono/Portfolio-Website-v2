# Ervin Cahyadinata Sungkono's Portfolio

Portfolio built with Next.js 16.4 App Router, React, and strict TypeScript. Public pages render on the server with focused client components for navigation, contact, and decorative motion. The owner can manage projects, blog posts, homepage copy, taxonomy, and images through a GitHub-backed `/admin` workspace without a database or separate backend.

Development starts from `dev`. See [verification](docs/verification.md) for dated checks and remaining integration work.

## Development

Use Node.js 24 (the package requires Node.js 22 or newer), npm, and the committed lockfile.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Configure the server-side GitHub PAT and content repository before reading public content locally; the Dribbble token supplies selected design details. Owner sign-in also needs the Auth.js settings. See [CMS setup](docs/architecture.md#github-cms). Contact provider credentials are needed only for live contact integration. ESLint applies the Next.js Core Web Vitals and TypeScript recommendations; Stylelint applies the standard CSS rules. Both enforce LF line endings and final newlines; `.gitattributes` sets the repository text-file defaults. The available checks are:

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

Old checkouts may contain ignored `public/robots.txt` or `public/sitemap*.xml` files from the former sitemap generator. Remove those generated files; `src/app/robots.ts` and `src/app/sitemap.ts` own the current routes, and stale public files can override them locally.

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

## Finding the code

| Task                                      | Start here                                                                                                         |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Change a page or its metadata             | `src/app`, then its section in `src/components`                                                                    |
| Change shared buttons or links            | `src/components/common/Button`, `ExternalLink`, and `src/styles/globals.css`                                       |
| Change shared motion or the About artwork | `src/components/common/Typewriter`, `Reveal`, `PointerSurface`, and `src/components/about/AboutIntro/AboutArtwork` |
| Trace portfolio content                   | `src/lib/content.ts` and `src/lib/cms/public.ts`                                                                   |
| Change CMS editing or local drafts        | `src/components/admin/CmsEditor` and `src/components/admin/CmsDraftProvider`                                       |
| Change blog rendering or Markdown editing | `src/app/blog`, `src/components/blog`, and `src/components/admin/CmsEditor/PostsPanel`                             |
| Trace CMS sign-in or publishing           | `src/lib/cms/auth.ts`, `src/app/api/cms/route.ts`, and `src/lib/cms/draft-finalization.ts`                         |
| Change contact validation or delivery     | `src/components/contact/ContactForm`, `src/app/api/contact/route.ts`, and `src/lib/contact`                        |

The [architecture flow map](docs/architecture.md#request-and-publishing-flows) connects these entry points to their supporting modules. Browser and HTTP fixture helpers live under `tests/support` and `tests/http`.

## Documentation

Each topic has one primary reference:

| Document                                                                      | Contents                                                                                                          |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| [Architecture and operations](docs/architecture.md)                           | Code/content boundaries, provenance, SEO, contact configuration, current image delivery, and release constraints. |
| [Visual system, responsive layout, and motion](docs/responsive-and-motion.md) | Design tokens, responsive behavior, accessibility, hero motion, parallax, and cursor behavior.                    |
| [Verification and remaining work](docs/verification.md)                       | Repeatable checks, historical evidence, and remaining release checks.                                             |

`images.unoptimized` is currently enabled as a temporary workaround. See [image delivery](docs/architecture.md#image-delivery) before relying on earlier optimizer/cache results. Component structure and style ownership are documented in [architecture](docs/architecture.md#code-boundaries).

## Updating content

Portfolio content is read from the configured public GitHub repository during prerendering and when the server regenerates cached content. The owner workspace edits projects, homepage copy, taxonomy, and the selected Dribbble shot IDs; `/admin/import` maps accessible GitHub repositories into project drafts. Profile, skills, project walkthroughs, and the ordered design selection are in `content/portfolio.json`. Selected design details come from Dribbble through a server-side cache. Cache invalidation or a cache miss can trigger provider requests after the build. There is no checked-in application data fallback. Direct GitHub edits do not automatically invalidate the cache. When adding or removing projects, update `content/project-index.json`; cached public content may remain stale until it regenerates or a later CMS publication invalidates it.

The CMS dashboard shows projects, blog posts, and taxonomy in tables, designs and repository images in card grids, and the site profile in an inline multi-step form. Project import is available in Projects. Editing steps keep the current browser draft; image deletions and their reference changes are also staged locally. Edits stay in this browser's Cache Storage until **Submit draft**. **Delete draft** asks for confirmation before removing unsubmitted changes. Drafts remain after a reload in the same browser profile, but are not uploaded or synchronized to another browser or device before submission. CMS editing requires a secure browser context with Web Locks support and allows one `/admin` or `/admin/import` tab per origin at a time. A browser prompt warns before leaving while a draft save is pending or still needs a retry. Browser storage quotas, eviction, or clearing site data can still remove a draft. Submitting shows a change review and publishes the confirmed draft in one Git commit. A content conflict keeps the local draft available for review. **Retry public refresh** appears only when a successful commit leaves cache invalidation pending; retrying does not submit another commit.

Blog Posts uses a Markdown editor with a formatting toolbar and live GFM preview, including tables, task checklists, strikethrough, and fenced code blocks. Markdown stays in the JSON `body` field of `content/posts/<slug>.json`. Published posts appear at `/blog` and `/blog/<slug>`; the publication date is editorial metadata rather than a schedule. The editor preview and public article share the same renderer, with raw HTML disabled. Posts join the existing draft, change review, conflict checks, and atomic submission. CMS publication maintains `content/post-index.json`; direct GitHub additions or removals must update that index as well. A missing post index produces an empty public archive without changing the content repository.

Follow [GitHub CMS setup and operation](docs/architecture.md#github-cms) for credentials, initialization, importing, and publishing. The content repository must be separate from the application and must not be a Vercel deployment source. Content publishes invalidate ISR without redeploying.

CI builds with the `cms-runtime` fixture, then runs `npx playwright test --config=playwright.cms.config.ts` in a separate job with isolated fixture credentials and override storage. CMS unit and API/storage integration coverage is available through `npm test`; these tests use mocks and never make real GitHub writes or send email.

Contact variables and provider behavior are documented in [contact integration](docs/architecture.md#contact-integration) and `.env.example`. Professional content expansion remains deferred. Read [AGENTS.md](AGENTS.md) before implementation work.
