# Visual system, responsive layout, and motion

Reviewed against the blog feature on **28 October 2026 (Asia/Jakarta)**. This is the current UI reference for the visual system, responsive layout, accessibility, and motion behavior. Application boundaries are in [architecture](architecture.md); dated checks and unresolved validation are in [verification](verification.md).

## Visual system

The Engineering Editorial presentation uses Manrope, strong heading hierarchy, cobalt accents, neutral light/dark surfaces, fine dividers, editorial indexes, and repeated image framing. Professional facts, artwork, team credits, routes, and links remain the content foundation.

`src/styles/globals.css` owns shared tokens. The root font size is not fixed. Ordinary spacing uses a 0.25rem rhythm, text uses relative units, line heights are unitless, and text measure uses `ch`. Metadata is 0.75rem, small/control text 0.875rem, body/input text 1rem, titles 1.25rem, and small headings 1.5rem. A separate `--control-border` token distinguishes controls from softer decorative borders in both themes.

Fluid values interpolate from a 20rem to 80rem viewport and stop at bounded endpoints:

| Token           | Narrow endpoint | Wide endpoint |
| --------------- | --------------- | ------------- |
| Display heading | 2.75rem         | 5.5rem        |
| Section heading | 1.75rem         | 3rem          |
| Page gutter     | 1rem            | 3rem          |
| Section spacing | 3.5rem          | 6rem          |
| Layout gap      | 1.5rem          | 3rem          |

For example, the display heading is `clamp(2.75rem, 1.8333rem + 4.5833vw, 5.5rem)`: it grows 44px over the 960px interval at a default 16px root. The homepage hero uses a local 44–68px bounded scale to fit its two-column composition. Text never relies on viewport units alone.

Modular screenshots use proportional cover cropping without inset padding or letterboxing. Detail screenshots keep their natural aspect ratio so visitors can inspect the complete interface. Moving image planes include overscan; their outer links, captions, and focus indicators remain stationary on selected homepage surfaces.

## Page composition and layout

| Surface         | Current composition                                                                                                           |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Home            | Sticky project-preview hero, selected project grid, experience timeline, curated artwork, and contact close.                  |
| Projects        | Three featured entries plus the remaining archive; GET filters search the whole collection without duplicates.                |
| Project details | Natural-ratio screenshot, overview, documented implementation/tradeoffs, attribution, and related projects.                   |
| About           | Profile introduction, experience timeline, and grouped existing skills.                                                       |
| Design          | Equal-width 4:3 cover frames with natural caption heights and balanced closing rows.                                          |
| Contact         | Editorial introduction and the labelled form with validation and status feedback.                                             |
| Blog            | Published article cards, one column on narrow screens and two columns from 48rem; an empty state when no posts are published. |
| Blog post       | Article title, summary, author, date, and readable Markdown in a centered 70ch body column.                                   |
| Not found       | Standalone viewport-height recovery page.                                                                                     |

The container caps at **75rem**. Layout starts stacked and uses content-fit thresholds:

- At **48rem**, galleries have room for two columns. Tablet featured projects use a full-width lead above the supporting pair.
- At **48rem**, the blog archive switches from one column to two; smaller screens retain the single-column reading order.
- At **64rem**, galleries use three columns and the hero, full navigation, and contact layout can use wider compositions. Tablet portrait keeps the hero stacked.
- The homepage's asymmetric selected-work composition starts at **70rem** so compact panels retain usable width.
- In the desktop Design grid, a remainder of two fills a wider pair; a remainder of one redistributes the last four entries into two pair rows. DOM order remains intact, without dense packing or fixed caption heights.

Headings, full-name branding, and project names wrap; flex/grid children can shrink. Phone evidence indexes stack above copy, skills collapse when labels need room, and hero actions use a full-width primary action followed by a CV/GitHub row. These are content constraints rather than device detection.

The header shares its measured height through a cleaned-up ResizeObserver, with a nominal token as fallback. Hero pinning, anchor offsets, and mobile-menu height use that measurement. The square favicon artwork avoids a second tiny name inside the logo. Short-screen menus scroll within dynamic viewport limits and retain clearance for focused links.

## Accessibility and input

Preserve skip navigation, landmarks, heading order, keyboard access, visible focus, meaningful image alternatives, and accessible names containing visible labels. Primary controls, icon buttons, filters, and standalone text links have a minimum 2.75rem height (44px at the default root size).

Mobile navigation is a disclosure. Its toggle precedes its links in DOM and visual order; Escape closes it and returns focus to the toggle; focus leaving the header closes it. It does not use a modal focus trap. All links must remain reachable on short screens and with enlarged text.

