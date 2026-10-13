# Ervin Cahyadinata Sungkono's Portfolio

Portfolio rework and CMS implementation for Ervin Cahyadinata Sungkono, built with Next.js 16.4 App Router, React 19, strict TypeScript, PostgreSQL, Drizzle ORM, and Better Auth. The rework has merged to `dev`; CMS changes are under review in [PR #3](https://github.com/ervin-sungkono/Portfolio-Website-v2/pull/3), targeting `dev`. Professional content expansion remains deferred.

## Development

Use Node.js 24 (the package requires Node.js 22 or newer), npm, and the committed lockfile.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

The public site defaults to its checked-in content snapshots, so it can run without database or Blob credentials. The CMS at `/admin` needs the database, authentication, and private media configuration described in [CMS setup and operations](docs/cms.md). Database mode is explicit: setting `CMS_CONTENT_SOURCE=database` makes the public site read the published database projection, and a database error is surfaced instead of silently serving the snapshots.

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

| Document                                                      | Contents                                                                                |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| [Architecture and operations](docs/architecture.md)           | Application boundaries, content, SEO, contact, image delivery, and release constraints. |
| [Responsive layout and motion](docs/responsive-and-motion.md) | Visual system, accessibility, responsive behavior, and motion.                          |
| [CMS setup and operations](docs/cms.md)                       | Provisioning, authentication, publishing, private media, and recovery.                  |
| [Verification](docs/verification.md)                          | Dated evidence, check coverage, and remaining work.                                     |

- `src/app`: public and admin routes, metadata, layouts, and APIs.
- `src/components`: shared navigation, footer, cards, experience, and contact form.
- `src/content`: typed profile facts and project/design content snapshots.
- `src/lib/content.ts`: single public-content boundary used by pages; it selects snapshots or the published database projection.
- `src/lib/cms`: server-only authentication, role-separated database access, content revisions, publication, cache invalidation, and private media delivery.
- `src/lib/contact`: shared validation and server-only Gmail/reCAPTCHA services.
- `src/styles`: design tokens and responsive page styles. Small component styles use CSS Modules.

Pages are Server Components. The header, contact form, admin editor, small motion islands, and selectively loaded particle accents use focused browser components. Search and category filters use shareable query parameters and server rendering. Public CMS content is read from a separate published projection; draft records stay behind the authenticated admin boundary. Known project details resolve on request in both content-source modes, using the cached published projection in database mode. A route guard checks static slugs from the JSON snapshot or performs one fresh parameterized public-role existence query per database-mode detail navigation. Missing slugs rewrite to the dedicated request-time `/project-not-found` recovery page with HTTP 404, noindex, and `no-store`; this prevents a cached generated 404 from hiding a newly published project. A failed database check returns 503 and never falls back to the snapshot.

## Updating content

Edit `src/content/profile.ts`, `projects.json`, `designs.json`, and `engineering.ts`; collection access belongs in `src/lib/content.ts`. Featured projects are the first three entries in `projects.json`. Keep public slugs, original assets/links, team attribution, the full name **Ervin Cahyadinata Sungkono**, and the public origin **https://ervincs.com** consistent.

## Engineering showcase

The homepage and About page link capabilities to specific projects. WeTrack, ChatGPT Clone, and Next Pokedex have walkthroughs with context, documented implementation, tradeoff analysis, source references, and explicitly proposed next validation steps. Team attribution stays visible; no individual ownership or measured outcomes are inferred.

`/engineering` explains this site's architecture with links to the relevant source files and verification notes. Related projects use shared technologies and category to help visitors continue browsing. Showcase content renders on the server and passes into small Motion wrappers for selected entry and pointer effects. See [Engineering Editorial visual design](docs/visual-design-2026.md) for the current presentation system and [responsive layout and motion](docs/responsive-and-motion.md) for the shared sizing rules, desktop sticky/parallax scenes, and animation boundaries.

`portfolioSourceRef` in `src/content/engineering.ts` points source links to `dev` while CMS PR #3 is under review. Update it after that PR merges.

Images point to the owner’s existing `web-assets` repository and original Dribbble CDN. Current delivery behavior, the temporary optimization bypass, and private CMS media are documented in [architecture](docs/architecture.md#image-delivery). Publish changed remote artwork under a new filename/URL.

The CMS manages existing project, design, and profile records. `npm run cms:seed` imports the checked-in snapshots as the initial published content and skips records that already exist. The editor validates the established schemas and URL allowlist; it does not add professional claims or new portfolio facts. See [CMS setup and operations](docs/cms.md) for provisioning, credentials, authentication, publishing, private media, and recovery procedures.

## Contact and email

The form validates on client and server, focuses invalid fields, preserves drafts on errors, and clears fields only after Gmail accepts a message. Fields become read-only during verification and delivery so edits cannot be discarded by a successful submission. The API checks origin, limits the body to 64 KiB (including Unicode and JSON escapes within the permitted field lengths), rejects the honeypot, verifies invisible reCAPTCHA v2, and sends a plain-text email to the owner with the visitor’s address as `replyTo`.

| Variable                    | Purpose                                          |
| --------------------------- | ------------------------------------------------ |
| `EMAIL`                     | Gmail sender and recipient                       |
| `EMAIL_PASS`                | Gmail app password; server-only                  |
| `NEXT_PUBLIC_RECAPTCHA_KEY` | Invisible reCAPTCHA v2 public site key           |
| `RECAPTCHA_SECRET`          | reCAPTCHA secret; server-only                    |
| `RECAPTCHA_KEY`             | Existing deployment alias for `RECAPTCHA_SECRET` |

Set secrets in `.env.local` or the hosting dashboard. Never commit values. Existing Vercel names remain compatible. Register production and preview hostnames in reCAPTCHA. If configuration or delivery is unavailable, the form reports an error and points visitors to LinkedIn.

## Search metadata

The public origin is `https://ervincs.com`, defined once in `src/lib/metadata.ts`. Canonical links, social metadata, robots.txt, and the sitemap use that origin, including in previews. `SITE_URL` is no longer used, so a stale deployment variable cannot override the canonical domain. Each route has a descriptive title and summary; the About page includes ProfilePage/Person structured data using the same public profile facts as the page.

When reusing a legacy checkout, remove the ignored, generated `public/robots.txt`, `public/sitemap.xml`, and `public/sitemap-0.xml` if present. Those old static files can shadow the App Router metadata endpoints. Fresh checkouts contain none of them; sitemap and robots are generated by `src/app/sitemap.ts` and `src/app/robots.ts`.

After promoting this rework, submit `https://ervincs.com/sitemap.xml` in Google Search Console and inspect the production URLs. Vercel preview deployments retain their `X-Robots-Tag: noindex` header. Metadata improves page identification and search snippets; it does not guarantee indexing or rankings.

See [architecture and source notes](docs/architecture.md) for rendering, data boundaries, and image delivery.
