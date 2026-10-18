/**
 * Web vitals + FPS collector, kept in memory only and never sent anywhere.
 * One set of observers and one rAF loop, shared by every subscriber.
 */

export interface Metrics {
  fps: number | null;
  fcp: number | null;
  lcp: number | null;
  cls: number;
  inp: number | null;
}

type Listener = (m: Readonly<Metrics>) => void;

const metrics: Metrics = { fps: null, fcp: null, lcp: null, cls: 0, inp: null };
const listeners = new Set<Listener>();
let started = false;

const emit = () => listeners.forEach((fn) => fn(metrics));

const observe = (
  type: string,
  cb: (entries: PerformanceEntryList) => void,
  opts: Record<string, unknown> = {},
) => {
  try {
    new PerformanceObserver((list) => cb(list.getEntries())).observe({
      type,
      buffered: true,
      ...opts,
    } as PerformanceObserverInit);
  } catch {
    /* unsupported entry type */
  }
};

function start() {
  started = true;

  // LCP stops being reported after the first input; match that
  let lcpDone = false;
  const stopLcp = () => (lcpDone = true);
  addEventListener("pointerdown", stopLcp, { once: true, capture: true });
  addEventListener("keydown", stopLcp, { once: true, capture: true });

  observe("layout-shift", (entries) => {
    for (const e of entries as unknown as Array<{ value: number; hadRecentInput: boolean }>) {
      if (!e.hadRecentInput) metrics.cls += e.value;
    }
    emit();
  });

  observe("paint", (entries) => {
    const e = entries.find((x) => x.name === "first-contentful-paint");
    if (e) {
      metrics.fcp = Math.round(e.startTime);
      emit();
    }
  });

  observe("largest-contentful-paint", (entries) => {
    const last = entries[entries.length - 1];
    if (lcpDone || !last) return;
    metrics.lcp = Math.round(last.startTime);
    emit();
  });

  observe(
    "event",
    (entries) => {
      for (const e of entries as unknown as Array<PerformanceEntry & { interactionId: number }>) {
        if (e.interactionId && e.duration > (metrics.inp ?? 0)) {
          metrics.inp = Math.round(e.duration);
          emit();
        }
      }
    },
    { durationThreshold: 16 },
  );

  // Time-bucketed frame count smoothed with an EMA; emits only on bucket boundaries
  let fps = 0;
  let frames = 0;
  let bucketStart = 0;
  const tick = (now: number) => {
    if (!bucketStart) bucketStart = now;
    frames++;
    const elapsed = now - bucketStart;
    if (elapsed >= 250) {
      const raw = (frames / elapsed) * 1000;
      fps = fps ? fps * 0.85 + raw * 0.15 : raw;
      frames = 0;
      bucketStart = now;
      const rounded = Math.round(fps);
      if (rounded !== metrics.fps) {
        metrics.fps = rounded;
        emit();
      }
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/** Subscribe to metric updates. Starts collection on first call. */
export function subscribeMetrics(fn: Listener): () => void {
  listeners.add(fn);
  if (!started) start();
  fn(metrics);
  return () => listeners.delete(fn);
}