Theme labels describe the destination action and theme choice persists. Project actions include the project name and avoid redundant title/arrow links. Form fields retain associated labels, `aria-describedby` errors, first-error focus, polite status, and drafts on failure. Submission details live in [architecture](architecture.md#contact-integration).

For UI changes, exercise both themes and keyboard navigation at **320, 390, 820, 1024, and 1440px**, plus text enlargement/reflow, short viewports, coarse pointers, reduced motion, and no JavaScript. Root-font enlargement is distinct from actual browser zoom. Automated results do not establish full accessibility conformance.

## CMS editor

The owner workspace uses the existing rem tokens and themes, native labelled controls, wrapping navigation buttons, and content-fit grids. Projects, blog posts, site profile, categories, technologies, and images are structured forms with shared Zod validation. Blog body text is Markdown in a labelled textarea. Invalid fields expose associated messages and receive first-error focus; publish/upload operations prevent duplicates and retain drafts after failure. Dirty drafts retain their originally loaded blob SHA across refreshes. Explicit conflict reload discards only the selected editor section. The workspace adds no decorative motion, modal focus trap, or wheel handling. Check [blog verification](verification.md#blog-feature--28-october-2026) before inferring coverage for the new editor section.

## Motion boundaries

Native scrolling controls the document. There is no section snapping, wheel interception, artificial scroll smoothing, or nearest-section settling. Motion remains an enhancement over visible server HTML. Motion components are colocated under `src/components/<Component>/`; see [code boundaries](architecture.md#code-boundaries).

| Component            | Behavior and boundary                                                                                                                                 |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Reveal`             | One entry animation: 10px travel over 0.35 seconds. Focus completes an active reveal; reduced motion skips it. Content is visible without JavaScript. |
| `PointerSurface`     | Bounded image tilt up to 4 degrees, using springs for a desktop mouse with fine-pointer/hover capability. Pointer exit/cancel returns to neutral.     |
| `MotionEnhancements` | Scroll progress and conditional cursor loading at 64rem or wider, with fine pointer/hover and no reduced-motion preference.                           |
| `ScrollHero`         | Desktop content-fit sticky scene with a reversible project crossfade.                                                                                 |
| `ParallaxImage`      | Bounded image-only travel inside a clipped frame, with matching overscan.                                                                             |
| `DesktopCursor`      | Direct pointer tracking and decorative framing of hovered interactive controls.                                                                       |

Keep continuous pointer/scroll values out of React state. Discrete state may select a project, focus hold, or motion eligibility. Clean up media subscriptions, observers, listeners, animation frames, and engine instances.

## Hero crossfade and image parallax

`src/lib/motion/use-scroll-motion.ts` enables scroll motion only with **at least 64rem width, 48rem height, fine pointer, hover, and no reduced-motion preference**. `ScrollHero` additionally measures whether its content fits below the header. The eligible scene reserves one viewport for reading plus half a viewport of scroll travel, then releases into normal flow.

The hero crossfades **WeTrack into ChatGPT Clone**. The latter still uses an explicit placeholder awaiting the owner's image. Image, project name, caption, and native destination fade together between **20% and 80%** of scene progress; the active project switches at the midpoint. Copy, frame geometry, and actions stay stationary. There is no hero image translation, scroll scale, whole-link hover lift, or whole-link tilt. Reverse scrolling reverses the fade.

Only one preview is interactive and exposed to assistive technology: the other is inert, `aria-hidden`, and excluded from pointer interaction. Keyboard focus holds its project fully visible until focus leaves, including if motion eligibility changes. Otherwise, phone/tablet, coarse-pointer, short/oversized, reduced-motion, and no-JavaScript contexts use the first preview in ordinary flow without reserved scroll travel.

| Image surface                                                    | Travel                             |
| ---------------------------------------------------------------- | ---------------------------------- |
| Homepage lead project                                            | ±1.5rem.                           |
| Two supporting homepage projects                                 | ±1rem, retained after crop review. |
| One homepage AudioWaves artwork preview                          | ±1.5rem.                           |
| Archive, filtered, and related-project cards                     | Shared default ±1rem.              |
| Other homepage artwork, full Design grid, and detail screenshots | Static.                            |

Each moving plane extends its travel distance above and below the frame: a frame of height `H` with ±`d` travel needs a plane of `H + 2d`. Overscan also crops content, so review both endpoints for technical UI, lettering, and focal subjects before increasing travel. The selected homepage project cards omit whole-link tilt. Readable copy, navigation, filters, forms, and feedback do not receive scroll transforms. The experience introduction's native sticky behavior remains independent of these effects.

## Desktop cursor

On eligible desktop fine-pointer/hover screens, the idle cursor has an **8px plus** inside a **32px four-corner reticle**. Hovering an enabled interactive target changes the center into a **12px ring with a dot** and frames the target **8px outside each edge**. That gap is decorative and does not enlarge the hit area. Leaving restores the pointer-centered reticle.

The center follows raw pointer Motion values without interpolation, position springs, or delayed movement. Shape changes take 140ms; target-frame morphs take 160ms. A requestAnimationFrame loop follows live target geometry while hovered or completing a transition, with scroll/resize refreshes and cleanup. Continuous coordinates do not enter React state.

The native cursor is hidden only while the replacement is active. Text-entry fields, contenteditable regions, disabled controls, iframes, pointer exit/cancel, window blur, document hiding, reduced motion, and cleanup restore it. Small/coarse-pointer and no-JavaScript contexts retain native interaction. The overlay cannot capture clicks and is hidden from assistive technology. The `html` background token keeps difference blending visible against the isolated body's painted background in both themes.

Historical browser coverage and the limits of fixture-based image reviews are recorded once in [verification](verification.md). Bounded engine settings are safeguards rather than measured battery, accessibility, or field-performance results.
