# Prototype — homepage reference

`index.html` is a self-contained, approved design prototype of the new homepage.
It is a **reference for implementation**, not production code. Open it directly in a browser.

## What it contains
- **Hero panel** snapped to a 24px grid (SVG grid pattern with `+` markers).
  - 5 black rows on top, then a grid + animated dither section (first/last row without dither) with the wordmark, headline and role line, then 2 grid-only rows.
  - **Dither**: WebGL fragment shader, simplex-noise domain-warped field, lit by a slope term, quantised per grid square into 5 levels and rendered with an 8×8 Bayer matrix.
  - **Glitch**: periodic horizontal slice shift of wordmark + field.
  - **Role line**: "Currently Technical Consultant" expands on hover/tap to "– Innovation at Centric Software".
  - **BUILD** (commit hash link) and **DEBUG** toggle locked into 5-square grid blocks; DEBUG persists in `localStorage` and shows live LCP / INP / CLS / FPS (FCP tracked, not shown) with flickering values.
- **About**: dithered hard-edged quotation mark, scroll-driven word-by-word reveal, inline LinkedIn/GitHub links that reveal a brand icon on hover.
- **Footer**: Privacy Policy (placeholder link), `COPYRIGHT 0x7EA` that scrambles to the decimal year on hover.
- Respects `prefers-reduced-motion`.

## Known shortcuts to fix in the real build
- Fonts (Inter, Geist Mono) load from Google Fonts → must be **self-hosted** (GDPR).
- Build hash `804a7e6` is hard-coded → inject at build time.
- Privacy Policy link is a placeholder (`#privacy`).
- HUD status-line mechanism exists with an empty `lines` array (intentionally off for now).
- Contains leftover experiment code (image drag-and-drop background mode) that can be dropped.
