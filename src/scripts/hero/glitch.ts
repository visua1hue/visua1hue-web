import type { GlitchSlice } from "./dither";
import type { HeroParts } from "./parts";

/** Seconds, and fractions of the wordmark height / CSS px for the band. */
interface GlitchTiming {
  first: number;
  gap: [number, number];
  duration: [number, number];
  top: [number, number];
  height: [number, number];
  shift: [number, number];
}

export type GlitchPreset = "calm" | "storm";

const PRESETS: Record<GlitchPreset, GlitchTiming> = {
  // Homepage, as approved
  calm: { first: 4, gap: [2.8, 6.8], duration: [0.14, 0.22], top: [0.12, 0.72], height: [0.06, 0.22], shift: [6, 28] },
  // 404: sooner, more often, wider bands and shifts
  storm: { first: 0.9, gap: [0.35, 1.6], duration: [0.08, 0.3], top: [0.05, 0.8], height: [0.06, 0.32], shift: [10, 56] },
};

export const isGlitchPreset = (v: string | undefined): v is GlitchPreset => !!v && v in PRESETS;

const between = ([a, b]: [number, number]) => a + Math.random() * (b - a);

/**
 * Every so often, shifts one horizontal band of the wordmark (a clipped copy)
 * and the same band of the dither field (shader uniform) sideways.
 */
export function createGlitch({ root, logo, slice }: HeroParts, cell: number, preset: GlitchPreset = "calm") {
  const p = PRESETS[preset];
  let until = 0;
  let next = p.first;
  let active = false;
  let band: GlitchSlice = { y0: 0, y1: 0, shift: 0 };

  /** `t` in seconds; `canvasHeight` in CSS px. Returns the active band, if any. */
  return function update(t: number, canvasHeight: number): GlitchSlice | null {
    if (t > next) {
      const top = between(p.top);
      const height = Math.min(between(p.height), 1 - top);
      const shift = (Math.random() < 0.5 ? -1 : 1) * between(p.shift);
      until = t + between(p.duration);
      next = t + between(p.gap);

      // Layout reads happen only here, once per glitch
      const lr = logo.getBoundingClientRect();
      const yTop = lr.top - root.getBoundingClientRect().top + top * lr.height;
      const yBot = yTop + height * lr.height;
      band = { y0: (canvasHeight - yBot) / cell, y1: (canvasHeight - yTop) / cell, shift: -shift / cell };

      slice.style.setProperty("--t", `${top * 100}%`);
      slice.style.setProperty("--b", `${(1 - top - height) * 100}%`);
      slice.style.setProperty("--x", `${shift}px`);
      slice.classList.add("on");
      active = true;
    }

    if (t < until) return band;
    if (active) {
      slice.classList.remove("on");
      active = false;
    }
    return null;
  };
}
