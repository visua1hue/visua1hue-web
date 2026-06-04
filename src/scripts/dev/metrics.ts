/**
 * DEV METRICS HUD
 * Dev-only observability overlay: FPS+sparkline, CWV, runtime signals, platform support.
 * Stripped from production via `import.meta.env.DEV` guard at import site.
 * Backtick (`) cycles: full → compact → hidden
 */

const ROOT_ID = '__dev-metrics';
const STYLE_ID = '__dev-metrics-style';
const STORAGE_KEY = '__dev-metrics-mode';
const SPARK_W = 216;
const SPARK_BAR = 2;
const SPARK_GAP = 0.5;
const FPS_SAMPLES = SPARK_W / SPARK_BAR;
const FPS_SAMPLE_MS = 250;
const FPS_SPARK_FLOOR = 20;
const FPS_SPARK_CEIL = 75;

type Status = 'good' | 'warn' | 'poor' | 'idle';
type Mode = 'full' | 'compact' | 'hidden';
const MODE_CYCLE: Mode[] = ['full', 'compact', 'hidden'];

const CSS = `
#${ROOT_ID} {
  position: fixed;
  bottom: 12px;
  right: 12px;
  z-index: 2147483647;
  width: 240px;
  padding: 10px 12px 12px;
  background: color-mix(in oklab, #0a0a0b 85%, transparent);
  color: #e8e8ea;
  font: 11px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace;
  font-variant-numeric: tabular-nums;
  border: 1px solid color-mix(in oklab, #fff 8%, transparent);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(0, 0, 0, 0.2);
  backdrop-filter: blur(12px) saturate(1.4);
  -webkit-backdrop-filter: blur(12px) saturate(1.4);
  user-select: none;
  pointer-events: auto;
  contain: layout style;
  view-transition-name: dev-metrics;
}
#${ROOT_ID}[data-mode="hidden"] { display: none; }
#${ROOT_ID}[data-mode="compact"] {
  width: auto;
  padding: 7px 11px;
}
::view-transition-old(dev-metrics),
::view-transition-new(dev-metrics) {
  animation-duration: 160ms;
  animation-timing-function: cubic-bezier(0.22, 1, 0.36, 1);
}
@media (prefers-reduced-motion: reduce) {
  ::view-transition-old(dev-metrics),
  ::view-transition-new(dev-metrics) { animation-duration: 0ms; }
}
#${ROOT_ID} .compact {
  display: inline-flex;
  align-items: baseline;
  gap: 14px;
  white-space: nowrap;
}
#${ROOT_ID} .compact .metric {
  display: inline-flex;
  align-items: baseline;
  gap: 5px;
}
#${ROOT_ID} .compact .metric .label {
  font-size: 9px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #6b7280;
}
#${ROOT_ID} .compact .metric .value {
  font-variant-numeric: tabular-nums;
  font-size: 11px;
  font-weight: 500;
  min-width: 3ch;
  text-align: right;
  color: #e8e8ea;
}
#${ROOT_ID} .compact .metric.good .value { color: #22c55e; }
#${ROOT_ID} .compact .metric.warn .value { color: #f59e0b; }
#${ROOT_ID} .compact .metric.poor .value { color: #ef4444; }
#${ROOT_ID} .compact .metric.idle .value { color: #6b7280; }
#${ROOT_ID} .compact .compact-badges {
  display: inline-flex;
  gap: 6px;
  margin-left: 4px;
}
#${ROOT_ID} header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 8px;
  margin-bottom: 8px;
  border-bottom: 1px solid color-mix(in oklab, #fff 6%, transparent);
}
#${ROOT_ID} h1 {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #9ca3af;
  margin: 0;
}
#${ROOT_ID} .hint {
  font-size: 10px;
  color: #6b7280;
}
#${ROOT_ID} .hint kbd {
  display: inline-block;
  padding: 1px 5px;
  font-family: inherit;
  font-size: 10px;
  color: #e8e8ea;
  background: color-mix(in oklab, #fff 8%, transparent);
  border: 1px solid color-mix(in oklab, #fff 10%, transparent);
}
#${ROOT_ID} .fps-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 4px;
}
#${ROOT_ID} .fps-val {
  font-size: 20px;
  font-weight: 500;
  letter-spacing: -0.02em;
  line-height: 1;
}
#${ROOT_ID} .fps-unit {
  font-size: 10px;
  color: #6b7280;
  margin-left: 2px;
}
#${ROOT_ID} .spark {
  display: block;
  width: 100%;
  height: 22px;
  margin-bottom: 10px;
}
#${ROOT_ID} section {
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid color-mix(in oklab, #fff 6%, transparent);
}
#${ROOT_ID} section:first-of-type { margin-top: 0; padding-top: 0; border-top: 0; }
#${ROOT_ID} section h2 {
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #6b7280;
  margin: 0 0 6px;
}
#${ROOT_ID} .row {
  display: grid;
  grid-template-columns: 1fr auto auto;
  align-items: center;
  gap: 8px;
  padding: 2px 0;
  color: #d1d5db;
}
#${ROOT_ID} .row .label { color: #9ca3af; }
#${ROOT_ID} .row .value { font-variant-numeric: tabular-nums; text-align: right; }
#${ROOT_ID} .dot {
  width: 6px;
  height: 6px;
  background: #4b5563;
}
#${ROOT_ID} .dot.good { background: #22c55e; box-shadow: 0 0 6px color-mix(in oklab, #22c55e 60%, transparent); }
#${ROOT_ID} .dot.warn { background: #f59e0b; box-shadow: 0 0 6px color-mix(in oklab, #f59e0b 60%, transparent); }
#${ROOT_ID} .dot.poor { background: #ef4444; box-shadow: 0 0 6px color-mix(in oklab, #ef4444 60%, transparent); }
#${ROOT_ID} .badge {
  display: inline-block;
  margin-left: 6px;
  padding: 1px 5px;
  font-size: 9px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #fbbf24;
  background: color-mix(in oklab, #fbbf24 18%, transparent);
  border: 1px solid color-mix(in oklab, #fbbf24 30%, transparent);
}
`;

