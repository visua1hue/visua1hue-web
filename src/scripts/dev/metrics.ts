/**
 * METRICS HUD
 * Overlay: rolling FPS, LCP, CLS, INP.
 * Lazy-loaded on first backtick (`) press. Subsequent backticks toggle show / hide.
 */

const ROOT_ID  = '__dev-metrics';
const STYLE_ID = '__dev-metrics-style';
const FPS_WINDOW = 20;

const CSS = `
@keyframes __dev-fps-pump {
  to { transform: translateX(0.01px); }
}
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
  animation: __dev-fps-pump 1s linear infinite alternate;
}
#${ROOT_ID}[data-hidden] { display: none; animation: none; }
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

  // RAF: rolling frame-time window — always write, shows live fluctuation
  const tick = (now: number) => {
    frameTimes.push(now);
    if (frameTimes.length > FPS_WINDOW) frameTimes.shift();
    if (frameTimes.length >= 2) {
      const span = frameTimes[frameTimes.length - 1] - frameTimes[0];
      const raw  = span > 0 ? (frameTimes.length - 1) / span * 1000 : 0;
      fps = Math.round(fps === 0 ? raw : fps * 0.7 + raw * 0.3);
      fpsEl.textContent = String(fps);
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

  // Show / hide — persisted to localStorage
  const STORAGE_KEY = '__dev-metrics-visible';
  localStorage.setItem(STORAGE_KEY, 'true');
  let hidden = false;
  document.addEventListener('keydown', e => {
    if (e.key === '`' && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
      hidden = !hidden;
      if (hidden) {
        root.setAttribute('data-hidden', '');
        localStorage.setItem(STORAGE_KEY, 'false');
      } else {
        root.removeAttribute('data-hidden');
        localStorage.setItem(STORAGE_KEY, 'true');
      }
    }
  });
}
