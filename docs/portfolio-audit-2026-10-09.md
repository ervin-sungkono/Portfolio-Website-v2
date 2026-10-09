# Accessibility, SEO, and professional portfolio review

Reviewed 9 October 2026, Asia/Jakarta. The accessibility baseline is rework commit `5c13aeb`, with the SEO changes in this PR reviewed separately. The public site at `https://ervincs.com` still serves the legacy production application; it is not the rework preview.

## Remediation following this audit

The findings below describe the original audit. The rework now corrects the mobile navigation order and closes the disclosure when focus leaves the header. The hero link uses its visible caption as its accessible name. Contact and search inputs use a dedicated contrasting border token. Theme controls describe the destination theme, and project cards remove the redundant title/arrow links and give walkthrough/source actions project-specific names.

Fresh axe-core checks found zero automated violations on the same eight routes in both themes. Keyboard checks passed forward and reverse navigation, closing on focus exit, and Escape focus return at 390×600 and 390×320. Contact border contrast measures approximately 4.09:1 in light mode and 4.58:1 in dark mode against the form background. These checks do not establish complete WCAG conformance; the manual screen-reader and real-provider checks below remain outstanding.

The owner's full name is **Ervin Cahyadinata Sungkono**. Header, introduction, footer, profile schema, project credits, and metadata use that name. Shared application identity comes from `src/content/profile.ts`; the previous shortened-name alias has been removed. Existing account URLs remain valid. Responsive checks cover widths from 320 to 1440 px, including the mobile name wrapping. Professional-content recommendations have been deferred at the owner's request.

## Assessment

The rework presents a credible frontend software engineering portfolio: consistent typography and spacing, a clear specialism, project screenshots, readable source links, work history, and an engineering explanation. Its main weakness compared with established senior engineers' sites is the evidence behind the work. Visitors can see applications and technologies, but cannot yet reliably tell which parts Ervin personally owned, what constraints he solved, or what results he achieved.

Accessibility has a solid foundation but needs fixes before making a WCAG conformance claim. SEO foundations are now tailored to `ervincs.com` in the rework; the live legacy deployment still has outdated metadata and discovery URLs.

## Accessibility findings

| Priority | Finding and evidence                                                                                                                                                                                                                                                                                                                                                                         | Recommended improvement                                                                                                                                                                                                                                                                                                                                                             |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| High     | **Keyboard focus can be hidden by the mobile menu.** At 390×600, open the menu with Enter and continue pressing Tab. Focus leaves the toggle for the page instead of entering the navigation links; later the WeTrack “Read Walkthrough” and “Source” links are entirely covered by the open navigation panel. Escape works, but the obstruction remains until the visitor closes the panel. | Put the disclosure's toggle before its controlled navigation in the keyboard order. Keep menu links reachable immediately after opening. Close the disclosure when focus leaves it, or use a layout that cannot cover subsequent focus targets. A non-modal navigation disclosure does not need a modal focus trap. Recheck forward/reverse Tab, Escape, and zoom. See WCAG 2.4.11. |
| Medium   | **The hero link's accessible name does not contain all its visible label.** Axe flags `label-content-name-mismatch` in both themes. The visible caption includes “WeTrack” and “A workspace for getting things done.” The overriding `aria-label` substitutes different text.                                                                                                                | Let the visible caption name the link, or ensure the accessible name includes the complete visible label. Recheck speech input and the accessibility tree. See WCAG 2.5.3.                                                                                                                                                                                                          |
| Medium   | **Contact field boundaries have weak contrast.** The default border is `--line`: light `#dce1e8` against the form's `#fcfdff` is about 1.29:1; dark `#303640` against `#1b1e23` is about 1.37:1. Input fill contrast is also too subtle to clearly distinguish the editing areas.                                                                                                            | Add a dedicated control-border token with at least 3:1 contrast against the adjacent form background in both themes. Keep the softer token for decorative separators. Check empty, filled, invalid, and focused states. See WCAG 1.4.11; this is a manual contrast finding, not an axe text-contrast violation.                                                                     |
| Low      | **Theme changes are not described in the button name.** “Switch color theme” stays the same after switching.                                                                                                                                                                                                                                                                                 | Use an action label such as “Switch to light theme” / “Switch to dark theme,” or a consistently named toggle with its pressed state. This is a usability improvement, not a confirmed conformance failure.                                                                                                                                                                          |
| Low      | **Project cards repeat destinations and generic action names.** Image, title, arrow, and details each lead to the same project; “Source” and “Read Walkthrough” repeat across the collection.                                                                                                                                                                                                | Reduce repeated keyboard stops and include the project name in action names where useful. Keep source links separate from the primary project link and avoid nested anchors.                                                                                                                                                                                                        |

