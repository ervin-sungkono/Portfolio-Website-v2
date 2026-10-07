# Engineering Editorial — 10 October 2026

This pass changes presentation and browsing only. Existing professional facts, project walkthroughs, team credits, links, artwork, routes, and ervincs.com metadata remain the content foundation. Professional content expansion and CMS integration remain deferred.

## Visual language

Manrope remains the primary typeface. Display type ranges from 2.75rem to 5.5rem (44–88px at the default root size), while section headings range from 1.75rem to 3rem (28–48px). The homepage uses a bounded local display size that fits its two-column hero, with a smaller secondary statement. Body text remains 1rem with generous line height; metadata stays at 0.75rem. All sizes retain relative units and bounded fluid interpolation.

Soft white, deep charcoal, cobalt, pale blue, and cool gray establish the light palette. The existing charcoal dark theme uses restrained blue accents. The dedicated control-border token remains separate from decorative rules. Corner radii, spacing, full-frame screenshots, fine dividers, and editorial indexes repeat throughout the site. Modular images use cover cropping without letterboxing or inset padding; a 1rem overscan on each side of the moving screenshot plane prevents exposed edges during parallax. Detail screenshots use their natural aspect ratio without an empty inner mat. Reticle corner details connect image framing with the existing pointer identity.

## Page composition

- **Home:** the existing sticky/parallax introduction leads into an asymmetric five-part selected-work composition, followed by engineering panels, a vertical experience timeline, curated artwork, and a quiet contact close. DOM order remains meaningful when the work composition stacks.
- **Projects:** the first three existing projects form a featured area, followed by the remaining archive. GET search/category filters display the complete matching collection without duplicate featured entries.
- **Project details:** larger screenshot framing precedes separate overview, implementation/tradeoff, and supporting information areas. Existing case-study text and attribution are retained.
- **Engineering:** numbered evidence panels and grouped architecture boundaries provide a modular presentation. Native sticky introductions remain alongside scrolling content.
- **About:** introduction, experience, and existing skills have clear visual groups. Skill categories reorganize existing tools without adding capability claims.
- **Design:** three-column desktop browsing uses equal-width 4:3 cover frames and natural caption heights. Balanced two-card closing rows fill incomplete desktop compositions without changing reading order. Tablet uses two columns and phone uses one; artwork and category navigation remain unchanged.
- **Contact:** a restrained editorial introduction and the existing labelled form retain validation, focus management, and submission feedback.

## Interaction and responsive behavior

Native browser scrolling remains in control. Hero pinning and scroll-linked parallax retain their fit, height, and reduced-motion safeguards; fine-pointer/hover capability is now required as well. The two hero layers move at different speeds and reverse with scrolling. Continuous updates remain Motion values. The desktop cursor still uses direct pointer coordinates with no position spring or delay.

Entry reveals use a smaller 10px movement and a shorter 0.35-second duration. Content is visible in server HTML and keyboard focus completes a reveal. Decorative movement is removed for reduced motion. Hover feedback is restrained and responsive; there is no mandatory snapping, wheel interception, or artificial smooth scrolling.

Phone layouts follow a single-column reading order. Tablet galleries use balanced columns, and wider screens establish asymmetric compositions. The existing 48rem and 64rem content-fit thresholds remain; the homepage's five-part composition needs 70rem to maintain usable compact panels. Text enlargement, short viewports, coarse pointers, reduced motion, and no-JavaScript rendering preserve ordinary reading flow. The header can wrap its identity and controls into separate rows; a cleaned-up ResizeObserver shares its measured height with navigation limits and anchor/hero offsets. Evidence indexes stack above their text on phones, skill lists collapse when their labels need room, and long words can wrap without widening the page. Short-screen menu padding preserves space for focused links.

See [verification](verification.md) for the actual checks and their limits. Changes stay in `feat/portfolio-rework-phase-1` and draft PR #2; this pass does not release production.

A shared tsParticles connector background spans the full viewport across every normal route and remains behind the page throughout scrolling. Small, low-opacity dots and faint nearby lines move continuously without a normal-page pause button, as requested. Bounded counts, a slow speed, and existing opaque content surfaces keep the network secondary to the reading experience. Reduced motion and data saver omit the effect. The standalone viewport-height 404 retains its original bounded particles, quieter palette, gentle desktop repulsion, and accessible pause control; the shared field is removed while the 404 is present. See [responsive and motion](responsive-and-motion.md) for coverage and performance limits.
