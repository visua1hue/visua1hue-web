/**
 * Metrics for the dev HUD (DevHud.ts): web vitals, frame rate, jank, heap, event-loop delay, recent
 * requests and CSS rules. Kept in memory, never sent anywhere; dev only.
 *
 * The performance observers start with the first subscriber and stay: they're passive, and starting
 * them again would replay buffered entries (CLS would count twice). The rAF loop and the sampling
 * timer run only while someone is subscribed.
 */

export interface DevMetrics {
  /** Frames per second, smoothed. */
  fps: number | null;
  /** First and largest contentful paint, ms. LCP stops at the first input, as browsers report it. */
  fcp: number | null;
  lcp: number | null;
  /** Cumulative layout shift, ignoring shifts right after input. */
  cls: number;
  /** Slowest interaction so far, ms. */
  inp: number | null;
  /** Used JS heap in MB; null where `performance.memory` is missing (non-Chromium). */
  mem: number | null;
  /** Worst timer lateness in the last second, ms: main-thread blockage. */
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
const SLOW_EVERY = 5; // delay, mem, net and css are published once a second
const FPS_BUCKET_MS = 250;
const JANK_MS = 50; // a frame longer than this is a visible stall
const NET_WINDOW_MS = 5000;

const metrics: DevMetrics = {
  fps: null,
  fcp: null,
  lcp: null,
  cls: 0,
  inp: null,
  mem: null,
  delay: 0,
  jank: 0,
  net: 0,
  css: 0,
};
const listeners = new Set<Listener>();
const emit = () => listeners.forEach((fn) => fn(metrics));

/** Finish times of recent requests, oldest first */
const requests: number[] = [];
const dropOldRequests = (now: number) => {
  while (requests.length && (requests[0] ?? 0) < now - NET_WINDOW_MS) requests.shift();
};

function observe(type: string, cb: (entries: PerformanceEntryList) => void, opts: PerformanceObserverInit = {}) {
  try {
    new PerformanceObserver((list) => cb(list.getEntries())).observe({ type, buffered: true, ...opts });
  } catch {
    /* unsupported entry type */
  }
}

let observing = false;

function startObservers() {
  observing = true;

  let lcpDone = false;
  const stopLcp = () => (lcpDone = true);
  addEventListener("pointerdown", stopLcp, { once: true, capture: true });
  addEventListener("keydown", stopLcp, { once: true, capture: true });

  observe("paint", (entries) => {
    const e = entries.find((x) => x.name === "first-contentful-paint");
    if (!e) return;
    metrics.fcp = Math.round(e.startTime);
    emit();
  });

  observe("largest-contentful-paint", (entries) => {
    const last = entries.at(-1);
    if (lcpDone || !last) return;
    metrics.lcp = Math.round(last.startTime);
    emit();
  });

  observe("layout-shift", (entries) => {
    for (const e of entries as unknown as { value: number; hadRecentInput: boolean }[]) {
      if (!e.hadRecentInput) metrics.cls += e.value;
    }
    emit();
  });

  observe(
    "event",
    (entries) => {
      for (const e of entries as unknown as (PerformanceEntry & { interactionId: number })[]) {
        if (!e.interactionId || e.duration <= (metrics.inp ?? 0)) continue;
        metrics.inp = Math.round(e.duration);
        emit();
      }
    },
    { durationThreshold: 16 } as PerformanceObserverInit,
  );

  observe("resource", (entries) => {
    for (const e of entries as PerformanceResourceTiming[]) requests.push(e.responseEnd);
    // Keeps observing after the HUD is hidden; don't let the list grow meanwhile
    dropOldRequests(performance.now());
  });
}

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
let onVisibility: (() => void) | null = null;

/** One rAF loop for frame rate (EMA over short buckets) and jank (per second) */
function startSampling() {
  let fps = 0;
  let bucketStart = 0;
  let bucketFrames = 0;
  let last = 0;
  let windowStart = 0;
  let frames = 0;
  let janky = 0;

  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    if (!last) {
      last = bucketStart = windowStart = now;
      return;
    }
    if (now - last > JANK_MS) janky++;
    last = now;
    frames++;
    bucketFrames++;

    if (now - bucketStart >= FPS_BUCKET_MS) {
      const raw = (bucketFrames / (now - bucketStart)) * 1000;
      fps = fps ? fps * 0.85 + raw * 0.15 : raw;
      bucketFrames = 0;
      bucketStart = now;
      const rounded = Math.round(fps);
      if (rounded !== metrics.fps) {
        metrics.fps = rounded;
        emit();
      }
    }

    if (now - windowStart >= 1000) {
      const jank = Math.round((janky / frames) * 100);
      frames = janky = 0;
      windowStart = now;
      if (jank !== metrics.jank) {
        metrics.jank = jank;
        emit();
      }
    }
  };
  raf = requestAnimationFrame(frame);

  // Timer lateness against the expected tick; the worst over each second
  let expected = performance.now() + TICK_MS;
  let ticks = 0;
  let worst = 0;
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

    dropOldRequests(now);
    metrics.delay = Math.round(worst);
    metrics.mem = heapMB();
    metrics.net = requests.length;
    metrics.css = countRules();
    worst = 0;
    emit();
  }, TICK_MS);

  // Hidden tabs pause rAF and throttle timers: start the windows over when the tab comes back, or
  // the gap would read as one long janky frame and a huge delay
  onVisibility = () => {
    last = 0;
    frames = janky = bucketFrames = 0;
    expected = performance.now() + TICK_MS;
    worst = 0;
  };
  document.addEventListener("visibilitychange", onVisibility);
}

function stopSampling() {
  if (onVisibility) document.removeEventListener("visibilitychange", onVisibility);
  onVisibility = null;
  clearInterval(timer);
  cancelAnimationFrame(raf);
}

/** Subscribe to updates. The first subscriber starts collection; sampling stops after the last leaves. */
export function subscribeDevMetrics(fn: Listener): () => void {
  listeners.add(fn);
  if (!observing) startObservers();
  if (listeners.size === 1) startSampling();
  fn(metrics);
  return () => {
    if (!listeners.delete(fn)) return;
    if (!listeners.size) stopSampling();
  };
}
