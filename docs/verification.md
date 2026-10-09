# Phase 1 verification

## Accessibility audit and ervincs.com metadata — 9 October 2026

- See [the detailed accessibility, SEO, and professional review](portfolio-audit-2026-10-09.md) for evidence, remaining defects, and scope limits. Fresh axe-core 4.14.0 testing found a homepage label-in-name violation in both themes; keyboard review found focus obscured by the open mobile navigation. These results supersede earlier clean automated reports for the affected behavior.
- The public origin is now defined once as `https://ervincs.com`. All 23 public routes have distinct titles/descriptions, matching Open Graph/Twitter metadata, and canonical URLs on that domain. About contains ProfilePage/Person JSON-LD using existing public profile facts.
- Production build, strict TypeScript, formatting, and Git whitespace checks passed. A JavaScript-disabled browser verified metadata and visible content on all 23 public routes, two filtered collection URLs, sitemap and robots consistency, and unknown-project 404/noindex behavior.
- React review: metadata remains in Server Components and one typed shared function; no new client dependencies or effects were added. JSON-LD serialization escapes `<`, and structured data contains existing public facts rather than inferred achievements.
- The SEO code is in the rework branch. Production at `ervincs.com` still serves legacy metadata until a production release. Preview `noindex` headers are expected. Search Console indexing, real screen-reader use, field Core Web Vitals, and email receipt were not verified.

## Sticky hero and scroll-linked parallax — 9 October 2026 (Asia/Jakarta)

- Section snap rules and page markers were removed. Production build, strict TypeScript, formatting, and Git whitespace passed; no new dependencies or backend changes were needed.
- Chromium checked 8 routes at 320, 390, 820, 1024, and 1440 px without horizontal overflow or runtime/hydration errors. All routes retained native scrolling with no snap type.
- At 1440×1000, the hero's stage stayed at the same 76px position while scrolling from 180px to 380px. The visual translated from about -12px to -34px and scaled from 1.010 to 1.029 while copy moved separately. Scrolling back restored the earlier transform, and further scrolling released the stage. Project image transforms changed with their viewport progress.
- Checked sticky experience introductions, keyboard footer access/focus, walkthrough anchor visibility, phone navigation, arbitrary mobile scroll positions, and tablet/short-height fallbacks. At 200% root-font enlargement the hero declined to pin, keeping tall content accessible. This simulates text enlargement, not browser zoom.
- Reduced-motion changes removed pinning and parallax transforms. With JavaScript disabled, content stayed visible in normal flow and no extra scroll travel was reserved. Cursor behaviour was not modified.
- Reviewed desktop hero frames at two scroll positions and the phone layout. Local project image responses used the original files from the owner's `web-assets` repository. Dribbble image requests were blocked; these checks do not establish remote asset availability. No fresh axe audit was run for this focused change; previous accessibility results remain dated below.
- React quality review: small client wrappers receive server-rendered content, continuous scroll updates use Motion values, resize/media observers clean up, and the browser retains control of scrolling. Fit measurement protects oversized hero content; the existing layout thresholds and rem spacing scale govern eligibility and travel.

## Section snapping and immediate cursor update — 8 October 2026

- Production build, strict TypeScript, formatting, and Git whitespace passed. No dependencies or backend changes were needed.
- Chromium checked 8 routes at 320, 390, 820, and 1440 px with no horizontal overflow or browser runtime errors. Native wheel scrolling settled at a section target below the sticky header; the target offset is counted once.
- Keyboard Home/End reached the beginning and footer. A mobile touch-capable context snapped near the next section and retained arbitrary scroll positions within its long project section. Walkthrough hash links stayed visible below the header. Navigation from Home to the project collection disabled snapping; collections and contact keep normal scrolling.
- The four-corner cursor matched exact pointer coordinates on the next animation frame at several positions, including viewport edges, without introducing horizontal overflow. Checked link diamond, project label, immediate press feedback, and hiding over inputs. The native cursor is preserved.
- Reduced-motion changes disabled snapping and unmounted the custom cursor; touch did not mount it. Snapping and visible content remained available with JavaScript disabled.
- Visually reviewed desktop project and link cursor states. Remote project and Dribbble image requests were blocked for these interaction checks because the previous local asset checkout was unavailable; this update does not verify remote artwork loading. Earlier accessibility results are historical; a fresh axe audit was not run for this focused change.
- React quality review retained focused client boundaries, direct Motion values for pointer updates, passive pointer listeners with cleanup, and CSS-only snapping without wheel interception.

## Responsive layout and motion update — 8 October 2026

