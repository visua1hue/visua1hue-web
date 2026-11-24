/** Release waits PRESS_MIN_MS so a quick tap still shows the press. */
const PRESS_MIN_MS = 120;

/** iOS skips :active on most taps: `data-pressed` marks a held pointer instead. */
export function tapFeedback(el: HTMLElement): void {
  let at = 0;
  let timer = 0;
  const drop = () => el.removeAttribute("data-pressed");
  el.addEventListener("pointerdown", () => {
    clearTimeout(timer);
    at = performance.now();
    el.setAttribute("data-pressed", "");
  });
  el.addEventListener("pointerup", () => {
    timer = window.setTimeout(drop, Math.max(0, PRESS_MIN_MS - (performance.now() - at)));
  });
  el.addEventListener("pointercancel", drop);
  // Touch fires pointerleave right after pointerup; drop only if still held
  el.addEventListener("pointerleave", (e) => {
    if (e.buttons) drop();
  });
}
