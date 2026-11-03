# Christian — Portfolio

Static site, no build step. Open `index.html` (or serve the folder).

```
index.html                page structure and content
css/styles.css            all styles; light/dark tokens at the top
js/main.js                loader, theme, header, smooth scroll, carousel, hero tilt, lanyard, tabs
js/chat.js                Gemini "AI twin" widget (change GEMINI_MODEL here)
js/vendor/lenis.min.js    smooth-scroll library (Lenis 1.3.27, MIT)
assets/images/projects    project GIFs + *-poster.jpg (shown when reduced motion is on)
```

## Behaviour
- **Theme:** monochrome black and white. Dark (black) by default; the header toggle switches to light (white) and remembers the choice. Only the project GIFs keep their own colors.
- **Loader:** counts to 100 on the first visit of each browser session, then lifts. Skipped with reduced motion.
- **Smooth scroll:** Lenis inertia scrolling; native scrolling with reduced motion.
- **Projects:** carousel with arrows, ← → keys, drag/swipe and the numbered list.

## Still to add (placeholders)
- `assets/images/avatar.png` — your portrait (a "C" monogram shows until then)
- `assets/cv.pdf` — the file behind "Download CV"
- Live Demo buttons (index.html, project slides): add `href="…" target="_blank" rel="noopener"` and delete `aria-disabled="true"`
- `christian@dev.ph` and the LinkedIn URL are the original placeholders — replace with your real ones
