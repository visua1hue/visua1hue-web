/**
 * Extra metrics for the dev HUD only: heap, event-loop delay, jank, recent requests, CSS rules.
 * Kept apart from lib/metrics.ts because that collector also runs for visitors. Everything here
 * runs only while subscribed, and the HUD only subscribes in dev.
 */

export interface DevMetrics {
  /** Used JS heap in MB; null where `performance.memory` is missing (non-Chromium). */
  mem: number | null;
  /** Worst timer lateness in the last second, ms. Main-thread blockage. */
  delay: number;
  /** Share of frames over JANK_MS in the last second, %. */
  jank: number;
  /** Resource requests finished in the last NET_WINDOW_MS. */
  net: number;
  /** Rules across all readable stylesheets. */
  css: number;
}

type Listener = (m: Readonly<DevMetrics>) => void;

const TICK_MS = 200;
const SLOW_EVERY = 5; // mem, css and net are sampled once a second
const JANK_MS = 50; // a frame longer than this is a visible stall
const NET_WINDOW_MS = 5000;

const metrics: DevMetrics = { mem: null, delay: 0, jank: 0, net: 0, css: 0 };
const listeners = new Set<Listener>();
const emit = () => listeners.forEach((fn) => fn(metrics));

const heapMB = () => {
  const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
  return mem ? Math.round(mem.usedJSHeapSize / 1048576) : null;
};

const countRules = () => {
  let n = 0;
  for (const sheet of document.styleSheets) {
    try {
      n += sheet.cssRules.length;
    } catch {
      /* cross-origin sheet */
    }
  }
  return n;
};

let timer = 0;
let raf = 0;
let po: PerformanceObserver | null = null;
let onVisibility: (() => void) | null = null;

function start() {
  // Timer lateness vs the expected tick; the max over each second
  let expected = performance.now() + TICK_MS;
  let ticks = 0;
  let worst = 0;
  const requests: number[] = [];

  try {
    po = new PerformanceObserver((list) => {
      for (const e of list.getEntries() as PerformanceResourceTiming[]) requests.push(e.responseEnd);
    });
    po.observe({ type: "resource" });
  } catch {
    /* unsupported entry type */
  }

  timer = window.setInterval(() => {
    const now = performance.now();
    // Hidden tabs throttle timers; that lateness is the browser's, not the page's
    if (document.hidden) {
      expected = now + TICK_MS;
      return;
    }
    worst = Math.max(worst, now - expected);
    expected = now + TICK_MS;
    if (++ticks % SLOW_EVERY) return;

    while (requests.length && requests[0] < now - NET_WINDOW_MS) requests.shift();
    metrics.delay = Math.round(worst);
    metrics.mem = heapMB();
    metrics.net = requests.length;
    metrics.css = countRules();
    worst = 0;
    emit();
  }, TICK_MS);

  // Janky share of frames, published once a second
  let last = 0;
  let windowStart = 0;
  let frames = 0;
  let janky = 0;
  const tick = (now: number) => {
    raf = requestAnimationFrame(tick);
    if (!windowStart) windowStart = last = now;
    frames++;
    if (now - last > JANK_MS) janky++;
    last = now;
    if (now - windowStart < 1000) return;
    const jank = Math.round((janky / frames) * 100);
    frames = janky = 0;
    windowStart = now;
    if (jank !== metrics.jank) {
      metrics.jank = jank;
      emit();
    }
  };
  raf = requestAnimationFrame(tick);

  // rAF pauses in hidden tabs; the first frame back would count the whole gap as one janky frame
  onVisibility = () => {
    expected = performance.now() + TICK_MS;
    worst = 0;
    windowStart = frames = janky = 0;
  };
  document.addEventListener("visibilitychange", onVisibility);
}

function stop() {
  if (onVisibility) document.removeEventListener("visibilitychange", onVisibility);
  onVisibility = null;
  clearInterval(timer);
  cancelAnimationFrame(raf);
  po?.disconnect();
  po = null;
}

/** Subscribe to dev metric updates. Starts sampling on first call, stops after the last leaves. */
export function subscribeDevMetrics(fn: Listener): () => void {
  listeners.add(fn);
  if (listeners.size === 1) start();
  fn(metrics);
  return () => {
    listeners.delete(fn);
    if (!listeners.size) stop();
  };
}
