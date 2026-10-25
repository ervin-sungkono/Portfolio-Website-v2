# Verification and remaining work

Documentation reconciled on **25 October 2026 (Asia/Jakarta)**. This document separates current repository observations from historical application checks. [Architecture](architecture.md) owns implementation/operations; [UI behavior](responsive-and-motion.md) owns presentation and interaction rules.

## GitHub CMS implementation — 25 October 2026

Work started from local and remote `dev` at `fa740ee632d78a0ff0827cdc0bbd63524d34b59c`, verified through GitHub's branch API. The working tree already contained substantial public-component, lint, documentation, and asset/route deletions; those changes were retained. Implementation is on `codex/github-portfolio-cms`. A live read confirmed that the earlier Neon/Blob [PR #3](https://github.com/ervin-sungkono/Portfolio-Website-v2/pull/3) is **closed and unmerged**; its database architecture is not part of this implementation.

The implemented story is `/admin` → GitHub owner session → shared validation → configured public content repository commit → ISR invalidation → public content rendering. [Architecture and setup](architecture.md#github-cms) own the configuration, storage, publishing, migration, and rollback instructions. This section records evidence, not a production release approval.

### Local checks

- Node.js **24.22.1** was used for the clean `npm ci` and the full unit/service suite. The existing project dev server initially locked SWC; it was stopped before the successful installation. The explicit `server-only` package was removed as requested; Next.js's build marker remains, with a Node-only test resolver.
- At initial CMS implementation, **38/38 unit/service tests passed**: 11 existing contact/offline-mail cases, 5 authentication cases, 5 publishing/HTTP/cache cases, 11 GitHub storage cases, and 6 one-off migration-tool cases. The migration-tool cases were removed with that utility after publication; current check counts are listed under [repeatable checks](#repeatable-checks). GitHub requests are simulated in service tests; those tests send no real repository write or email.
- Authentication coverage includes immutable owner-ID/provider restrictions, rejection of client credential updates, allowlisted session JSON, expired/wrong-owner sessions, and encrypted Auth.js cookie round-trips. It does not exercise GitHub's hosted OAuth consent/callback exchange.
- Storage coverage includes public reads on a non-`main` default branch, strict/future schemas, media signatures, custom author/committer bootstrap, safe partial initialization, private/unrelated repositories, stale and concurrent SHA conflicts, registry integrity, upload bytes/deduplication, and rate-limit errors.
- Publishing coverage confirms commit-before-invalidation, no invalidation after failed writes, retained commit success after cache failure, expected path/tag mapping, same-origin mutations, private error responses, and streamed request limits.
- Production compilation and TypeScript passed under Node.js 24.22.1 with Next.js 16.4.3 and the dummy CAPTCHA key. CSS lint passed. Whole-tree ESLint passed with two existing warnings (contact effect synchronization and an unused motion prop). The production dependency audit returned **zero vulnerabilities** after the Next.js/Nodemailer security patches; npm's full install audit still reported one moderate development dependency finding.
- The isolated CMS production build and **4/4 Chromium workflow tests passed**, using local Chrome because the matching Playwright headless-shell executable was absent. They verify real editor forms → protected API → simulated GitHub commits → public ISR refresh, prior 404 recovery and published pages without JavaScript, unpublish/sitemap/delete, PNG upload, session/API restrictions, and absence of duplicate panel IDs. They caught and fixed duplicate React panel keys that had appended stale form instances during editing.
- Editor checks exercised Projects, Site Profile, Categories, Technologies, and Images at **320, 390, 820, 1024, and 1440 px in both themes**, plus 200% root-font samples at 320/820, visible keyboard focus, and first-error focus. These are reflow/root-font checks, not actual browser zoom or complete WCAG verification. Light-theme screenshots were captured during the sweep; normal test-output cleanup can replace them.
- After restoring the ordinary non-fixture production build, the full public suite passed **26/26**. The discovered Next.js PPR behavior is documented in [architecture](architecture.md#github-cms): runtime `notFound()` produced blank no-JavaScript recovery, and a rewrite replaced a supplied 404 with 200. The final proxy returns a complete buffered recovery document with explicit 404/noindex/no-store.
- Final whole-repository Prettier and Git whitespace checks passed for that local implementation pass. All **29 local Markdown file/fragment references** in README, AGENTS, and the three owning documents resolved. The PR #5 CI baseline is recorded separately below and does not change the scope of these original local checks.

### CMS component organization follow-up — 25 October 2026

The editor's six flat child component files were reorganized into `CategoriesPanel/`, `CmsMessage/`, `ImagesPanel/`, `ProjectPanel/`, `SiteProfilePanel/`, and `TechnologiesPanel/`, each with `index.tsx`, `type.ts`, and `style.css`. Shared form styles remain at the editor level; panel-specific rules are colocated and scoped. Component props and editor state types now live in type files. This changes organization and style ownership, not publishing behavior.

Fresh Node.js 24 checks for this refactor passed TypeScript, scoped ESLint, scoped Stylelint, formatting, the isolated production build, and all **4 CMS browser tests**, including the five-width/both-theme/reflow/keyboard sweep. The ordinary non-fixture build was restored afterward. Earlier public-suite and unit results above are not claimed as reruns for this structural change.

### Migration dry-run against public source

The then-available one-off read-only command `npm run cms:migrate-web-assets -- --source ervin-sungkono/web-assets --branch master --dry-run --output ./migration-output` succeeded under Node.js 24.22.1 against source commit **`3a62ce04163dfdc8d6e328df385ba538762555b9`**. It reported `canWrite: true`, **zero errors, missing metadata, or invalid references**, 17 confirmed existing slug mappings, 4 Frontend Mentor challenge entries retained in the aggregate project's report/gallery, 25 optimized raster images, and 46 proposed output files. The `All` filter, legacy SVG icons, and two unreferenced images were reported as skipped. Repository creation years are explicitly recorded as proxies because legacy JSON has no year field.

Dry-run wrote neither a bundle nor a report file and did not mutate GitHub. At the time, migration-specific tests also checked staging/overwrite rejection and source preservation; those tests and the one-off tool were removed after publication. The command and its output are historical evidence, not a currently available npm script.

### Authorized web-assets publication

The owner subsequently requested writing the migration to `web-assets/master` and preserving the old master tree on a new `legacy` branch, then explicitly chose to retain compatibility asset URLs during cutover. The final validated bundle was regenerated from a local clone of the captured source and repository creation metadata read through GitHub after unauthenticated REST requests hit the rate limit.

- [`master`](https://github.com/ervin-sungkono/web-assets/tree/master) now points to migration commit [`ce10d45dc0200b5ff9c146a4f2c43e2b873171ad`](https://github.com/ervin-sungkono/web-assets/commit/ce10d45dc0200b5ff9c146a4f2c43e2b873171ad), whose parent is the original `3a62ce0` commit.
- [`legacy`](https://github.com/ervin-sungkono/web-assets/tree/legacy) points exactly to **`3a62ce04163dfdc8d6e328df385ba538762555b9`**, preserving the complete prior tree and history. Both refs were updated by one atomic push with explicit expected-head checks.
- GitHub confirmed both author and committer as **`Portfolio CMS <cms@portfolio.local>`**. The old `data/` JSON is available on `legacy`; the 35 old `images/` and `icons/` files remain unchanged on `master`. Git object comparison confirmed no differences in either compatibility directory.
- The new master tree has **81 files**: the 46 generated README/content/media files plus 35 compatibility assets. It includes 17 project JSON documents and 25 optimized raster images. README records the numeric-ID → slug audit mapping and rollback guidance.
- Read-back validation fetched all 20 published JSON documents, compared their bytes to the reviewed bundle, parsed shared Zod schemas, and verified all 25 referenced images with the server's reference/signature/size checks. An existing `master/images/WeTrack-App.png` URL returned HTTP 200 with identical bytes.

The application deployment and OAuth configuration were not changed. The `master` migration is complete at `ce10d45` with the original `3a62ce0` tree preserved on `legacy`; hosted application cutover and rollback execution remain unverified. Keep the compatibility paths and `legacy` branch until cutover is accepted. Any content rollback must be reviewed against the actual current branch and preserve later publications; do not blindly reset a branch.

### Mapping guide and cleanup — 25 October 2026

After the authorized publication and read-back checks, the one-off `scripts/migrate-web-assets.ts` CLI, its `src/lib/cms/migration.ts` conversion module, and six utility-specific tests were removed. No application runtime imports depended on them. [The Markdown guide](web-assets-migration-agent.md) instructs an LLM agent to compare the read-only `legacy` source with existing `master`, map facts to the shared Zod schemas, and report unresolved fields before any separately authorized edits. No repository content or CMS runtime behavior changed in this cleanup.

After cleanup, the Node.js 24 unit/service suite passed **32/32**, strict TypeScript passed, and the normal production build passed with the `server-only` package absent from `node_modules`; Next.js continues to resolve the source boundary markers. Scoped Prettier, package/lock dependency-map consistency, and `git diff --check` passed. A CMS browser-suite retry completed its fixture build but produced no test results and had no Node or Chromium process left; it was interrupted, so the earlier **4/4** result remains the latest successful browser evidence. The normal production build was restored afterward. npm's offline uninstall could not resolve registry metadata, so a fresh `npm ci` after the lockfile edit remains unverified.

### Integration limits

The owner selected **isolated local workflow verification** for the CMS. The local environment has no CMS OAuth application or persistent content-source configuration. Browser tests use fake GitHub responses and encrypted fixture sessions; they do not establish real consent, token revocation, OAuth-authorized CMS API repository creation/writes, contribution-graph attribution, or hosted Vercel cache propagation. The separately authorized Git CLI migration and its read-back checks are recorded above; hosted acceptance remains pending in the release checklist.

The single-owner MVP protects per-file blob versions. Simultaneous writes to different interdependent files (for example deleting a category while another tab adds that category to a project) are not a repository-wide transaction and can require manual reference repair. Use one publishing tab for taxonomy changes; atomic multi-file publication remains deferred rather than implying that target-file SHA checks prevent every cross-file race.

No merge, production promotion, DNS/domain update, production-secret update, or live email test was performed. Current image delivery remains unoptimized. Real browser zoom, assistive technology, forced colors, real devices, field performance, and production indexing retain the limits below.

## Historical repository snapshot — 23 October 2026

This snapshot is superseded by the [PR #5 baseline](#pr-5-ci-baseline--25-october-2026) below.

- Local branch: `feat/portfolio-rework-phase-1`, at `112dcebc1a22f5d94fd592b829a155b8ba3c27cf`. A fresh remote-head read matched this commit.
- Remote `main`: `6a2c71db6627ee06648a642c64d9c7ac426dfc8f`.
- [PR #2](https://github.com/ervin-sungkono/Portfolio-Website-v2/pull/2) was read on this date: open, draft, unmerged, targeting `main`, with head `112dceb`.
- The 23 October working tree included the component-directory/CSS reorganization and related page/import changes, plus a temporary helper script. The reorganization was checked with typechecking, CSS lint, a production build, source-scoped formatting, and whitespace checks; these checks passed. The full formatting check still reports the pre-existing issue in unchanged `next.config.ts`. These checks do not replace browser, responsive, or accessibility coverage.
- `112dceb` disables image transformation globally with `images.unoptimized: true`. The former active-optimizer guidance and 10 October image results are no longer evidence of current delivery behavior.
- No current production-runtime, live-provider, Search Console, field-performance, or hosted image-usage inspection was performed. A source/PR read is not a deployment verification.

## Documentation consolidation — 23 October 2026

This pass read all seven previous `/docs` files and reconciled them into the three references above. Current behavior replaces the old design proposal and superseded findings. Useful dated audit/test evidence is retained below; obsolete prototype settings, repeated verification narratives, model/subagent logs, peer-site comparisons, and old live-site claims are removed. Earlier detail remains in Git history.

Only documentation checks apply to this pass: formatting of the three documents, README, and AGENTS; local Markdown file/fragment references; and whitespace checks on those files. Application builds, browser runs, audits, and provider tests are not rerun by a documentation cleanup. The historical results below must not be relabelled as fresh passes.

Documentation validation passed for all five edited Markdown files: Prettier, 22 local file/fragment references, and scoped Git whitespace checks. No repository references to the four removed document paths remained.

## PR #5 CI baseline — 25 October 2026

- [PR #5](https://github.com/ervin-sungkono/Portfolio-Website-v2/pull/5) had head branch `codex/github-portfolio-cms` at `23c876e0314c21031a7494db288814434208beb0` and targeted `dev`. GitHub Actions run [40186200820](https://github.com/ervin-sungkono/Portfolio-Website-v2/actions/runs/40186200820) passed for merge candidate `590072412f5debef855c71e2f86b7bb8e6964a73` built from that head. The successful run covered **32 unit tests, 26 public browser tests, and 4 CMS browser tests**.
- The follow-up release-readiness branch `codex/pr5-release-readiness` is based on that head and targets `codex/github-portfolio-cms`, not `dev`. The CI result above is the baseline before readiness changes; it does not establish hosted OAuth, content-repository writes, or cache propagation. Readiness implementation checks are recorded separately and are not part of this baseline.
- The current image path remains `images.unoptimized: true`. The `web-assets/master` migration is complete at `ce10d45`, with `legacy` at `3a62ce0`; hosted application cutover remains outstanding. No converter was rerun.

### Readiness environment inspection

- A clean `npm ci` with the final lockfile completed on Node.js 24.19.0/npm 11.9.0. The targeted lockfile update from `fast-uri` 3.1.8 to 3.1.9 is six lines; follow-up `npm audit` reported zero vulnerabilities. The earlier production-only audit also reported zero.
- A read-only Vercel inspection identified project `ervin-sungkono` (`team_ZOn3x1qeHsySyjQImCK5zKQE` / `prj_xo1e9d33R6A9NpZ9SgbjLo1vusEz`) on Node.js 24.x. Branch-filtered environment metadata for `codex/github-portfolio-cms` returned an empty `envs[]`; no secret values were read. The intended release target and domains still need owner confirmation.
- Hosted owner OAuth remains blocked on missing setup. No OAuth callback, CMS repository write, hosted cache propagation, hosted image transfer/cost review, live contact delivery, production indexing, or field-performance check is claimed. See the [hosted release checklist](architecture.md#hosted-release-checklist).

### Release-readiness checks — 25 October 2026

- The final-lock `npm ci` completed on Node.js 24.19.0/npm 11.9.0 and `npm audit` reported zero vulnerabilities after the targeted `fast-uri` update. The unit suite passed **33/33**; ESLint had zero errors and two existing warnings; Stylelint, TypeScript, and the production build passed. An initial sandbox build could not spawn `tsc` (`EPERM`); the supported rerun passed without a configuration change.
- The public browser suite passed **27/27**, including snapshot category ordering without JavaScript. The CMS browser suite passed **5/5**, including a project named `technologies` uploading and publishing with its cover, technology icon uploads, scope rejection with draft retention, and category reordering through the editor updating public filters without rebuilding. It also retains publication/404 recovery without JavaScript, unpublish/delete, private API restrictions, and the editor theme/reflow sweep. Two new test locators were corrected before the passing rerun.
- A fixture-only unavailable content-check response produced HTTP 503/no-store rather than a project 404. The ordinary snapshot production build was restored after the CMS suite. Whole-repository formatting, whitespace checks, and all 42 local Markdown file/fragment references passed.
- An additional local snapshot smoke sweep checked Home, About, Projects, WeTrack, Design, Contact, and missing-project recovery in both themes at 320, 390, 820, 1024, and 1440px: 70 samples had visible headings, keyboard focus, no horizontal overflow, and no page runtime errors. All 17 detail routes rendered their expected headings and canonical URLs without JavaScript; the sitemap kept `https://ervincs.com` URLs. External requests were aborted for this layout check, so artwork rendering and hosted delivery are outside its scope. Actual browser zoom and screen-reader acceptance remain pending.
- A read-only audit of `web-assets/master` at `ce10d45dc0200b5ff9c146a4f2c43e2b873171ad` (parent `3a62ce04163dfdc8d6e328df385ba538762555b9`, preserved on `legacy`) confirmed that all 17 published project documents, slugs, mappings, and source/demo string pairs match the application snapshot. The shared schemas validate the documents; all category and technology references resolve against the 3 categories and 33 technologies. All 25 WebP files have valid signatures and sizes at or below 1 MiB (1,509,318 bytes total). All 35 compatibility blobs (19 `images/`, 16 `icons/`) match exactly. Application profile, engineering, and project source files were unchanged, preserving existing attribution, CV, and `portfolioSourceRef`.
- Both commit author and committer are `Portfolio CMS <cms@portfolio.local>`. Direct raw-host GETs returned HTTP 200 for the sampled PNG-to-WebP pairs: WeTrack 127,411→79,308 bytes; ChatGPT 142,732→70,624; Next Pokedex 1,042,142→103,864; Frontend Mentor 225,309→93,456. These are raw payload sizes, not full-page or Vercel transfer measurements; destination-link currency and visual/pixel review were not assessed.
- Hosted OAuth and publishing remain pending. The content audit and browser results do not establish a hosted write, cache propagation, production image transfer, or production cutover.

## Public component split — 25 October 2026

From refreshed `origin/dev` at `87ca9cd`, reusable public links, cards, motion wrappers, and the theme control were organized under `src/components/common`. This was checked locally with Node.js 22.14: `npm ci`, typecheck, CSS lint, all 11 unit tests, whole-repository formatting, a production build using the documented dummy CAPTCHA key, the 25 existing Chromium browser tests, one new theme persistence/navigation browser test, and `git diff --check`. The first build paused after route generation with Next.js's security upgrade notice; an unchanged retry passed. CI's Node.js 24 run and deployed behavior remain separate evidence.

The browser suite does not establish full responsive or accessibility coverage. Next.js 16.4.0 reported a known security vulnerability; a dependency upgrade belongs in a separate reviewed change.

## Lint tooling — 25 October 2026

ESLint 10.13 uses the Next.js 16.4 Core Web Vitals and TypeScript configurations, with Prettier formatting rules disabled. It enforces LF endings, final newlines, and no repeated blank lines. The React `set-state-in-effect` rule is a warning while the current browser-state synchronization effects remain. Stylelint 17.16 uses the standard config and `@stylistic` LF/final-newline rules. Local checks with Node.js 22.14: ESLint completed with no errors and six warnings (three effect synchronizations and three unused identifiers/imports); CSS lint passed. Scoped Prettier checks and `git diff --check` passed. The warning on `src/app/about/page.tsx` is in the existing concurrent edit and was left untouched.

Installing ESLint 10 emitted peer-dependency override warnings because some plugins in `eslint-config-next` still declare peer support only through ESLint 9. The installed Next.js guide documents ESLint 10 compatibility and notes those plugin peer ranges may warn. A local `npm ci` attempt reached cleanup but Windows returned `EPERM` while unlinking Next's SWC binary; a follow-up `npm install` restored `node_modules`. A clean install on the CI runner remains unverified. Unit tests, typechecking, the build, and remote CI were not run for this tooling change.

## Repeatable checks

Use Node.js 24 and the committed lockfile. Setup and browser commands are in [README](../README.md#development).

| Command                    | Scope                                                                                                                          |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `npm run lint`             | ESLint with Next.js Core Web Vitals and TypeScript recommendations, LF/final-newline, and empty-line checks.                   |
| `npm run typecheck`        | Strict application TypeScript. The application tsconfig excludes `tests`.                                                      |
| `npm run lint:css`         | Stylelint across `src/**/*.css`, using `stylelint-config-standard` plus LF and final-newline rules from `@stylistic`.          |
| `npm test`                 | 32 unit/service tests covering contact, authentication, GitHub storage, and publishing/cache boundaries. Use Node.js 24.       |
| `npm run build`            | Production build and static route generation.                                                                                  |
| `npm run format:check`     | Whole-repository Prettier; use scoped checks for documentation-only changes when unrelated work is present.                    |
| `git diff --check`         | Whitespace in the relevant diff.                                                                                               |
| `npm run test:browser`     | 26 current Chromium regressions against a production build, not the dev server.                                                |
| `npm run test:cms:browser` | Isolated GitHub CMS production build and Chromium workflow; replaces `.next` with a fixture build. Rebuild normally afterward. |

`.github/workflows/checks.yml` installs Node.js 24/dependencies and runs formatting, ESLint, CSS lint, typechecking, unit tests, a dummy-CAPTCHA production build, Chromium installation, and browser tests on pull requests. This describes the current workflow definition; inspect an actual run before claiming remote CI passed.

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

The suite is focused regression coverage. It is not a complete responsive, accessibility, external-asset, or live-provider test suite. Broader checks below were separate dated reviews.

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

- **Hosted CMS acceptance:** complete the isolated preview OAuth, owner access, publish/unpublish/delete, stale-tab conflict, media, route-recovery, and observed cache-propagation checks in the [hosted release checklist](architecture.md#hosted-release-checklist). No hosted OAuth exchange, repository write, or Vercel cache propagation has been verified.
- **Application cutover:** the `web-assets/master` migration is complete at `ce10d45`, with `legacy` preserving `3a62ce0`; hosted application cutover remains outstanding. Do not rerun the removed converter. Keep compatibility paths and `legacy` until the cutover is accepted.
- **Images:** investigate the temporary optimizer bypass and revalidate before enabling transformations again. Check actual hosted delivery, original download sizes, cache behavior, and usage separately. Review the ChatGPT Clone hero crop when its image is supplied.
- **Manual accessibility:** NVDA/VoiceOver, actual browser zoom, real devices, and Windows forced-colors focus visibility remain unverified. Root-font enlargement and axe scans do not replace them.
- **Live contact:** a real CAPTCHA challenge, provider acceptance, and Gmail inbox receipt require an explicit user request and verified hostname/provider configuration. Automated tests must continue to avoid real email.
- **Dependencies:** the final-lock `npm ci` and audit passed with zero vulnerabilities after updating development dependency `fast-uri` from 3.1.8 to 3.1.9. Re-run the audit before release. The 11 October Stylelint/braces alerts are older findings.
- **Production release:** inspect the actual Vercel project/team, target branch/commit, runtime, domains/aliases, and environment-variable targets. The historical legacy runtime was Node.js 18; current production settings remain unverified. Production promotion, DNS changes, and production-secret changes require separate authorization.
- **Public outcomes:** confirm current source/demo/CV/remote-image links and social preview artwork on the authorized hosted release. Search Console submission/indexing, selected canonicals, rankings, field Core Web Vitals, and production image costs remain unverified.

Professional-content expansion remains deferred. GitHub CMS implementation and its current evidence are recorded above; live OAuth/staging publication and release verification remain separate work. No merge, production promotion, DNS change, or production-secret change is authorized by this documentation update.
