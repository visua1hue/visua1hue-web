/**
 * DEV METRICS HUD
 * Dev-only overlay: rolling FPS, LCP, CLS, INP.
 * Stripped from production via `import.meta.env.DEV` guard at import site.
 * Backtick (`) toggles show / hide.
 */

const ROOT_ID  = '__dev-metrics';
const STYLE_ID = '__dev-metrics-style';
const FPS_WINDOW = 20;
const REFRESH_RATES = [30, 48, 60, 72, 90, 120, 144, 165, 240];
const snapFps = (v: number) => {
  const nearest = REFRESH_RATES.reduce((a, b) => Math.abs(b - v) < Math.abs(a - v) ? b : a);
  return Math.abs(nearest - v) <= 3 ? nearest : v;
};

const CSS = `
#${ROOT_ID} {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 2147483647;
  display: grid;
  grid-template-columns: auto 7ch;
  column-gap: 8px;
  font: 11px/1.8 ui-monospace, SFMono-Regular, Menlo, monospace;
  font-variant-numeric: tabular-nums;
  color: #fff;
  user-select: none;
  pointer-events: auto;
  cursor: default;
  contain: layout style;
}
#${ROOT_ID}[data-hidden] { display: none; }
#${ROOT_ID} > div { display: contents; }
#${ROOT_ID} .lbl { opacity: 0.5; }
#${ROOT_ID} .val { text-align: right; }
#${ROOT_ID} { cursor: pointer; }
`;

export function initDevMetrics() {
  if (typeof window === 'undefined') return;
  if (document.getElementById(ROOT_ID)) return;

  if (!document.getElementById(STYLE_ID)) {
    const s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  const root = document.createElement('div');
  root.id = ROOT_ID;
  root.setAttribute('aria-hidden', 'true');
  document.body.appendChild(root);

  // Build rows once — hold value element refs, never touch innerHTML again
  const mkRow = (label: string, initial = '—'): HTMLElement => {
    const row = document.createElement('div');
    const lbl = document.createElement('span');
    lbl.className = 'lbl';
    lbl.textContent = `${label}: `;
    const val = document.createElement('span');
    val.className = 'val';
    val.textContent = initial;
    row.appendChild(lbl);
    row.appendChild(val);
    root.appendChild(row);
    return val;
  };

  const fpsEl = mkRow('FPS', '—');
  const fcpEl = mkRow('FCP', '—');
  const lcpEl = mkRow('LCP', '—');
  const clsEl = mkRow('CLS', '0.000');
  const inpEl = mkRow('INP', '—');

  // State
  let fps = 0, fcp = 0, clsScore = 0, lcp = 0, inp = 0;
  const frameTimes: number[] = [];

  const observe = (
    type: string,
    cb: (entries: PerformanceEntryList) => void,
    opts: Record<string, unknown> = { buffered: true },
  ) => {
    try {
      const po = new PerformanceObserver(list => cb(list.getEntries()));
      po.observe({ type, ...opts } as PerformanceObserverInit);
    } catch { /* unsupported */ }
  };

  observe('layout-shift', entries => {
    for (const e of entries as unknown as Array<PerformanceEntry & { value: number; hadRecentInput: boolean }>) {
      if (!e.hadRecentInput) clsScore += e.value;
    }
    clsEl.textContent = clsScore.toFixed(3);
  });

  observe('paint', entries => {
    const e = entries.find(e => e.name === 'first-contentful-paint');
    if (e) { fcp = Math.round(e.startTime); fcpEl.textContent = `${fcp} ms`; }
  });

  observe('largest-contentful-paint', entries => {
    const last = entries[entries.length - 1];
    if (last) { lcp = Math.round(last.startTime); lcpEl.textContent = `${lcp} ms`; }
  });

  observe('event', entries => {
    for (const e of entries) {
      if (e.duration > inp) { inp = Math.round(e.duration); inpEl.textContent = `${inp} ms`; }
    }
  }, { buffered: true, durationThreshold: 16 });

  // RAF: rolling frame-time window — textContent only, no re-render
  const tick = (now: number) => {
    frameTimes.push(now);
    if (frameTimes.length > FPS_WINDOW) frameTimes.shift();
    if (frameTimes.length >= 2) {
      const span = frameTimes[frameTimes.length - 1] - frameTimes[0];
      const raw  = span > 0 ? (frameTimes.length - 1) / span * 1000 : 0;
      // EMA smoothing — damps single-frame jitter, tracks real changes within ~4 frames
      const next = snapFps(Math.round(fps === 0 ? raw : fps * 0.75 + raw * 0.25));
      if (next !== fps) { fps = next; fpsEl.textContent = String(fps); }
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  // Copy all metrics on click
  root.addEventListener('click', () => {
    const rows = root.querySelectorAll<HTMLElement>('div');
    const text = Array.from(rows)
      .map(r => r.textContent?.trim())
      .filter(Boolean)
      .join('\n');
    navigator.clipboard.writeText(text).catch(() => {});
  });

  // Show / hide
  let hidden = false;
  document.addEventListener('keydown', e => {
    if (e.key === '`' && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
      hidden = !hidden;
      hidden ? root.setAttribute('data-hidden', '') : root.removeAttribute('data-hidden');
    }
  });
}
