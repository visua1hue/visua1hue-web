import { createTear, ease, frames, GLITCH, jumble } from "@/scripts/lib/text-glitch";

const OUT_MS = 80;
const IN_MS = 200;
/** Share of IN_MS spent jumbled. */
const SETTLE_AT = 0.7;

/** Decimal on hover or touch press (pointerleave fires on lift). Screen readers always get decimal. */
export function initCopyright(el: HTMLElement): () => void {
  const year = new Date().getFullYear();
  const hex = `0x${year.toString(16).toUpperCase()}`;
  const dec = String(year);
  el.textContent = hex;
  el.setAttribute("aria-label", dec);

  // Read per swap; the setting can change while the page is open
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  const tear = createTear();
  let run = 0;
  let fade: Animation | null = null;

  // Hex stays uppercase with a lowercase "x"
  const scrambled = (to: string) => {
    const j = jumble(to);
    return to === hex ? j.toUpperCase().replace(/X/g, "x") : j;
  };

  async function swap(to: string) {
    const id = ++run;
    const alive = () => id === run;
    if (reduce.matches) {
      fade?.cancel();
      tear.off([el]);
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
  el.addEventListener("pointerenter", () => void swap(dec), { signal: ac.signal });
  for (const e of ["pointerleave", "pointercancel"])
    el.addEventListener(e, () => void swap(hex), { signal: ac.signal });
  return () => {
    ac.abort();
    run++;
    fade?.cancel();
    tear.off([el]);
  };
}