const STATUS_COLOR: Record<Status, string> = {
  good: '#22c55e',
  warn: '#f59e0b',
  poor: '#ef4444',
  idle: '#4b5563',
};

const cwv = {
  lcp: (ms: number): Status => (ms === 0 ? 'idle' : ms < 2500 ? 'good' : ms < 4000 ? 'warn' : 'poor'),
  cls: (v: number): Status => (v < 0.1 ? 'good' : v < 0.25 ? 'warn' : 'poor'),
  inp: (ms: number): Status => (ms === 0 ? 'idle' : ms < 200 ? 'good' : ms < 500 ? 'warn' : 'poor'),
  fps: (v: number): Status => (v >= 55 ? 'good' : v >= 30 ? 'warn' : 'poor'),
};

export function initDevMetrics() {
  if (typeof window === 'undefined') return;
  if (document.getElementById(ROOT_ID)) return;

  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  const root = document.createElement('div');
  root.id = ROOT_ID;
  root.setAttribute('aria-hidden', 'true');
  let mode: Mode = (localStorage.getItem(STORAGE_KEY) as Mode) || 'full';
  if (!MODE_CYCLE.includes(mode)) mode = 'full';
  root.dataset.mode = mode;
  document.body.appendChild(root);

  // State
  let fps = 0;
  const fpsHistory: number[] = [];
  let cls = 0;
  let lcp = 0;
  let inp = 0;
  let longTasks = 0;

  const observe = (
    type: string,
    cb: (entries: PerformanceEntryList) => void,
    opts: Record<string, unknown> = { buffered: true }
  ) => {
    try {
      const po = new PerformanceObserver((list) => cb(list.getEntries()));
      po.observe({ type, ...opts } as PerformanceObserverInit);
    } catch {
      /* unsupported */
    }
  };

  observe('layout-shift', (entries) => {
    for (const e of entries as unknown as Array<PerformanceEntry & { value: number; hadRecentInput: boolean }>) {
      if (!e.hadRecentInput) cls += e.value;
    }
  });
  observe('largest-contentful-paint', (entries) => {
    const last = entries[entries.length - 1];
    if (last) lcp = Math.round(last.startTime);
  });
  observe('longtask', (entries) => {
    longTasks += entries.length;
  });
  observe(
    'event',
    (entries) => {
      for (const e of entries) {
        if (e.duration > inp) inp = Math.round(e.duration);
      }
    },
    { buffered: true, durationThreshold: 16 }
  );

  const rmQuery = matchMedia('(prefers-reduced-motion: reduce)');
  let reducedMotion = rmQuery.matches;
  rmQuery.addEventListener('change', (e) => {
    reducedMotion = e.matches;
    render();
  });

  const sparkline = () => {
    const peak = Math.max(FPS_SPARK_CEIL, ...fpsHistory);
    const floor = FPS_SPARK_FLOOR;
    const range = peak - floor;
    const h = 22;
    const barVis = SPARK_BAR - SPARK_GAP;
    const baseline60 = h - ((60 - floor) / range) * h;
    const startX = SPARK_W - fpsHistory.length * SPARK_BAR;
    const bars = fpsHistory
      .map((v, i) => {
        const norm = Math.max(0, Math.min(1, (v - floor) / range));
        const barH = Math.max(1, norm * h);
        const y = h - barH;
        const x = startX + i * SPARK_BAR;
        const color = STATUS_COLOR[cwv.fps(v)];
        return `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${barVis.toFixed(2)}" height="${barH.toFixed(2)}" fill="${color}" opacity="0.9"/>`;
      })
      .join('');
    const guide = `<line x1="0" x2="${SPARK_W}" y1="${baseline60.toFixed(2)}" y2="${baseline60.toFixed(2)}" stroke="#ffffff" stroke-opacity="0.12" stroke-dasharray="2 3"/>`;
    return `<svg class="spark" viewBox="0 0 ${SPARK_W} ${h}" preserveAspectRatio="none">${guide}${bars}</svg>`;
  };

  const row = (label: string, value: string, status?: Status) => {
    const dot = status ? `<span class="dot ${status}"></span>` : '<span></span>';
    return `<div class="row"><span class="label">${label}</span><span class="value">${value}</span>${dot}</div>`;
  };

  const compactMetric = (label: string, value: string, status: Status = 'idle') =>
    `<div class="metric ${status}"><span class="label">${label}</span><span class="value">${value}</span></div>`;

  const renderFull = () => `
      <header>
        <h1>Metrics${reducedMotion ? '<span class="badge">reduced motion</span>' : ''}</h1>
        <span class="hint"><kbd>\`</kbd> cycle</span>
      </header>
      <div class="fps-row">
        <span><span class="fps-val">${fps}</span><span class="fps-unit">fps</span></span>
        <span class="dot ${cwv.fps(fps)}"></span>
      </div>
      ${sparkline()}
      <section>
        <h2>Core Web Vitals</h2>
        ${row('LCP', lcp ? `${lcp} ms` : '—', cwv.lcp(lcp))}
        ${row('CLS', cls.toFixed(3), cwv.cls(cls))}
        ${row('INP', inp ? `${inp} ms` : '—', cwv.inp(inp))}
        ${longTasks > 0 ? row('Long tasks', String(longTasks), 'warn') : ''}
      </section>
    `;

  const renderCompact = () => {
    const badges: string[] = [];
    if (longTasks > 0) badges.push(`<span class="badge">LT ${longTasks}</span>`);
    if (reducedMotion) badges.push(`<span class="badge">RM</span>`);
    return `
      <div class="compact">
        ${compactMetric('FPS', String(fps), cwv.fps(fps))}
        ${compactMetric('LCP', lcp ? `${lcp}` : '—', cwv.lcp(lcp))}
        ${compactMetric('CLS', cls.toFixed(2), cwv.cls(cls))}
        ${compactMetric('INP', inp ? `${inp}` : '—', cwv.inp(inp))}
        ${badges.length ? `<span class="compact-badges">${badges.join('')}</span>` : ''}
      </div>
    `;
  };

  const render = () => {
    if (mode === 'hidden') return;
    root.innerHTML = mode === 'compact' ? renderCompact() : renderFull();
  };

  // FPS + periodic sampling
  let frames = 0;
  let lastSample = performance.now();
  const tick = (now: number) => {
    frames++;
    const delta = now - lastSample;
    if (delta >= FPS_SAMPLE_MS) {
      fps = Math.round((frames * 1000) / delta);
      fpsHistory.push(fps);
      if (fpsHistory.length > FPS_SAMPLES) fpsHistory.shift();
      frames = 0;
      lastSample = now;
      render();
    }
    requestAnimationFrame(tick);
  };
  render();
  requestAnimationFrame(tick);

  type ViewTransitionDoc = Document & {
    startViewTransition?: (cb: () => void) => { finished: Promise<void> };
  };

  const applyMode = (next: Mode) => {
    mode = next;
    const doc = document as ViewTransitionDoc;
    const swap = () => {
      root.dataset.mode = mode;
      render();
    };
    if (doc.startViewTransition && !reducedMotion) {
      doc.startViewTransition(swap);
    } else {
      swap();
    }
    localStorage.setItem(STORAGE_KEY, mode);
  };

  document.addEventListener('keydown', (e) => {
    if (e.key === '`' && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
      const next = MODE_CYCLE[(MODE_CYCLE.indexOf(mode) + 1) % MODE_CYCLE.length];
      applyMode(next);
    }
  });
}
