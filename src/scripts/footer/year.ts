const GLYPHS = "!<>-_/\\[]{}=+*^?#%01ABCDEF";
const DURATION = 520;

/** Shows the year in hex; scrambles to decimal on hover/focus and back on leave. */
export function initYear(el: HTMLElement) {
  const y = new Date().getFullYear();
  const hex = `0x${y.toString(16).toUpperCase()}`;
  const dec = String(y);
  const len = Math.max(hex.length, dec.length);
  el.textContent = hex;

  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let raf = 0;
  function scramble(to: string) {
    cancelAnimationFrame(raf);
    if (reduce) {
      el.textContent = to;
      return;
    }
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / DURATION);
      let out = "";
      // Characters lock left to right as p advances
      for (let i = 0; i < len; i++) {
        out += (i + 1) / len <= p ? (to[i] ?? " ") : GLYPHS[(Math.random() * GLYPHS.length) | 0];
      }
      el.textContent = out;
      if (p < 1) raf = requestAnimationFrame(tick);
      else el.textContent = to;
    };
    raf = requestAnimationFrame(tick);
  }

  for (const e of ["mouseenter", "focus"]) el.addEventListener(e, () => scramble(dec));
  for (const e of ["mouseleave", "blur"]) el.addEventListener(e, () => scramble(hex));
}
