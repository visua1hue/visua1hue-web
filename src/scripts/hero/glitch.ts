import type { GlitchSlice } from "@scripts/webgl/dither";
import { CELL } from "./layout";

/**
 * Every few seconds, shifts one horizontal band of the wordmark (an SVG copy,
 * clipped) and the same band of the dither field (shader uniform) sideways.
 */
export function createGlitch(hero: HTMLElement, logo: HTMLElement, slice: HTMLElement) {
  let until = 0;
  let next = 4;
  let band: GlitchSlice = { y0: 0, y1: 0, shift: 0 };

  /** `t` in seconds; `canvasHeight` in CSS px. Returns the active band, if any. */
  return function update(t: number, canvasHeight: number): GlitchSlice | null {
    if (t > next) {
      const top = 0.12 + Math.random() * 0.6;
      const height = 0.06 + Math.random() * 0.16;
      const shift = (Math.random() < 0.5 ? -1 : 1) * (6 + Math.random() * 22);
      until = t + 0.14 + Math.random() * 0.08;
      next = t + 2.8 + Math.random() * 4;

      const lr = logo.getBoundingClientRect();
      const yTop = lr.top - hero.getBoundingClientRect().top + top * lr.height;
      const yBot = yTop + height * lr.height;
      band = { y0: (canvasHeight - yBot) / CELL, y1: (canvasHeight - yTop) / CELL, shift: -shift / CELL };

      slice.style.setProperty("--t", `${top * 100}%`);
      slice.style.setProperty("--b", `${(1 - top - height) * 100}%`);
      slice.style.setProperty("--x", `${shift}px`);
      slice.classList.add("on");
    }

    if (t < until) return band;
    slice.classList.remove("on");
    return null;
  };
}
