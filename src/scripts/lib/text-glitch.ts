/** Used by copyright-glitch.ts. The tear is #page-glitch in PageFrame.astro */

export const GLITCH = {
  /** Re-jumble and tear pattern interval, ms; strength still eases every frame. */
  rate: 50,
  /** Peak band slip, px. */
  tear: 12,
  /** Opacity while glitching. */
  dim: 0.55,
} as const;

/** Vertical noise frequency range; higher means thinner bands. */
const BAND_FREQ: [number, number] = [0.04, 0.16];

export const ease = {
  in: (t: number) => t * t,
  out: (t: number) => 1 - (1 - t) * (1 - t),
};

/** Shuffles letters and digits; punctuation and case pattern stay ("You've" can become "Ouy'ev"). */
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

/** `each(t, now)` per frame for `ms`, t from 0 to 1. Stops without a last call once `alive()` is false. */
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
  /** Strength 0..1; the band pattern changes every GLITCH.rate ms. */
  set(k: number, now: number): void;
  on(els: HTMLElement[]): void;
  off(els: HTMLElement[]): void;
}

/** No-op where the filter is absent (404). */
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
