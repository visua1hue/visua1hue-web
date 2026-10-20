const DIM = 0.16;

/** Wraps every word of `p` in a span.w, keeping inline markup intact. */
function wrapWords(p: Element, words: HTMLElement[]) {
  for (const node of [...p.childNodes]) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      wrapWords(node as Element, words);
      continue;
    }
    if (node.nodeType !== Node.TEXT_NODE) continue;
    const frag = document.createDocumentFragment();
    for (const part of (node.textContent ?? "").split(/(\s+)/)) {
      if (!part) continue;
      if (/^\s+$/.test(part)) {
        frag.appendChild(document.createTextNode(part));
        continue;
      }
      const w = document.createElement("span");
      w.className = "w";
      w.textContent = part;
      words.push(w);
      frag.appendChild(w);
    }
    node.replaceWith(frag);
  }
}

/** Document-relative positions; re-measured on resize, never on scroll. */
interface Metrics {
  vh: number;
  maxScroll: number;
  /** Top of the first paragraph and bottom of the last. */
  top: number;
  bottom: number;
  fadeTops: number[];
}

/**
 * Scroll-driven word-by-word reveal of [data-reveal] paragraphs, plus a one-shot
 * fade-in for .fade elements. Scroll handling reads no layout and writes only the
 * words whose opacity changed.
 */
export function initReveal(root: HTMLElement): () => void {
  const paras = [...root.querySelectorAll("[data-reveal]")];
  const fades = [...root.querySelectorAll(".fade")];
  if (!paras.length) return () => {};

  const ac = new AbortController();
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  // Wrap even under reduced motion (CSS keeps words fully lit there): span boundaries
  // shift glyphs by sub-pixels, so wrapping in only one mode would render text differently
  const words: HTMLElement[] = [];
  paras.forEach((p) => wrapWords(p, words));

  let m: Metrics;
  const measure = () => {
    const y = scrollY;
    m = {
      vh: innerHeight,
      maxScroll: document.documentElement.scrollHeight - innerHeight,
      top: paras[0].getBoundingClientRect().top + y,
      bottom: paras[paras.length - 1].getBoundingClientRect().bottom + y,
      fadeTops: fades.map((f) => f.getBoundingClientRect().top + y),
    };
  };

  // Opacity is a function of (lit - i); track it so only changed words are written
  const shown = new Float64Array(words.length).fill(DIM);
  let pendingFades = fades.length;
  let queued = false;

  function update() {
    queued = false;
    const y = scrollY;

    if (pendingFades) {
      fades.forEach((f, i) => {
        if (f.classList.contains("in") || m.fadeTops[i] - y >= m.vh * 0.9) return;
        f.classList.add("in");
        pendingFades--;
      });
    }
    if (reduce) return;

    const start = m.vh * 0.88;
    const end = m.vh * 0.45;
    const a = m.top - y;
    const z = m.bottom - y;
    let p = Math.min(1, Math.max(0, (start - a) / (z - a + (start - end))));
    // Guarantee a full reveal by the bottom of the page
    if (m.maxScroll > 0) p = Math.max(p, Math.pow(y / m.maxScroll, 1.5));

    const lit = p * words.length;
    for (let i = 0; i < words.length; i++) {
      const o = Math.round((DIM + (1 - DIM) * Math.min(1, Math.max(0, lit - i))) * 1000) / 1000;
      if (o === shown[i]) continue;
      shown[i] = o;
      words[i].style.opacity = String(o);
    }
  }

  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(update);
  };
  const remeasure = () => {
    measure();
    schedule();
  };

  measure();
  update();
  addEventListener("scroll", schedule, { passive: true, signal: ac.signal });
  // Viewport height feeds the reveal window; document size changes (font swap, reflow) move the paragraphs
  addEventListener("resize", remeasure, { signal: ac.signal });
  const ro = new ResizeObserver(remeasure);
  ro.observe(document.documentElement);

  return () => {
    ac.abort();
    ro.disconnect();
  };
}
