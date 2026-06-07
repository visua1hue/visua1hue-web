import { animate, type AnimationOptions } from "motion";

const getCSSVar = (el: Element, name: string) =>
  getComputedStyle(el).getPropertyValue(name).trim();

const reducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const ease = (el: Element) =>
  getCSSVar(el, '--motion-ease-emphasized') || 'cubic-bezier(0.16, 1, 0.3, 1)';

const PRESETS = {
  'outline-fill': (el: HTMLElement) => ({
    keyframes: { opacity: [0, 1] },
    options: { duration: 0.7, easing: ease(el) },
  }),
  'fade-down': (el: HTMLElement) => ({
    keyframes: { opacity: [0.01, 1], transform: ['translateY(-30px)', 'translateY(0)'] },
    options: {
      duration: parseFloat(getCSSVar(el, '--motion-dur-base')) * 0.001 || 0.18,
      easing: ease(el),
    },
  }),
};

type PresetName = keyof typeof PRESETS;
const isPreset = (k: string | undefined): k is PresetName => !!k && k in PRESETS;

let lastPath = '';

export function initAnimations() {
  if (typeof window === 'undefined') return;
  const path = location.pathname;
  if (path === lastPath) return;
  lastPath = path;

  const run = async () => {
    if (document.fonts) await document.fonts.ready;
    const trigger = () => triggerLoadAnimations();
    const paints = performance.getEntriesByType('paint');
    if (paints.some(e => e.name === 'first-contentful-paint')) {
      trigger();
    } else if ('PerformancePaintTiming' in window) {
      const obs = new PerformanceObserver(list => {
        if (list.getEntries().some(e => e.name === 'first-contentful-paint')) {
          trigger(); obs.disconnect();
        }
      });
      obs.observe({ type: 'paint', buffered: true });
    } else {
      requestAnimationFrame(trigger);
    }
  };

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', run)
    : run();
}

function triggerLoadAnimations() {
  document.querySelectorAll<HTMLElement>('[data-motion]').forEach(el => {
    const type = el.dataset.motion;
    const delay = parseFloat(el.dataset.motionDelay || '0');

    if (reducedMotion()) return;

    if (isPreset(type)) {
      const { keyframes, options } = PRESETS[type](el);
      animate(el, keyframes, { ...options, delay } as AnimationOptions);
    } else if (type) {
      animate(el, { opacity: [0.01, 1] }, { duration: 0.5, delay } as AnimationOptions);
    }
  });
}
