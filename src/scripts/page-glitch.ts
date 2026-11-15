import { createTear, ease, frames, GLITCH, jumble } from "@scripts/lib/text-glitch";

export interface PageGlitch {
  /** The visible text tears and dims, then cuts out. */
  out(): Promise<void>;
  /** The new visible text unjumbles word by word while the tear settles and it brightens. */
  in(): Promise<void>;
}

/** Text blocks of the column on screen. The privacy header counts as its title and date, never as
    a block of its own as well: nested, a block would tear twice and its text jumble twice */
const BLOCKS = ":is(.about, .policy) > :not(.policy-head), .policy-head > *";

function visibleBlocks(main: HTMLElement): HTMLElement[] {
  const h = innerHeight;
  return [...main.querySelectorAll<HTMLElement>(BLOCKS)].filter((el) => {
    const r = el.getBoundingClientRect();
    return r.bottom > 0 && r.top < h && r.height > 0;
  });
}

/** Every text node under `blocks`, with its original text. */
function textNodes(blocks: HTMLElement[]): { node: Text; text: string }[] {
  const out: { node: Text; text: string }[] = [];
  for (const block of blocks) {
    const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (n instanceof Text && n.data.trim()) out.push({ node: n, text: n.data });
    }
  }
  return out;
}

/** Text nodes' words, each with its moment (0..1) to snap right: roughly left to right, scattered. */
function wordsOf(texts: { node: Text; text: string }[]) {
  return texts.map(({ text }) =>
    [...text.matchAll(/\S+/g)].map((m) => {
      const x = m.index / Math.max(1, text.length);
      return { start: m.index, word: m[0], at: Math.min(0.92, x * 0.5 + Math.random() * 0.42) };
    }),
  );
}

/** Writes each text node with the words `jumbled(word)` says are jumbled at this moment. */
function paint(
  texts: { node: Text; text: string }[],
  words: ReturnType<typeof wordsOf>,
  jumbled: (at: number) => boolean,
) {
  texts.forEach(({ node, text }, n) => {
    let s = text;
    for (const w of words[n] ?? []) {
      if (!jumbled(w.at)) continue;
      s = s.slice(0, w.start) + jumble(w.word) + s.slice(w.start + w.word.length);
    }
    if (node.data !== s) node.data = s;
  });
}

/**
 * Page-swap glitch for the text column (pieces in lib/text-glitch.ts): the tear filter slips the real
 * text sideways in horizontal bands, and on the way in each word shows its own letters jumbled
 * until it snaps right. Monochrome, same font: nothing changes colour and line lengths hold. Only
 * the blocks on screen are filtered and jumbled, and only for the run; the dim is a compositor-only
 * Web Animation.
 */
export function createPageGlitch(target: () => HTMLElement | null): PageGlitch {
  const tear = createTear();

  return {
    async out() {
      const main = target();
      if (!main) return;
      const blocks = visibleBlocks(main);
      tear.on(blocks);
      const fade = main.animate([{ opacity: 1 }, { opacity: GLITCH.dim }], {
        duration: GLITCH.outMs,
        easing: "ease-in",
        fill: "forwards",
      });
      await frames(GLITCH.outMs, (t, now) => tear.set(ease.in(t), now));
      // Cut: stays out until the swap replaces it
      main.style.opacity = "0";
      fade.cancel();
      tear.off(blocks);
      tear.set(0, performance.now());
    },

    async in() {
      const main = target();
      if (!main) return;
      const ms = GLITCH.inMs;
      const blocks = visibleBlocks(main);
      const texts = textNodes(blocks);
      const words = wordsOf(texts);

      main.style.removeProperty("opacity");
      main.setAttribute("aria-busy", "true");
      tear.on(blocks);
      const fade = main.animate([{ opacity: GLITCH.dim }, { opacity: 1 }], { duration: ms, easing: "ease-out" });
      // Jumbled and torn from the first frame: this runs right after the swap, before paint
      paint(texts, words, () => true);
      tear.set(1, performance.now());

      let lastJumble = performance.now();
      await frames(ms, (t, now) => {
        tear.set(1 - ease.out(Math.min(1, t * 1.4)), now);
        if (now - lastJumble < GLITCH.rate && t < 1) return;
        lastJumble = now;
        paint(texts, words, (at) => t < at);
      });

      texts.forEach(({ node, text }) => (node.data = text));
      fade.cancel();
      tear.off(blocks);
      tear.set(0, performance.now());
      main.removeAttribute("aria-busy");
    },
  };
}
