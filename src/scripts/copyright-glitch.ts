import { createTear, ease, frames, GLITCH, jumble } from "@scripts/lib/text-glitch";

/** The year swap, ms: a short tear out, then the new value unjumbles in. */
const OUT_MS = 110;
const IN_MS = 300;
/** Share of the in-phase spent jumbled before the value snaps right. */
const SETTLE_AT = 0.7;

/**
 * The copyright year in hex (0x7EA), swapping to decimal on hover or focus and back on leave, with
 * the page-swap glitch in miniature (lib/text-glitch.ts): the value tears and dims, then the new
 * one shows its own characters jumbled until it snaps right. A newer swap cuts the running one off,
 * so quick hovers always end on the right value. Screen readers get the decimal year throughout.
 */
export function initCopyright(el: HTMLElement): () => void {
  const year = new Date().getFullYear();
  const hex = `0x${year.toString(16).toUpperCase()}`;
  const dec = String(year);
  el.textContent = hex;
  el.setAttribute("aria-label", dec);

  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const tear = createTear();
  let run = 0;
  let fade: Animation | null = null;

  /** Jumbled, but in the value's own style: hex stays uppercase with its lowercase "x" */
  const scrambled = (to: string) => {
    const j = jumble(to);
    return to === hex ? j.toUpperCase().replace(/X/g, "x") : j;
  };

  async function swap(to: string) {
    const id = ++run;
    const alive = () => id === run;
    if (reduce) {
      el.textContent = to;
      return;
    }
    fade?.cancel();
    tear.on([el]);
    fade = el.animate([{ opacity: 1 }, { opacity: GLITCH.dim, offset: 0.25 }, { opacity: 1 }], {
      duration: OUT_MS + IN_MS,
      easing: "ease-out",
    });

    await frames(OUT_MS, (t, now) => tear.set(ease.in(t), now), alive);
    if (!alive()) return;

    el.textContent = scrambled(to);
    let last = performance.now();
    await frames(
      IN_MS,
      (t, now) => {
        tear.set(1 - ease.out(t), now);
        if (t >= SETTLE_AT) {
          if (el.textContent !== to) el.textContent = to;
          return;
        }
        if (now - last < GLITCH.rate) return;
        last = now;
        el.textContent = scrambled(to);
      },
      alive,
    );
    if (!alive()) return;
    el.textContent = to;
    tear.set(0, performance.now());
    tear.off([el]);
  }

  const ac = new AbortController();
  for (const e of ["mouseenter", "focus"]) el.addEventListener(e, () => void swap(dec), { signal: ac.signal });
  for (const e of ["mouseleave", "blur"]) el.addEventListener(e, () => void swap(hex), { signal: ac.signal });
  return () => {
    ac.abort();
    run++;
    fade?.cancel();
    tear.off([el]);
  };
}