Relevant code: `src/components/header.tsx`, `src/components/header.module.css`, `src/app/page.tsx`, `src/styles/globals.css`, and `src/components/project-card.tsx`.

### What the checks support

- Axe-core **4.14.0** ran WCAG 2/2.1 A and AA plus WCAG 2.2 AA tagged checks on eight routes in both themes. It reported one unique rule violation, on the homepage in each theme; the other seven sampled routes had no automated violations. Automated results do not cover all criteria.
- The first Tab reaches the skip link, which moves focus to `main`. Mobile Escape closes the navigation and returns focus to its button.
- Eight sampled routes had no horizontal document overflow at a 320 CSS pixel viewport, with 200% root-font enlargement, or with WCAG text-spacing overrides. These are distinct checks; root-font enlargement is not actual browser zoom, and absence of overflow alone does not prove that every element is unclipped.
- Contact validation focuses the first invalid field. All four errors are associated through `aria-describedby`, and fields expose `aria-invalid`. Submission status has a polite, atomic live region. No real message was sent.
- Decorative cursor/progress elements are hidden from assistive technology. Native pointer behavior remains available. Reduced-motion preferences disable cursor effects and scroll transforms; content is server-rendered and does not depend on reveal animations for visibility.
- No page runtime errors occurred during the sampled local audit.

Still needed: NVDA and VoiceOver testing; real browser zoom and device checks; focus visibility with Windows forced colors; and the real reCAPTCHA challenge/contact receipt flow. A source review or axe result cannot replace these checks. Project artwork was served from the original local asset checkout during layout tests; Dribbble requests were blocked. Missing design images in those screenshots are a test fixture limitation, not proof of a production defect.

## SEO findings and implemented changes

| Area                  | Live production finding                                                                                                                                                                                               | Rework status                                                                                                                                                                            |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public identity       | Home, About, Projects, and Contact repeat a description presenting Ervin as a BINUS student.                                                                                                                          | Updated descriptions use current software engineering facts, with distinct summaries for each route.                                                                                     |
| Domain consistency    | `og:url`, robots.txt, and the sitemap index still reference `ervin-sungkono.vercel.app`. No canonical link was found in the sampled production HTML. The old homepage alias redirects to `ervincs.com` with HTTP 308. | One public origin, `https://ervincs.com`, now controls canonical links, social URLs, robots.txt, and all 23 sitemap entries. A stale `SITE_URL` environment variable cannot override it. |
| Crawlable content     | Sampled production HTML contains no visible body text or headings; content depends on JavaScript rendering. This is a dependency, not proof Google cannot index it.                                                   | All 23 public routes expose content and one H1 with JavaScript disabled.                                                                                                                 |
| Social previews       | Production metadata is outdated; rework collection pages previously inherited the home social title/description.                                                                                                      | Page-specific Open Graph and Twitter titles/descriptions now match their page metadata, with absolute image URLs.                                                                        |
| Profile identity      | No JSON-LD was found in sampled production or the previous preview.                                                                                                                                                   | About now includes ProfilePage/Person JSON-LD using the displayed profile facts and public social profiles. Rich-result display is not guaranteed.                                       |
| Routes and exclusions | The legacy deployment returns 404 for `/engineering` and `/project/wetrack-app` because those are rework routes.                                                                                                      | All public rework routes respond 200. Unknown project slugs respond 404 with `noindex`. Search/category URLs canonicalize to their collection.                                           |
| Preview indexing      | Rework previews return `X-Robots-Tag: noindex`.                                                                                                                                                                       | This is appropriate for previews. Do not remove preview protection to improve production discoverability. Verify production headers after release.                                       |

Homepage search title:

> Ervin Cahyadinata Sungkono | Frontend Software Engineer

Homepage description:

> Ervin Cahyadinata Sungkono, software engineer at Samsung R&D Institute Indonesia. Explore React and Next.js projects, frontend case studies, and interface design.

Local verification passed for 23 public routes and two filtered URLs: correct canonical host and social URL, unique public-page titles/descriptions, matching social metadata, server-visible content, parsed profile schema, a complete sitemap, and correct unknown-project handling. Production build, strict TypeScript, formatting, and Git whitespace checks passed. SEO changes add no client-side dependencies.

