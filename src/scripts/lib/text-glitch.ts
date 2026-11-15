/**
 * Shared pieces of the text glitch (page swaps: scripts/PageGlitch.ts; the copyright year:
 * scripts/Copyright.ts): the tear (an SVG filter, #page-glitch in PageFrame.astro, that slips
 * horizontal bands of text sideways) and the jumble (a word's own characters in random order).
 */

/** The look, as chosen. */
export const GLITCH = {
  /** Page swap: out and in durations, ms. */
  outMs: 220,
  inMs: 460,
  /** Characters re-jumble and the tear pattern changes this often, ms; strength eases every frame. */
  rate: 50,
  /** Peak sideways tear (how far a band slips), CSS px. */
  tear: 12,
  /** Opacity the text dims to while it glitches. */
  dim: 0.55,
} as const;

/** Vertical noise frequency range for the tear bands (higher means thinner): a mix of sizes. */
const BAND_FREQ: [number, number] = [0.04, 0.16];

export const ease = {
  in: (t: number) => t * t,
  out: (t: number) => 1 - (1 - t) * (1 - t),
};

/**
 * The word's own letters and digits in random order. Everything else (apostrophes, punctuation)
 * keeps its place, and so does the case pattern, so "You've" can read "Ouy'ev" but never "you'Ve".
 */
export function jumble(word: string): string {
  const chars = [...word];
  const slots = chars.flatMap((c, i) => (/[\p{L}\p{N}]/u.test(c) ? [i] : []));
  const pool = slots.map((i) => (chars[i] ?? "").toLowerCase());
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j] ?? "", pool[i] ?? ""];
  }
  slots.forEach((slot, k) => {
    const orig = chars[slot] ?? "";
    const next = pool[k] ?? "";
    chars[slot] = orig === orig.toUpperCase() && orig !== orig.toLowerCase() ? next.toUpperCase() : next;
  });
  return chars.join("");
}

/**
 * Calls `each(t, now)` every frame for `ms` (t 0..1). Stops early, without a last call, once
 * `alive()` turns false (a newer run took over).
 */
export function frames(ms: number, each: (t: number, now: number) => void, alive: () => boolean = () => true) {
  return new Promise<void>((resolve) => {
    const start = performance.now();
    const step = (now: number) => {
      if (!alive()) return resolve();
      const t = Math.min(1, (now - start) / ms);
      each(t, now);
      if (t < 1) requestAnimationFrame(step);
      else resolve();
    };
    requestAnimationFrame(step);
  });
}

export interface Tear {
  /** Tear strength 0..1; the band pattern changes every GLITCH.rate ms. */
  set(k: number, now: number): void;
  on(els: HTMLElement[]): void;
  off(els: HTMLElement[]): void;
}

/** The tear filter's controls. Without the filter on the page (the 404), every call is a no-op. */
export function createTear(): Tear {
  const noise = document.querySelector<SVGFETurbulenceElement>("#page-glitch feTurbulence");
  const map = document.querySelector<SVGFEDisplacementMapElement>("#page-glitch feDisplacementMap");
  const present = !!(noise && map);
  let seed = 1;
  let lastJitter = 0;
  return {
    set(k, now) {
      if (!present) return;
      if (now - lastJitter >= GLITCH.rate) {
        lastJitter = now;
        seed = (seed % 997) + 1 + Math.floor(Math.random() * 7);
        const [lo, hi] = BAND_FREQ;
        noise?.setAttribute("seed", String(seed));
        noise?.setAttribute("baseFrequency", `0.0008 ${(lo + Math.random() * (hi - lo)).toFixed(3)}`);
      }
      map?.setAttribute("scale", (k * GLITCH.tear * 2).toFixed(1));
    },
    on(els) {
      if (!present) return;
      for (const el of els) el.style.filter = "url(#page-glitch)";
    },
    off(els) {
      for (const el of els) el.style.removeProperty("filter");
    },
  };
}
