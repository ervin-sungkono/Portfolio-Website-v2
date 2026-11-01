# Verification and remaining work

Updated for the GitHub and Dribbble CMS refactor on **1 November 2026 (Asia/Jakarta)**. This document separates current repository observations from historical application checks. [Architecture](architecture.md) owns implementation/operations; [UI behavior](responsive-and-motion.md) owns presentation and interaction rules.

## GitHub and Dribbble CMS refactor — 1 November 2026

- Node.js 24.22.1 application and test typechecks, Stylelint, and **72/72** Vitest unit and handler integration tests passed. ESLint completed with no errors and three effect-synchronization warnings, including the existing contact warning. Checks cover PAT/OAuth identity matching, rejected legacy sessions, missing/revoked credentials, strict version-2 schemas, duplicate and inaccessible repository mappings, Dribbble pagination/errors, selection writes, and commit-before-invalidation recovery.
- The isolated CMS production build passed, followed by **6/6 Chromium workflows** and **2/2 HTTP checks** with simulated GitHub/Dribbble responses and encrypted test sessions. They cover project publication, image upload, design show/hide and public refresh, preservation/removal of unavailable IDs, and private repository disclosure, draft-preserving refresh, mapping save, and invalidation-only retry. The import and design controls were checked in both themes at 320, 390, 820, 1024, and 1440 px, with keyboard interaction and 200% root-font reflow samples. The initial import check found narrow-screen overflow; loading the shared editor styles resolved it before the passing run.
- A separate production build read the newly published public content with a simulated PAT identity and empty Dribbble response. The **30/30 public Chromium regressions** passed against that build. The CMS fixture tests, rather than this public suite, exercised actual design-card rendering with simulated shots. The initial sandbox build failed with Windows `EPERM` while creating `.next` output; the successful build and browser checks ran outside that sandbox. Contact delivery remained mocked.
- Whole-repository Prettier and Git whitespace checks passed; all **35** local Markdown links and fragments in the maintained guidance resolved. No local clean `npm ci` was run. A read-only npm audit reported **17 moderate advisories** across all dependencies and **zero** when development dependencies were omitted.
- Initial remote [CI run 41309616533](https://github.com/ervin-sungkono/Portfolio-Website-v2/actions/runs/41309616533) passed a clean install and checks through the production build, but its public browser suite exposed overflow from Google's 256px inline reCAPTCHA badge at 320px and 200% root font in both themes. Centering the badge keeps it visible; the responsive test now simulates that fixed-width badge. A parallax timing assertion that passed only on retry was also changed to wait for the midpoint paint. A follow-up isolated development-server run passed **12/12** affected responsive and parallax checks; an actual inline badge was also inspected locally at the failing size.
- Remote [CI run 41310663862](https://github.com/ervin-sungkono/Portfolio-Website-v2/actions/runs/41310663862) passed for code head `c9bce967ab911b7a53c78b4f5402e93e6031cb83`. Its logs show the clean install, formatting, lint, typechecks, production build, **72** unit/integration tests, **30** public browser tests, **6** CMS browser tests, and **2** HTTP checks. This verification note was added after that run.
- The authorized `web-assets/master` update is [`fac7bf3b0e595017fff282c1a64aa76d889a0ceb`](https://github.com/ervin-sungkono/web-assets/commit/fac7bf3b0e595017fff282c1a64aa76d889a0ceb), a fast-forward from `3d29efddf7e7cc08b9f042d36d6639159f9d5b38`. Both commit identities are `Portfolio CMS <cms@portfolio.local>`. The unchanged `legacy` branch remains at `3a62ce04163dfdc8d6e328df385ba538762555b9`.
- Read-back fetched all **22** JSON documents at the exact new commit. The remote tree's **83** blob hashes matched the reviewed local tree; schema and reference validation passed for all **17** projects, and all **25** referenced image files passed the server's byte checks. The 17 GitHub repository IDs match the reviewed legacy ID-to-slug mapping and GitHub source repositories; all **16** selected Dribbble IDs and their order, other project/portfolio facts including `portfolioSourceRef`, and all **35** compatibility `images/` and `icons/` blobs were preserved.
- No real OAuth consent, Dribbble API call, authenticated CMS publication, hosted ISR propagation, or deployment was exercised: local PAT and Dribbble credentials were not configured. The schema change on `master` is intentionally not backward compatible; an already-running reader expecting version 1 may fail after refreshing until the application is updated. Clarification is still needed on whether saving shot IDs and ISR responses complies with [Dribbble's API terms](https://developer.dribbble.com/terms/). The stacked follow-up application branches need their own integration review.

## CSS-module colocation — 1 November 2026

Component-specific CSS modules were moved beside their components and named `style.module.css`; route-owned modules remain beside their routes. The in-progress 404 folder move was retained, with the required Next.js boundary restored as a thin entry. The project proxy uses the same `/not-found` document, so no separate project-recovery page is required.

- Node.js 24.22.1 app and test typechecks passed; the app check used `tsc --noEmit --incremental false`. Vitest passed **56/56**, CSS lint passed, and ESLint completed with the existing contact-form effect warning. The isolated production build fetched the public GitHub content and passed.
- The previously stopped localhost server was started with a dummy CAPTCHA key. **27/27** existing Playwright checks passed against `localhost:3000` before the later recovery-route change. After that change, **5/5** focused checks passed: project and global 404s without JavaScript, the noindexed shared recovery page, a valid project, and JavaScript hydration without a route mismatch. The missing-project response retained HTTP 404, `noindex`, and `no-store`; a HEAD request returned the same headers. Contact requests were mocked.
- After the recovery-route change, the isolated CMS fixture passed **3/3** browser workflows and **2/2** HTTP checks, including publishing a previously missing project without a rebuild.
- Before the later recovery-route change, a reconstructed baseline repaired the already-renamed module imports and 404 entries in an isolated copy. A browser comparison of computed styles and geometry found no differences across **90** route, theme, and viewport combinations; **6** hero/artwork hover comparisons also matched. Images and CAPTCHA were stubbed for these comparisons. These checks are not real-device, assistive-technology, actual browser-zoom, or full visual-conformance testing.

## Component, test, and remote content refactor — 31 October 2026

The work used the existing `codex/github-portfolio-cms` working tree, retaining the already modified homepage, Experience content, and `next-env.d.ts`. After the owner clarified that `web-assets` is the content source, the temporary local data relocation was removed. Profile, skills, designs, walkthroughs, project records, and homepage data now come from the separate repository; project proxy recovery and the two-slide homepage presentation remain in place.

- Added [`content/portfolio.json`](https://github.com/ervin-sungkono/web-assets/blob/master/content/portfolio.json) in commit [`27274d0`](https://github.com/ervin-sungkono/web-assets/commit/27274d0d864ca66866b326f5d48c26f3e9dcd692) and the 17-slug [`content/project-index.json`](https://github.com/ervin-sungkono/web-assets/blob/master/content/project-index.json) in commit [`3d29efd`](https://github.com/ervin-sungkono/web-assets/commit/3d29efddf7e7cc08b9f042d36d6639159f9d5b38). Existing content and compatibility assets were not overwritten. The previously documented `portfolioSourceRef` value and team credits were retained.
- Node.js 24.22.1 application and test typechecks passed. Vitest passed **56/56** unit and handler integration checks. CSS lint passed; ESLint passed with one existing contact-effect warning. No fresh clean `npm ci` was run while the development server was using the installed dependencies.
- Against the existing `localhost:3000` server, **27/27** public Chromium regressions passed using installed Chrome. These include both themes, six public routes at 320, 390, 820, 1024, and 1440px, keyboard focus, 200% root-font samples at 320 and 820px, short-screen navigation, reduced-motion and JavaScript-disabled cases. Contact/CAPTCHA requests were mocked. Root-font enlargement is not browser zoom.
- An isolated production build fetched the real public repository and prerendered the homepage, about/contact pages, and existing project paths. A separate fixture production build passed **3/3** CMS browser journeys and **2/2** HTTP tests with simulated GitHub storage and encrypted fixture sessions. The browser flow verifies an external portfolio edit stays cached until owner refresh, then appears without rebuilding; it also covers project publication, index synchronization, prior 404 recovery, unpublish, and delete. Neither build replaced the running server's `.next` directory.
- The unauthenticated GitHub REST core limit was exhausted during the local check; the public reader now uses the commit feed and immutable raw files instead. Real GitHub OAuth publishing and hosted cache propagation remain unverified. No remote CI, real email delivery, real-device, screen-reader, forced-colors, or actual browser-zoom verification is claimed.

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
- Final whole-repository Prettier and Git whitespace checks passed. All **29 local Markdown file/fragment references** in README, AGENTS, and the three owning documents resolved. No remote CI result is claimed.

### CMS component organization follow-up — 25 October 2026

The editor's six flat child component files were reorganized into `CategoriesPanel/`, `CmsMessage/`, `ImagesPanel/`, `ProjectPanel/`, `SiteProfilePanel/`, and `TechnologiesPanel/`, each with `index.tsx`, `type.ts`, and `style.css`. Shared form styles remain at the editor level; panel-specific rules are colocated and scoped. Component props and editor state types now live in type files. This changes organization and style ownership, not publishing behavior.

Fresh Node.js 24 checks for this refactor passed TypeScript, scoped ESLint, scoped Stylelint, formatting, the isolated production build, and all **4 CMS browser tests**, including the five-width/both-theme/reflow/keyboard sweep. The ordinary non-fixture build was restored afterward. Earlier public-suite and unit results above are not claimed as reruns for this structural change.

### Migration dry-run against public source

The then-available one-off read-only command `npm run cms:migrate-web-assets -- --source ervin-sungkono/web-assets --branch master --dry-run --output ./migration-output` succeeded under Node.js 24.22.1 against source commit **`3a62ce04163dfdc8d6e328df385ba538762555b9`**. It reported `canWrite: true`, **zero errors, missing metadata, or invalid references**, 17 confirmed existing slug mappings, 4 Frontend Mentor challenge entries retained in the aggregate project's report/gallery, 25 optimized raster images, and 46 proposed output files. The `All` filter, legacy SVG icons, and two unreferenced images were reported as skipped. Repository creation years are explicitly recorded as proxies because legacy JSON has no year field.

Dry-run wrote neither a bundle nor a report file and did not mutate GitHub. At the time, migration-specific tests also checked staging/overwrite rejection and source preservation; those tests and the one-off tool were removed after publication. The command and its output are historical evidence, not a currently available npm script.

### Authorized web-assets publication

The owner subsequently requested writing the migration to `web-assets/master` and preserving the old master tree on a new `legacy` branch, then explicitly chose to retain compatibility asset URLs during cutover. The final validated bundle was regenerated from a local clone of the captured source and repository creation metadata read through GitHub after unauthenticated REST requests hit the rate limit.

- At that time [`master`](https://github.com/ervin-sungkono/web-assets/tree/master) pointed to migration commit [`ce10d45dc0200b5ff9c146a4f2c43e2b873171ad`](https://github.com/ervin-sungkono/web-assets/commit/ce10d45dc0200b5ff9c146a4f2c43e2b873171ad), whose parent is the original `3a62ce0` commit. Later content commits are recorded above.
- [`legacy`](https://github.com/ervin-sungkono/web-assets/tree/legacy) points exactly to **`3a62ce04163dfdc8d6e328df385ba538762555b9`**, preserving the complete prior tree and history. Both refs were updated by one atomic push with explicit expected-head checks.
- GitHub confirmed both author and committer as **`Portfolio CMS <cms@portfolio.local>`**. The old `data/` JSON is available on `legacy`; the 35 old `images/` and `icons/` files remain unchanged on `master`. Git object comparison confirmed no differences in either compatibility directory.
- The new master tree has **81 files**: the 46 generated README/content/media files plus 35 compatibility assets. It includes 17 project JSON documents and 25 optimized raster images. README records the numeric-ID → slug audit mapping and rollback guidance.
- Read-back validation fetched all 20 published JSON documents, compared their bytes to the reviewed bundle, parsed shared Zod schemas, and verified all 25 referenced images with the server's reference/signature/size checks. An existing `master/images/WeTrack-App.png` URL returned HTTP 200 with identical bytes.

The application deployment and OAuth configuration were not changed. Keep the compatibility paths and `legacy` branch until that cutover has been separately verified. Roll back by reviewing and reverting the migration commit, or restoring the prior reader to `legacy`; do not blindly reset a branch containing later publications. Actual rollback execution remains untested.

### Mapping guide and cleanup — 25 October 2026

After the authorized publication and read-back checks, the one-off `scripts/migrate-web-assets.ts` CLI, its `src/lib/cms/migration.ts` conversion module, and six utility-specific tests were removed. No application runtime imports depended on them. [The Markdown guide](web-assets-migration-agent.md) instructs an LLM agent to compare the read-only `legacy` source with existing `master`, map facts to the shared Zod schemas, and report unresolved fields before any separately authorized edits. No repository content or CMS runtime behavior changed in this cleanup.

After cleanup, the Node.js 24 unit/service suite passed **32/32**, strict TypeScript passed, and the normal production build passed with the `server-only` package absent from `node_modules`; Next.js continues to resolve the source boundary markers. Scoped Prettier, package/lock dependency-map consistency, and `git diff --check` passed. A CMS browser-suite retry completed its fixture build but produced no test results and had no Node or Chromium process left; it was interrupted, so the earlier **4/4** result remains the latest successful browser evidence. The normal production build was restored afterward. npm's offline uninstall could not resolve registry metadata, so a fresh `npm ci` after the lockfile edit remains unverified.

### Integration limits

The owner selected **isolated local workflow verification** for the CMS. The local environment has no CMS OAuth application or persistent content-source configuration. Browser tests use fake GitHub responses and encrypted fixture sessions; they do not establish real consent, token revocation, OAuth-authorized CMS API repository creation/writes, contribution-graph attribution, or hosted Vercel cache propagation. The separately authorized Git CLI migration and its read-back checks are recorded above.

The single-owner MVP protects per-file blob versions. Simultaneous writes to different interdependent files (for example deleting a category while another tab adds that category to a project) are not a repository-wide transaction and can require manual reference repair. Use one publishing tab for taxonomy changes; atomic multi-file publication remains deferred rather than implying that target-file SHA checks prevent every cross-file race.

No merge, production promotion, DNS/domain update, production-secret update, or live email test was performed. Current image delivery remains unoptimized. Real browser zoom, assistive technology, forced colors, real devices, field performance, and production indexing retain the limits below.

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

## Lint tooling — 25 October 2026

ESLint 10.13 uses the Next.js 16.4 Core Web Vitals and TypeScript configurations, with Prettier formatting rules disabled. It enforces LF endings, final newlines, and no repeated blank lines. The React `set-state-in-effect` rule is a warning while the current browser-state synchronization effects remain. Stylelint 17.16 uses the standard config and `@stylistic` LF/final-newline rules. Local checks with Node.js 22.14: ESLint completed with no errors and six warnings (three effect synchronizations and three unused identifiers/imports); CSS lint passed. Scoped Prettier checks and `git diff --check` passed. The warning on `src/app/about/page.tsx` is in the existing concurrent edit and was left untouched.

Installing ESLint 10 emitted peer-dependency override warnings because some plugins in `eslint-config-next` still declare peer support only through ESLint 9. The installed Next.js guide documents ESLint 10 compatibility and notes those plugin peer ranges may warn. A local `npm ci` attempt reached cleanup but Windows returned `EPERM` while unlinking Next's SWC binary; a follow-up `npm install` restored `node_modules`. A clean install on the CI runner remains unverified. Unit tests, typechecking, the build, and remote CI were not run for this tooling change.

## Repeatable checks

Use Node.js 24 and the committed lockfile. Setup and browser commands are in [README](../README.md#development).

| Command                     | Scope                                                                                                                                                             |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run lint`              | ESLint with Next.js Core Web Vitals and TypeScript recommendations, LF/final-newline, and empty-line checks.                                                      |
| `npm run typecheck`         | Strict application TypeScript. The application tsconfig excludes `tests`.                                                                                         |
| `npm run typecheck:tests`   | Strict TypeScript for the test files.                                                                                                                             |
| `npm run lint:css`          | Stylelint across `src/**/*.css`, using `stylelint-config-standard` plus LF and final-newline rules from `@stylistic`.                                             |
| `npm test`                  | Vitest unit and handler integration tests covering content, motion, contact, authentication, storage, and publishing.                                             |
| `npm run build`             | Production build and static route generation; public GitHub content requires configured server-side source credentials, or the documented read-only test fixture. |
| `npm run format:check`      | Whole-repository Prettier; use scoped checks for documentation-only changes when unrelated work is present.                                                       |
| `git diff --check`          | Whitespace in the relevant diff.                                                                                                                                  |
| `npm run test:browser`      | Public Chromium regressions against a production build.                                                                                                           |
| `npm run test:live`         | Public Chromium regressions against an existing localhost:3000 server; contact requests are mocked.                                                               |
| `npm run test:cms:browser`  | Isolated GitHub CMS production build and browser workflow; replaces `.next` with a fixture build.                                                                 |
| `npm run test:http:fixture` | Production HTTP checks against the isolated fixture server; replaces `.next` with a fixture build.                                                                |
| `npm run test:cms:fixture`  | Runs the CMS browser and HTTP fixture checks together.                                                                                                            |

`.github/workflows/checks.yml` installs Node.js 24/dependencies and runs formatting, ESLint, CSS lint, application/test typechecking, Vitest, a dummy-CAPTCHA production build, Chromium installation, and the public and CMS fixture tests on pull requests. This describes the current workflow definition; inspect an actual run before claiming remote CI passed.

### Browser suite coverage

| Spec in `tests/e2e/public` | Cases | Coverage                                                                                                                                                                |
| -------------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `contact.spec.ts`          | 3     | Pending CAPTCHA/read-only fields, one submission snapshot, draft retention on failure, clearing on mocked success.                                                      |
| `project-routes.spec.ts`   | 2     | Known project rendering and unknown-project 404/noindex recovery without JavaScript.                                                                                    |
| `cursor.spec.ts`           | 9     | Raw pointer/frame geometry, clearance and shape changes, rendered contrast, nested targets, reflow/removal, native fallbacks, reduced motion, touch, and no JavaScript. |
| `parallax.spec.ts`         | 9     | Hero crossfade/reverse scroll, fixed target geometry, travel/coverage, focus hold, reduced motion, coarse pointers, oversized/narrow/short contexts, and no JavaScript. |
| `theme.spec.ts`            | 1     | Theme destination label and persisted selection across public navigation.                                                                                               |
| `responsive.spec.ts`       | 3     | Both themes, five widths, keyboard focus, 200% root-font reflow, and short-screen mobile-menu access.                                                                   |

The production browser server uses `127.0.0.1:3103` and does not reuse an existing server. The documented public fixture simulates the GitHub identity and Dribbble responses while reading the live public content tree. The live configuration targets an existing localhost server. Form tests mock CAPTCHA/delivery; the offline Nodemailer test uses JSON transport. The fixture HTTP tests cover large Unicode payloads, request limits, origin checks, and CMS authorization. These tests do not send real email. The public dummy CAPTCHA key must be present at build time for the fixture suites; rebuild without test fixtures and with the real public key before any deployment that needs live CAPTCHA.

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

- **Browser coverage:** repeat focused checks for later edits; the recorded local Chromium runs do not establish full accessibility conformance or real-device behavior.
- **Images:** investigate the temporary optimizer bypass and revalidate before enabling transformations again. Check actual hosted delivery, original download sizes, cache behavior, and usage separately. Review the ChatGPT Clone hero crop when its image is supplied.
- **Manual accessibility:** NVDA/VoiceOver, actual browser zoom, real devices, and Windows forced-colors focus visibility remain unverified. Root-font enlargement and axe scans do not replace them.
- **Live contact:** a real CAPTCHA challenge, provider acceptance, and Gmail inbox receipt require an explicit user request and verified hostname/provider configuration. Automated tests must continue to avoid real email.
- **Dependencies:** review the 17 moderate development-dependency advisories reported on 1 November before release; the production-only audit reported zero. Avoid unrelated dependency upgrades in the CMS refactor.
- **Release environment:** verify Vercel project/team, target commit/branch, runtime, public CAPTCHA build key, and preview/production headers. The historical legacy runtime was Node.js 18; current production settings need inspection.
- **Public outcomes:** confirm current source/demo/CV/remote-image links and social preview artwork on the authorized hosted release. Search Console submission/indexing, selected canonicals, rankings, field Core Web Vitals, and production image costs remain unverified.

Professional-content expansion remains deferred. GitHub CMS implementation and its current evidence are recorded above; live OAuth/staging publication and release verification remain separate work. No merge, production promotion, DNS change, or production-secret change is authorized by this documentation update.
