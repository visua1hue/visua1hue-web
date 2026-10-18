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

/**
 * Scroll-driven word-by-word reveal of [data-reveal] paragraphs, plus a one-shot
 * fade-in for .fade elements.
 */
export function initReveal(root: HTMLElement | null) {
  if (!root) return;
  const paras = [...root.querySelectorAll("[data-reveal]")];
  const fades = [...root.querySelectorAll(".fade")];
  if (!paras.length) return;

  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const words: HTMLElement[] = [];
  if (!reduce) paras.forEach((p) => wrapWords(p, words));

  let queued = false;
  function update() {
    queued = false;
    const vh = innerHeight;
    fades.forEach((f) => {
      if (f.getBoundingClientRect().top < vh * 0.9) f.classList.add("in");
    });
    if (reduce) return;

    const a = paras[0].getBoundingClientRect().top;
    const z = paras[paras.length - 1].getBoundingClientRect().bottom;
    const start = vh * 0.88;
    const end = vh * 0.45;
    let p = Math.min(1, Math.max(0, (start - a) / (z - a + (start - end))));
    // Guarantee a full reveal by the bottom of the page
    const maxScroll = document.documentElement.scrollHeight - vh;
    if (maxScroll > 0) p = Math.max(p, Math.pow(scrollY / maxScroll, 1.5));

    const lit = p * words.length;
    words.forEach((w, i) => {
      w.style.opacity = (DIM + (1 - DIM) * Math.min(1, Math.max(0, lit - i))).toFixed(3);
    });
  }

  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(update);
  };
  addEventListener("scroll", schedule, { passive: true });
  addEventListener("resize", schedule);
  update();
}
