import { initQuote } from "@scripts/lib/quote";
import { initReveal } from "@scripts/lib/reveal";

export function initAbout(root: HTMLElement) {
  const quote = root.querySelector<HTMLCanvasElement>("[data-quote]");
  if (quote) initQuote(quote);
  // Wrap words after the webfont swap: per-word spans turn the swap's rewrap into a large layout shift
  document.fonts.ready.then(() => initReveal(root));
}
