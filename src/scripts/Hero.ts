import { createDitherRenderer } from "@scripts/lib/dither";
import { createGlitch, isGlitchPreset } from "@scripts/lib/glitch";
import { layoutHero, readGridTokens, type HeroLayout } from "@scripts/lib/hero-layout";
import { heroParts } from "@scripts/lib/hero-parts";

/** Field time used for the single still frame under reduced motion. */
const STILL_TIME = 12;
/** Intro length, seconds: covers over the wordmark drop out, a block cloud clears, the field develops. */
const INTRO = 2.4;
/** All covers are gone by then (dither.ts: off <= .42 of INTRO); the canvas moves back under the logo. */
const UNCOVERED = 1.05;
/** The field drifts slowly; above 60fps only costs battery. */
const FRAME_MS = 1000 / 60;

export function initHero(root: HTMLElement): () => void {
  const parts = heroParts(root);
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const renderer = createDitherRenderer(parts.field);
  const ac = new AbortController();
  const on = { signal: ac.signal };

  let current: HeroLayout;
  // CSS hides the logo until .revealed. With the intro, that happens on the first frame,
  // drawn with the canvas above the logo and its squares covered.
  let revealed = false;
  const revealLogo = () => {
    revealed = true;
    parts.logo.classList.add("revealed");
  };
  if (!reduce && renderer) parts.field.classList.add("over");
  else revealLogo();
  const preset = root.dataset.glitch;
  const glitch = reduce
    ? null
    : createGlitch(parts, readGridTokens(root).cell, isGlitchPreset(preset) ? preset : "calm");

  const relayout = () => {
    // Re-read: --hero-margin depends on the viewport
    current = layoutHero(parts, readGridTokens(root));
    if (!renderer) return;
    parts.field.style.width = `${current.width}px`;
    parts.field.style.height = `${current.height}px`;
    renderer.resize(current.geometry);
    if (reduce) renderer.draw(STILL_TIME, 1, null, false);
  };

  // The layout depends on width only; mobile URL-bar resizes change height on scroll
  let lastWidth = innerWidth;
  let pending = 0;
  addEventListener(
    "resize",
    () => {
      if (innerWidth === lastWidth || pending) return;
      pending = requestAnimationFrame(() => {
        pending = 0;
        lastWidth = innerWidth;
        relayout();
      });
    },
    on,
  );

  relayout();
  // Webfont swap changes the copy height
  document.fonts?.ready.then(() => !ac.signal.aborted && relayout());

  const teardown = () => {
    ac.abort();
    cancelAnimationFrame(pending);
    renderer?.destroy();
  };
  if (!renderer) return teardown;
  parts.field.classList.add("on");
  if (reduce) return teardown;

  // Animate only while the hero is on screen and the tab is visible
  const t0 = performance.now();
  let raf = 0;
  let last = 0;
  let onScreen = true;
  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    const elapsed = now - last;
    // 1ms slack so a 60Hz display never skips; the remainder keeps 90-144Hz averaging 60fps
    if (elapsed < FRAME_MS - 1) return;
    last = now - (elapsed >= FRAME_MS ? elapsed % FRAME_MS : 0);
    const t = Math.max(0, now - t0) / 1000;
    const covering = t < UNCOVERED;
    renderer.draw(t, Math.min(1, t / INTRO), glitch?.(t, current.height) ?? null, covering);
    if (!revealed) revealLogo();
    if (!covering && parts.field.classList.contains("over")) parts.field.classList.remove("over");
  };
  const sync = () => {
    const run = onScreen && !document.hidden;
    if (run && !raf) raf = requestAnimationFrame(frame);
    if (!run && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  };
  const io = new IntersectionObserver(([e]) => {
    onScreen = e.isIntersecting;
    sync();
  });
  io.observe(root);
  document.addEventListener("visibilitychange", sync, on);
  sync();

  return () => {
    io.disconnect();
    cancelAnimationFrame(raf);
    teardown();
  };
}
