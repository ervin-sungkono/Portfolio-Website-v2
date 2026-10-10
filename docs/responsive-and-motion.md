# Responsive layout and motion

## Guidance

- [MDN: responsive design](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/CSS_layout/Responsive_Design).
- [web.dev: typography](https://web.dev/learn/design/typography) and [macro layouts](https://web.dev/learn/design/macro-layouts).
- [WCAG 2.2: reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html) and [minimum target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html).
- [Motion: scroll animations](https://motion.dev/docs/react-scroll-animations), [springs](https://motion.dev/docs/react-use-spring), and [accessibility](https://motion.dev/docs/react-accessibility).
- [Motion: element scroll progress](https://motion.dev/docs/react-use-scroll) and [MDN: sticky positioning](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/position).

These sources establish principles, not one mandatory set of breakpoints or font sizes. The following scale is this portfolio's content-fit decision.

## Sizing system

`src/styles/globals.css` owns shared tokens. Spacing uses a 0.25rem base rhythm (4px at the default root size), with named multiples. Type sizes are 0.75rem for metadata, 0.875rem for controls, 1rem for body/input text, 1.25rem for titles, and 1.5rem for small headings. The root font size is not fixed. Text measure uses `ch`, line heights are unitless, and images retain intrinsic dimensions/aspect ratios.

Fluid tokens interpolate between a 20rem and 80rem viewport, then stop at defined bounds. At a default 16px root:

| Token           | Narrow endpoint | Wide endpoint |
| --------------- | --------------- | ------------- |
| Display heading | 2.75rem / 44px  | 5.5rem / 88px |
| Section heading | 1.75rem / 28px  | 3rem / 48px   |
| Page gutter     | 1rem / 16px     | 3rem / 48px   |
| Section spacing | 3.5rem / 56px   | 6rem / 96px   |
| Layout gap      | 1.5rem / 24px   | 3rem / 48px   |

For example, a display heading grows 44px over a 960px viewport interval. The slope `44 / 960` gives `4.5833vw`; the intercept is 29.333px or `1.8333rem`. The resulting rule is `clamp(2.75rem, 1.8333rem + 4.5833vw, 5.5rem)`. The two-column homepage hero uses its own bounded 44–68px scale to preserve its composition. Other fluid tokens use the same endpoint calculation. Text never relies on viewport units alone.

## Layout thresholds

The default stacks content. At 48rem, project/design galleries have room for two usable columns, roughly 20rem each after gutters and a gap. At 64rem, the hero, contact form, and full navigation have enough room for their content. Tablet portrait keeps the hero stacked. Project featured work, archives/results, and the Design gallery use three columns at 64rem. Tablet featured work places a full-width lead card above its supporting pair. Design closes partial desktop rows with balanced pairs: a remainder of two fills one row; a remainder of one redistributes the last four into two pair rows. This keeps DOM order and 4:3 cover frames without dense packing or fixed caption heights. The container caps at 75rem. These choices respond to content width rather than detecting a particular device.

Long headings and project names wrap when necessary; flex/grid children can shrink. Header and anchor offsets share a nominal height token, with the actual header height measured by a cleaned-up ResizeObserver when JavaScript is available. This keeps wrapped controls, the menu viewport, and sticky/anchor offsets aligned during text enlargement. Mobile navigation scrolls within the dynamic viewport height. The header uses the original square favicon artwork instead of shrinking a logo containing a second name. Mobile hero actions use a full-width primary action followed by a CV/GitHub row.

Primary buttons, icon buttons, filters, and standalone text links have a minimum 2.75rem height (44px by default), exceeding WCAG's 24px minimum for these controls. Borders and visually hidden clipping retain pixel values; ordinary type and spacing use the shared relative scale.

## Motion boundaries

Motion 14 supplies small Client Components in `src/components/motion`. Pages continue to render content on the server and pass it into these islands.

- `Reveal` runs a 0.35-second transform/opacity animation with 10px travel once when content enters the viewport. Server HTML stays visible without JavaScript. Keyboard focus completes running reveals; reduced-motion mode skips them.
- `PointerSurface` applies bounded spring tilt to imagery for a mouse with fine pointer/hover capability at desktop width. Coordinates update springs rather than React state, and pointer exit returns the image to neutral.
- `MotionEnhancements` provides scroll progress and loads the cursor component only when pointer and motion preferences allow it.
- `DesktopCursor` adds a four-corner reticle, diamond-shaped link feedback, contextual project label, and press feedback. Pointer coordinates update plain Motion values directly, without springs, interpolation, or movement delays. It preserves the native cursor, ignores hit testing, hides over text inputs or outside the document, and cleans up event listeners. React state changes only for hover mode.

Touch input and reduced-motion preferences disable cursor and tilt effects. Main-page motion avoids looping decorative animation and scroll hijacking. The standalone particle 404 has an explicit pause/resume control. See verification notes for responsive and interaction checks.

## Scroll scenes and parallax

Section snapping has been removed. Scrolling remains native, with no wheel interception, artificial smoothing, or nearest-section settling.

`ScrollHero` holds the desktop hero below the header while its text rises by up to 1rem and its visual rises by up to 3rem with a 4% scale increase. Motion's element scroll progress drives those transforms directly; scrolling backwards reverses them. The scene reserves one viewport for reading plus half a viewport of scroll travel, then the hero releases into the page. Content stays fully opaque and all links remain interactive.

`ParallaxImage` moves project screenshots from 1rem below to 1rem above their natural position while they pass through the viewport. The image plane extends 1rem above and below the frame while parallax is enabled, accommodating that travel without blank edges. Modular screenshots use cover cropping without inset padding; touch, reduced-motion, and no-JavaScript layouts use the ordinary full-frame plane. Hover tilt and scroll translation belong to separate nested elements so their transforms compose. Experience and engineering introductions use native sticky positioning alongside their scrolling content.

A shared media hook enables scroll motion only at the existing 64rem desktop width, at least 48rem viewport height, with fine-pointer/hover capability, and with no reduced-motion preference. The height threshold leaves room for the existing type and spacing; the hero also measures whether its actual content fits below the header. Oversized content, including enlarged text, disables hero pinning. Resize and media observers clean up. Motion values handle scroll updates without React state on each frame.

Phone/tablet layouts, short viewports, reduced-motion mode, and no-JavaScript rendering use the ordinary stacked layout with no reserved scroll scene. Server-rendered content stays visible. The direct reticle cursor continues to track pointer movement without spring lag.

## Particle accents

`ParticleAccent` dynamically imports the tsParticles 4.4 engine, basic circle/movement features, interactivity, and repulse plugin. It does not load the full library or a React adapter. Reduced motion and data saver skip engine loading; changing reduced motion destroys an active field. Canvas content is decorative and hidden from assistive technology, and pointer detection never captures clicks or obscures links.

The homepage uses 12 small, low-opacity particles in a 6rem × 20rem side-margin region. It requires at least 90rem width, 48rem height, a fine hover pointer, and measured side space. The region is outside the headline and project image, with a fading mask. A 20fps cap and 4.5-second settle timer prevent a continuous distraction; theme changes retain the settled state and render a static frame in the new palette. Resize/theme/media observers and the timer clean up.

The 404 restores the original standalone composition without header/footer chrome. Its section uses a dynamic-viewport minimum height and can grow for short screens/enlarged content. It uses up to 56 particles on larger fine-pointer screens and 24 elsewhere, capped at 30fps with retina scaling disabled. Gentle hover repulsion is enabled only for the former. There are no connection lines, click spawning, or unbounded particle counts. Pause/resume is keyboard accessible, hidden tabs pause, and navigation destroys the engine instance.
