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

function pathLen(el: Element): number {
  if (el instanceof SVGPathElement) return el.getTotalLength();
  if (el instanceof SVGRectElement) return 2 * (el.width.baseVal.value + el.height.baseVal.value);
  return 0;
}

const DRAW_MS = 600;

// Strong refs prevent WAAPI fill:'forwards' from GC
const live = new Set<Animation>();

function drawStroke(group: SVGElement, delay: number) {
  group.style.opacity = '1';
  const e = ease(group);

  // Only animate stroke-layer paths — fill-layer paths are a separate compositor layer
  group.querySelectorAll<SVGGeometryElement>('.stroke-layer path, .stroke-layer rect').forEach(child => {
    const len = pathLen(child);
    if (!len) return;

    child.style.setProperty('stroke-dasharray', String(len));
    child.style.setProperty('stroke-dashoffset', String(len));

    const anim = child.animate(
      [{ strokeDashoffset: String(len) }, { strokeDashoffset: '0' }],
      { duration: DRAW_MS, delay: delay * 1000, easing: e, fill: 'forwards' }
    );
    live.add(anim);

    anim.onfinish = () => {
      child.style.setProperty('stroke-dashoffset', '0');
      anim.cancel();
      live.delete(anim);
    };
  });
}

function waapi(
  el: Element,
  keyframes: Keyframe[],
  options: KeyframeAnimationOptions,
  commit: () => void,
) {
  const anim = el.animate(keyframes, { ...options, fill: 'forwards' });
  live.add(anim);
  anim.onfinish = () => { commit(); anim.cancel(); live.delete(anim); };
}

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
  let maxSvgDelay = -1;
  let svgWrapper: HTMLElement | null = null;
  const svgGroups: SVGElement[] = [];

  document.querySelectorAll<HTMLElement>('[data-motion]').forEach(el => {
    const type = el.dataset.motion;
    const delay = parseFloat(el.dataset.motionDelay || '0');

    if (el instanceof SVGElement) {
      if (reducedMotion()) { el.style.opacity = '1'; return; }
      drawStroke(el, delay);
      svgGroups.push(el);
      if (delay > maxSvgDelay) {
        maxSvgDelay = delay;
        svgWrapper = el.closest<HTMLElement>('.wordmark');
      }
      return;
    }

    if (isPreset(type)) {
      const { keyframes, options } = PRESETS[type](el);
      animate(el, keyframes, { ...options, delay } as AnimationOptions);
    } else if (type) {
      animate(el, { opacity: [0.01, 1] }, { duration: 0.5, delay } as AnimationOptions);
    }
  });

  // Stagger radially from "1" — compositor-only opacity on separate layers
  const pivotIndex = svgGroups.findIndex(el => (el as SVGElement & { id: string }).id === 'Char-1');
  const pivot = pivotIndex >= 0 ? pivotIndex : Math.floor(svgGroups.length / 2);

  if (svgWrapper && maxSvgDelay >= 0) {
    const wrapper = svgWrapper as HTMLElement;
    setTimeout(() => {
      const e = ease(wrapper);

      svgGroups.forEach((el, i) => {
        const delay = Math.abs(i - pivot) * 50;

        const fillLayer = el.querySelector('.fill-layer');
        const strokeLayer = el.querySelector('.stroke-layer');

        if (fillLayer) {
          waapi(fillLayer, [{ opacity: '0' }, { opacity: '1' }],
            { duration: 500, delay, easing: e },
            () => { (fillLayer as HTMLElement).style.opacity = '1'; }
          );
        }

        if (strokeLayer) {
          waapi(strokeLayer, [{ opacity: '1' }, { opacity: '0' }],
            { duration: 350, delay, easing: 'ease-out' },
            () => { (strokeLayer as HTMLElement).style.opacity = '0'; }
          );
        }
      });

      // Soft shine at mid-cascade peak
      wrapper.animate(
        [{ filter: 'brightness(1)' }, { filter: 'brightness(1.3)' }, { filter: 'brightness(1)' }],
        { duration: 650, delay: 180, easing: 'ease-in-out' }
      );
    }, maxSvgDelay * 1000 + DRAW_MS);
  }
}
