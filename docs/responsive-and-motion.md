# Responsive layout and motion

## Guidance

- [MDN: responsive design](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/CSS_layout/Responsive_Design).
- [web.dev: typography](https://web.dev/learn/design/typography) and [macro layouts](https://web.dev/learn/design/macro-layouts).
- [WCAG 2.2: reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html) and [minimum target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html).
- [Motion: scroll animations](https://motion.dev/docs/react-scroll-animations), [springs](https://motion.dev/docs/react-use-spring), and [accessibility](https://motion.dev/docs/react-accessibility).
- [MDN: scroll snap type](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/scroll-snap-type) and [scroll padding](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/scroll-padding-top).

These sources establish principles, not one mandatory set of breakpoints or font sizes. The following scale is this portfolio's content-fit decision.

## Sizing system

`src/styles/globals.css` owns shared tokens. Spacing uses a 0.25rem base rhythm (4px at the default root size), with named multiples. Type sizes are 0.75rem for metadata, 0.875rem for controls, 1rem for body/input text, 1.25rem for titles, and 1.5rem for small headings. The root font size is not fixed. Text measure uses `ch`, line heights are unitless, and images retain intrinsic dimensions/aspect ratios.

Fluid tokens interpolate between a 20rem and 80rem viewport, then stop at defined bounds. At a default 16px root:

| Token           | Narrow endpoint | Wide endpoint |
| --------------- | --------------- | ------------- |
| Display heading | 2rem / 32px     | 4rem / 64px   |
| Section heading | 1.5rem / 24px   | 2.5rem / 40px |
| Page gutter     | 1rem / 16px     | 3rem / 48px   |
| Section spacing | 3rem / 48px     | 5rem / 80px   |
| Layout gap      | 1.5rem / 24px   | 3rem / 48px   |

For example, a display heading grows 32px over a 960px viewport interval. The slope `32 / 960` gives `3.3333vw`; the intercept is 21.333px or `1.3333rem`. The resulting rule is `clamp(2rem, 1.3333rem + 3.3333vw, 4rem)`. Other fluid tokens use the same endpoint calculation. Text never relies on viewport units alone.

## Layout thresholds

The default stacks content. At 48rem, project/design galleries have room for two usable columns, roughly 20rem each after gutters and a gap. At 64rem, the hero, contact form, and full navigation have enough room for their content. Tablet portrait keeps the hero stacked. The container caps at 75rem. These choices respond to content width rather than detecting a particular device.

Long headings and project names wrap when necessary; flex/grid children can shrink. Header and anchor offsets share a height token. Mobile navigation scrolls within the dynamic viewport height. The header uses the original square favicon artwork instead of shrinking a logo containing a second name. Mobile hero actions use a full-width primary action followed by a CV/GitHub row.

Primary buttons, icon buttons, filters, and standalone text links have a minimum 2.75rem height (44px by default), exceeding WCAG's 24px minimum for these controls. Borders and visually hidden clipping retain pixel values; ordinary type and spacing use the shared relative scale.

## Motion boundaries

Motion 14 supplies small Client Components in `src/components/motion`. Pages continue to render content on the server and pass it into these islands.

- `Reveal` runs a short transform/opacity animation once when content enters the viewport. Server HTML stays visible without JavaScript. Keyboard focus completes running reveals; reduced-motion mode skips them.
- `PointerSurface` applies bounded spring tilt to imagery for a mouse with fine pointer/hover capability at desktop width. Coordinates update springs rather than React state, and pointer exit returns the image to neutral.
- `MotionEnhancements` provides scroll progress and loads the cursor component only when pointer and motion preferences allow it.
- `DesktopCursor` adds a four-corner reticle, diamond-shaped link feedback, contextual project label, and press feedback. Pointer coordinates update plain Motion values directly, without springs, interpolation, or movement delays. It preserves the native cursor, ignores hit testing, hides over text inputs or outside the document, and cleans up event listeners. React state changes only for hover mode.

Touch input and reduced-motion preferences disable cursor and tilt effects. No looping decorative animation or scroll hijacking is used. See verification notes for responsive and interaction checks.

## Section snapping

Home, About, engineering, and project detail pages opt in with `snap-sections`. The root scroll container uses native `scroll-snap-type: y proximity`. Direct section children and the footer are snap targets; nested walkthrough content remains freely scrollable. There are no wheel/touch interception handlers, mandatory stops, full-screen section heights, or additional scroll containers.

The existing `--anchor-offset` sets root scroll padding so targets settle below the sticky header. Section targets reset their scroll margin to avoid counting that offset twice; nested heading/hash destinations keep their existing margins. Project/design collections and the contact form do not opt in. Reduced-motion preferences turn snapping off. Native browser snapping remains available without JavaScript.
