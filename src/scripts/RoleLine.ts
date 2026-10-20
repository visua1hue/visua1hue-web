/**
 * Expands the role line. `aria-expanded` is the only state and the only CSS hook,
 * so what screen readers hear always matches what is shown.
 * Pointer devices: expanded while hovered or keyboard-focused.
 * Touch: a tap toggles it.
 */
export function initRole(el: HTMLElement): () => void {
  const ac = new AbortController();
  const on = { signal: ac.signal };
  const set = (open: boolean) => el.setAttribute("aria-expanded", String(open));

  let hovered = false;
  let focused = false;
  const sync = () => set(hovered || focused);

  if (matchMedia("(hover: none)").matches) {
    el.addEventListener("click", () => set(el.getAttribute("aria-expanded") !== "true"), on);
  } else {
    el.addEventListener("pointerenter", () => {
      hovered = true;
      sync();
    }, on);
    el.addEventListener("pointerleave", () => {
      hovered = false;
      sync();
    }, on);
  }
  // Only keyboard focus: a mouse click would otherwise keep it open after the pointer leaves
  el.addEventListener("focus", () => {
    focused = el.matches(":focus-visible");
    sync();
  }, on);
  el.addEventListener("blur", () => {
    focused = false;
    sync();
  }, on);

  return () => ac.abort();
}
