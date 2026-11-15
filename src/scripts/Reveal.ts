/** Gap between blocks that come into view together. */
const BLOCK_GAP_MS = 70;
/** A page too short to scroll reveals on its own after this pause, so the entrance still plays. */
const NO_SCROLL_DELAY_MS = 500;
/** Rebuild the observer once a resize settles (the covered band at the foot changes with it). */
const RESIZE_SETTLE_MS = 150;

/**
 * [data-reveal] blocks start hidden and fade in once the reader scrolls: on the first scroll, every
 * block in view appears, the rest as they scroll in. Text without the attribute shows on load (and
 * carries LCP). A page too short to scroll reveals after a short pause; one already scrolled (a
 * reload mid-page) reveals at once. The first hidden block is marked .next and peeks (CSS).
 * `bottomInset()` px at the viewport foot don't count as in view; it's read again after a resize.
 */
export function initReveal(root: ParentNode, bottomInset: () => number): () => void {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return () => {};

  const blocks = [...root.querySelectorAll<HTMLElement>("[data-reveal]")];
  if (!blocks.length) return () => {};
  blocks.forEach((b) => b.classList.add("pending"));
  const hidden = () => blocks.filter((b) => !b.classList.contains("in"));
  const markNext = () => {
    const next = hidden()[0];
    blocks.forEach((b) => b.classList.toggle("next", b === next));
  };
  markNext();

  const reveal: IntersectionObserverCallback = (entries, observer) => {
    // Entries arrive in observation order, which is document order
    entries
      .map((e) => (e.isIntersecting ? e.target : null))
      .filter((el): el is HTMLElement => el instanceof HTMLElement)
      .forEach((el, k) => {
        el.style.setProperty("--d", `${k * BLOCK_GAP_MS}ms`);
        el.classList.add("in");
        observer.unobserve(el);
      });
    markNext();
  };

  let io: IntersectionObserver | null = null;
  const observe = () => {
    io?.disconnect();
    io = new IntersectionObserver(reveal, { rootMargin: `0px 0px -${Math.round(bottomInset())}px 0px` });
    hidden().forEach((b) => io?.observe(b));
  };

  const ac = new AbortController();
  let started = false;
  let timer = 0;
  const start = () => {
    if (started) return;
    started = true;
    observe();
  };
  addEventListener(
    "resize",
    () => {
      if (!started) return;
      clearTimeout(timer);
      timer = window.setTimeout(observe, RESIZE_SETTLE_MS);
    },
    { passive: true, signal: ac.signal },
  );

  if (scrollY > 0) start();
  else if (document.documentElement.scrollHeight > innerHeight + 1)
    addEventListener("scroll", start, { once: true, passive: true, signal: ac.signal });
  else timer = window.setTimeout(start, NO_SCROLL_DELAY_MS);

  return () => {
    clearTimeout(timer);
    ac.abort();
    io?.disconnect();
  };
}
