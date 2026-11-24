import { createTear, ease, frames, GLITCH, jumble } from "@/scripts/lib/text-glitch";

const OUT_MS = 80;
const IN_MS = 200;
/** Share of IN_MS spent jumbled. */
const SETTLE_AT = 0.7;
/** Touch: decimal stays this long after lift. */
const TOUCH_HOLD_MS = 2500;

/** Decimal on hover, or for TOUCH_HOLD_MS after a tap. Screen readers always get decimal. */
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
  let target = hex;
  let hold = 0;

  // Hex stays uppercase with a lowercase "x"
  const scrambled = (to: string) => {
    const j = jumble(to);
    return to === hex ? j.toUpperCase().replaceAll("X", "x") : j;
  };

  async function swap(to: string) {
    if (to === target) return;
    target = to;
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
  el.addEventListener(
    "pointerenter",
    () => {
      clearTimeout(hold);
      void swap(dec);
    },
    { signal: ac.signal },
  );
  // pointerleave fires on touch lift, so touch reverts after a delay
  const leave = (e: PointerEvent) => {
    clearTimeout(hold);
    if (e.pointerType === "mouse") void swap(hex);
    else hold = window.setTimeout(() => void swap(hex), TOUCH_HOLD_MS);
  };
  el.addEventListener("pointerleave", leave, { signal: ac.signal });
  el.addEventListener("pointercancel", leave, { signal: ac.signal });
  return () => {
    clearTimeout(hold);
    ac.abort();
    run++;
    fade?.cancel();
    tear.off([el]);
  };
}
