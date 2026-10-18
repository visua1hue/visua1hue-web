import { createDitherRenderer } from "@scripts/webgl/dither";
import { createGlitch } from "./glitch";
import { layoutHero, type HeroElements, type HeroLayout } from "./layout";

/** Field time used for the single still frame under reduced motion. */
const STILL_TIME = 12;
/** Field fade-in, seconds. */
const INTRO = 1.8;

export function initHero(hero: HTMLElement) {
  const $ = <T extends HTMLElement>(sel: string) => hero.querySelector<T>(sel);
  const canvas = $<HTMLCanvasElement>("canvas.field");
  const logo = $("#logo");
  const slice = $("#slice");
  const copy = $(".copy");
  if (!canvas || !logo || !slice || !copy) return;

  const els: HeroElements = {
    hero,
    logo,
    copy,
    build: $("[data-cell=build]"),
    debug: $("[data-cell=debug]"),
    metrics: [...hero.querySelectorAll<HTMLElement>("[data-cell=metric]")],
  };

  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const renderer = createDitherRenderer(canvas);
  const glitch = reduce ? null : createGlitch(hero, logo, slice);

  let current: HeroLayout;
  const relayout = () => {
    current = layoutHero(els);
    if (!renderer) return;
    canvas.style.width = `${current.width}px`;
    canvas.style.height = `${current.height}px`;
    renderer.resize(current.geometry);
    if (reduce) renderer.draw(STILL_TIME, 1, null);
  };

  relayout();
  addEventListener("resize", relayout);
  // Webfont swap changes the copy height
  document.fonts?.ready.then(relayout);
  if (!renderer) return;

  canvas.classList.add("on");
  if (reduce) return;

  // Animate only while the hero is on screen and the tab is visible
  const t0 = performance.now();
  let raf = 0;
  let onScreen = true;
  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    const t = Math.max(0, now - t0) / 1000;
    renderer.draw(t, Math.min(1, t / INTRO), glitch?.(t, current.height) ?? null);
  };
  const sync = () => {
    const run = onScreen && !document.hidden;
    if (run && !raf) raf = requestAnimationFrame(frame);
    if (!run && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  };
  new IntersectionObserver(([e]) => {
    onScreen = e.isIntersecting;
    sync();
  }).observe(hero);
  document.addEventListener("visibilitychange", sync);
  sync();
}
