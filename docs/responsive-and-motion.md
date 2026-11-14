# Responsive layout, accessibility, and motion

This document records behavior implemented in the UI. For component ownership see [architecture](architecture.md#code-boundaries); for automated coverage and known limits see [verification](verification.md#repeatable-checks).

## Visual system and layout

`src/styles/globals.css` owns shared color, typography, spacing, controls, focus, and layout tokens. It defines the light/dark theme and shared page/container primitives. Route and component details remain in their colocated CSS or CSS Modules. Keep the existing design system and use content-driven responsive sizing rather than isolated device-specific overrides.

The public container is capped at 75rem. Global layout breakpoints include 48rem and 64rem; components can add thresholds for actual content fit. Project and design collections use responsive bento cards with frosted surfaces and one destination per card. The project search uses a native GET form that floats below the header, hides while scrolling down, and reappears on upward scroll or keyboard focus; it remains usable without client scripting. Check the full name, headings, cards, controls, and navigation under narrow widths and enlarged text.

## Accessibility and input

Preserve skip navigation, landmarks, heading order, keyboard access, visible focus, sufficient contrast, and accessible names that include visible labels. Project cards use the shared outer focus outline so their images cannot cover it. Mobile navigation is a disclosure: its toggle precedes links, Escape closes it and returns focus, leaving the header closes it, and short screens can scroll the links into view. It is not a modal and must not trap focus.

The cursor enhancement is limited to fine pointers with hover and is decorative/hidden from assistive technology; native cursor behavior remains the fallback. Theme controls describe the destination theme. Forms retain labels, associated errors/live status, first-invalid-field focus, duplicate-submit protection, and draft values after failure. The CMS uses a separate responsive dashboard with tables for projects and taxonomy, image grids, an inline site-profile wizard, and staged editing dialogs. Its shared select uses a labeled keyboard-operable combobox and listbox. See [GitHub CMS](architecture.md#github-cms) for storage and submission semantics.

At desktop widths of 64rem or more and heights of 44rem or more, the CMS fills the viewport. Tables and the inline site-profile step have their own scroll areas, while the profile navigation and actions remain outside the step body. Draft actions are in the header. Narrower or shorter viewports retain page scrolling so content remains reachable.

## Motion

Decorative transitions and scroll-linked effects respect `prefers-reduced-motion`. Keep content visible in server-rendered markup without JavaScript. Continuous pointer and scroll values should avoid per-frame React state. Clean up event listeners, media queries, observers, timers, animation frames, and motion engines.

On mobile, the navigation toggle morphs from three bars into a close icon. Its panel scales in before links appear in sequence; keyboard focus exposes a link immediately, and reduced motion removes the transitions.

The home hero fades and moves project slides vertically, with a subtle scroll-linked parallax on the visual. In the desktop fine-pointer/no-preference context, each mouse-wheel gesture scrolls smoothly to the adjacent slide in that direction; ordinary page scrolling resumes beyond the first and last slides. The focusable carousel supports arrow, Home, and End keys and announces its position. Touch/coarse-pointer, short-viewport, reduced-motion, and no-JavaScript contexts use a native horizontal scroll area so every project remains reachable; reduced motion avoids smooth scrolling.

The homepage eyebrow uses a one-time typewriter reveal without changing its text or accessible name. The experience timeline draws an accent line as it enters view on eligible desktop screens. Project and design entries use short staggered reveals; design artwork also uses the existing bounded pointer tilt, leaving captions and links stationary. All of these retain visible server-rendered content without JavaScript and respect reduced motion.

The About introduction pairs its smaller headline with a decorative chip and stylus sculpture. Three.js is loaded only when the artwork is near the viewport and motion is allowed. The scene and its orbital rings move gently and support horizontal pointer dragging with damped momentum; vertical touch scrolling remains available. The decorative artwork is not a keyboard control. It pauses when off-screen or the document is hidden, caps rendering at 30 frames per second and pixel ratio at 1.25, batches the repeated chip pins, and disposes GPU resources on unmount. The static image captured from the initial scene remains visible without JavaScript, under reduced motion, or if WebGL cannot start. The native grab cursor is restored over the interactive artwork.

Project imagery uses bounded parallax only in its supported contexts. The desktop cursor position uses direct Motion values without springs or artificial delay; image tilt may use separate spring motion. Form controls use the custom cursor on eligible desktop pointers, while editable content, disabled controls, and ordinary-flow contexts retain native cursor behavior. Keep wheel interception limited to one slide per gesture and preserve natural scrolling past the first and last slides.

## Review contexts

For UI changes, check keyboard navigation, both themes, 320/390/820/1024/1440 CSS pixel widths, text enlargement/reflow, reduced motion, and relevant pointer/input fallbacks. Automated browser and axe checks are focused regressions; they do not establish WCAG conformance. Screen readers, actual browser zoom, forced colors, and real devices need manual checks when release confidence requires them.