- Production build, strict TypeScript, all 5 contact tests, formatting, and Git whitespace passed.
- Chromium checked 8 routes (home, About, projects, designs, engineering, contact, WeTrack, and ChatGPT Clone) at 320, 360, 390, 430, 600, 767, 768, 820, 1023, 1024, 1280, and 1440 px. No horizontal overflow. Each route also passed a 200% root-font enlargement check at 390 px; this is a text-enlargement simulation, not a browser zoom test.
- Axe-core found zero WCAG 2 A/AA, WCAG 2.1 AA, or WCAG 2.2 AA violations on those routes in both themes. Automated checks do not establish full conformance.
- Checked the mobile square logo and clearance from controls, primary action followed by a CV/GitHub row, tablet stacked hero, desktop columns, minimum 44px primary action height, mobile Escape/focus return, and touch navigation with menu closing.
- Desktop spring cursor displays its contextual project label and imagery responds to pointer tilt. Entry reveals complete after scrolling. Reduced-motion changes remove the cursor, and touch input never mounts it. Server-rendered content remains visible with JavaScript disabled. No browser runtime or hydration errors remained in the production build.
- Visually reviewed phone, tablet, desktop, and cursor/tilt screenshots. Project artwork used the original local asset files as a network workaround; Dribbble requests were blocked. These checks establish layout and interaction behaviour, not remote artwork availability.
- React and Web Interface Guidelines review: focused Client Components receive server-rendered children, continuous pointer movement updates Motion values, desktop cursor code loads on demand, media/event listeners clean up, native links and cursor remain usable, and reduced-motion preferences disable decorative effects. Shared tokens and content-fit media queries govern layout; see [responsive layout and motion](responsive-and-motion.md) for source guidance and calculations.

## Engineering showcase update — 8 October 2026

- Production build, strict TypeScript, all 5 existing contact tests, formatting, and Git whitespace passed.
- Chromium checked home, About, projects, engineering, all 3 featured walkthroughs, and an unannotated mobile project at widths 320, 390, 768, 1024, and 1440 px. No horizontal overflow or runtime errors.
- Axe-core reported no WCAG 2 A/AA or WCAG 2.1 AA violations on those 8 routes in light and dark themes, after theme transitions settled.
- Checked capability-to-walkthrough navigation, hash anchors clearing the sticky header, mobile Engineering navigation and menu closing, related project cards, project-specific Open Graph metadata, search and empty-state recovery, the engineering sitemap entry, and unknown-project 404 responses.
- Visually reviewed the desktop homepage and mobile engineering page. Local project screenshots used the original asset files as a network workaround. Local Dribbble image requests were blocked during layout review; this update does not independently verify those remote assets. Hosted remote loading needs a separate check.
- React and Web Interface Guidelines review: new content remains server-rendered, hooks remain in existing interactive components, links use native navigation semantics, headings and icons have accessible markup, CSS uses shared theme tokens and responsive grids, and no dependencies were added.
- Walkthrough features were checked against the public WeTrack and ChatGPT Clone READMEs and Next Pokedex repository description. Tradeoffs and proposed next validation steps are labelled as analysis; no measured performance improvements or individual team contributions are asserted.
- The contact integration was not changed. Real Gmail receipt remains unverified; the preview hostname must be authorised in reCAPTCHA before a real-message test.

## Initial rework — 7 October 2026

Checked on 7 October 2026 with Node.js 24 and Next.js 16.4.0.

- Production build: passed; 17 generated project pages plus all original public routes.
- Strict TypeScript: passed.
- Contact validation tests: 5 passed (normalisation, malformed fields, email/header injection, boundaries, plain-text formatting).
- Formatting and Git whitespace: passed.
- Chromium browser: no runtime errors across home, About, projects, designs, contact, and WeTrack detail at 320, 390, 768, and 1440 px. No horizontal overflow.
- Automated accessibility: axe-core WCAG 2 A/AA and WCAG 2.1 AA checks found no violations across six pages in both light and dark themes. This is not a substitute for manual assistive-technology testing.
- Theme: toggle and persistence passed.
- Mobile navigation: open, Escape close, keyboard focus return, and route navigation passed.
- Collections: project search, empty state, clear filters, all 17 entries, and mobile design category passed.
- Contact: required-field feedback and first-error focus passed. Actual unconfigured API response preserved the draft. Mocked successful API response cleared the draft.
- API: malformed input, honeypot, cross-origin requests, unsupported content type, and requests exceeding 16 KiB rejected.

Local rendering could not fetch GitHub raw images through this environment’s DNS. Screenshot review substituted the exact image files from the owner’s cloned `web-assets` repository; production code continues using the original public URLs. Dribbble artwork used its original CDN; remote image loading remains subject to the execution environment’s network restrictions. This substitution checks layout, not remote-host availability.

A mocked successful form response does not verify Gmail delivery. No real message was sent. Existing Gmail and reCAPTCHA environment keys were inspected by name only, without reading their values. Final hostname registration and end-to-end email receipt require a production-readiness check.
