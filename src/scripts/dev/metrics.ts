/**
 * METRICS HUD
 * Overlay: rolling FPS, LCP, CLS, INP.
 * Lazy-loaded on first backtick (`) press. Subsequent backticks toggle show / hide.
 */

import { subscribeMetrics } from '@scripts/metrics';

const ROOT_ID  = '__dev-metrics';
const STYLE_ID = '__dev-metrics-style';

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
  grid-template-columns: auto minmax(7ch, auto);
  column-gap: 8px;
  font: 11px/1.8 ui-monospace, SFMono-Regular, Menlo, monospace;
  font-variant-numeric: tabular-nums;
  color: oklch(1 0 0);
  /* Grayscale the backdrop before differencing it — without this, a saturated
     bg (e.g. red) differences against white into another hue (cyan) instead
     of a clean invert. backdrop-filter runs first, then the blend mode below
     diffs against the now-desaturated result. */
  -webkit-backdrop-filter: grayscale(1);
  backdrop-filter: grayscale(1);
  mix-blend-mode: difference;
  user-select: none;
  pointer-events: auto;
  cursor: default;
  contain: layout style;
  animation: __dev-fps-pump 1s linear infinite alternate;
}
#${ROOT_ID}[data-hidden] { display: none; animation: none; }
#${ROOT_ID} > div { display: contents; }
#${ROOT_ID} .lbl { opacity: 0.5; white-space: nowrap; }
#${ROOT_ID} .val { text-align: right; white-space: nowrap; }
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

  const ms = (v: number | null) => (v === null ? '—' : `${v} ms`);
  subscribeMetrics(m => {
    fpsEl.textContent = m.fps === null ? '—' : String(m.fps);
    fcpEl.textContent = ms(m.fcp);
    lcpEl.textContent = ms(m.lcp);
    clsEl.textContent = m.cls.toFixed(3);
    inpEl.textContent = ms(m.inp);
  });

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