### Remaining SEO work

1. Release the reviewed rework so the public domain serves these improvements; a preview update does not change the live legacy site.
2. Verify the `ervincs.com` Search Console property, submit its sitemap, inspect representative URLs, and confirm Google's selected canonicals. Actual indexing, queries, impressions, and ranking were not available in this audit.
3. Add specific, original case-study content that matches frontend engineering queries. Name and role discovery are sensible initial goals; broad terms such as “software engineer” are much more competitive.
4. Refresh the inherited social preview artwork to match the new branding. Validate remote images and key demo/source/CV links on the hosted release.
5. Measure mobile Core Web Vitals using field data when available, with Lighthouse/PageSpeed lab checks to diagnose issues. No performance or ranking score is claimed here.

Google can choose a snippet from visible content instead of the meta description. Metadata helps identify and summarize pages; it cannot guarantee a ranking position.

## Comparison with established engineers' sites

Reference sites were reviewed as examples of how engineers communicate their work, not as a representative market sample or a comparison of career seniority. Their experience and adoption claims are self-reported on their sites; their accessibility was not audited here.

| Reference                                      | Strong professional signal                                                                                                                           | What to adapt                                                                                                                        |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| [Brittany Chiang](https://brittanychiang.com/) | Specific work responsibilities, named shipped products, leadership context, selected projects with visible adoption evidence, and technical writing. | Describe personal ownership and results directly in experience/project summaries. Keep the curated homepage focused.                 |
| [Tania Rascia](https://www.taniarascia.com/)   | Technical direction and design-system experience, substantial original writing, and project links that connect explanation, demo, and source.        | Add a few excellent technical write-ups, with working examples and source links. Quality matters more than maintaining a large blog. |
| [Josh W. Comeau](https://www.joshwcomeau.com/) | Detailed explanations and interactive demonstrations that let visitors inspect technical understanding.                                              | Create one focused interactive engineering demonstration with a documented implementation, rather than adding decoration alone.      |

### Recommended professional improvements, in order

1. **Document personal contribution in the three featured projects.** Include role, team size, dates, constraints, work owned, implementation choices, alternatives considered, validation performed, and verified results. WeTrack credits its team but does not separate individual ownership. Label retrospective analysis separately from original decisions, as the site already does.
2. **Replace generic experience summaries with factual contributions.** The Samsung entry currently repeats the role/company. Add publicly shareable responsibilities and examples. For senior positioning, include technical direction, review, mentoring, reliability, and coordination only where these reflect real work. Confidential work can be described without disclosing code or private metrics.
3. **Show validation evidence.** Include representative tests, accessibility decisions, error recovery, performance measurements with device/method/date, and maintenance history. Use measured outcomes where available; an honest qualitative result is preferable to invented percentages.
4. **Curate the archive.** Keep the strongest three projects prominent; label older coursework, clones, and experiments clearly in the archive. Add project status and “last verified” dates. Educational projects can demonstrate ability when they explain an original engineering challenge.
5. **Publish one distinctive engineering artifact.** A small public component library with keyboard behavior, tokens, tests, documentation, and a versioning example would support the current frontend/design-system direction. Start with a focused reusable implementation; a complex platform or CMS is not necessary for this goal.
6. **Tighten presentation and copy.** Use consistent terminology such as Next.js; shorten generic headings where a concrete result would be more useful; consider increasing the 12px secondary labels to 14px for comfortable scanning. The 12px labels are not automatically a WCAG failure. Confirm CV currency and provide a dependable contact fallback.
7. **Add a short “Engineering notes” collection when useful.** Two or three original explanations of rendering decisions, streaming failure recovery, or accessible components would strengthen the portfolio and add substantive searchable content. Avoid an empty blog section.

The design is already a good foundation for a professional frontend portfolio. To communicate senior-level capability more strongly, the next investment should be evidence of ownership, judgment, and outcomes.

## Primary guidance

- [WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- [Focus not obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html)
- [Label in name](https://www.w3.org/WAI/WCAG22/Understanding/label-in-name.html)
- [Non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)
- [Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html)
- [Google canonical URL guidance](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)
- [Google meta description guidance](https://developers.google.com/search/docs/appearance/snippet)
- [Google JavaScript SEO basics](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics)
- [Google ProfilePage guidance](https://developers.google.com/search/docs/appearance/structured-data/profile-page)
