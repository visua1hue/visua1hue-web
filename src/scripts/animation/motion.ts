import { animate, type AnimationOptions } from "motion";

/**
 * MOTION SYSTEM:
 * 1. Load Animations: Triggered via WAAPI after FCP (Zero render blocking)
 */

// UTILITIES
const getCSSVar = (el: Element, name: string) =>
  getComputedStyle(el).getPropertyValue(name).trim();

// ANIMATION PRESETS
const easing = (el: HTMLElement) =>
  getCSSVar(el, '--motion-ease-emphasized') || 'cubic-bezier(0.16, 1, 0.3, 1)';

const PRESETS = {
  'outline-fill': (el: HTMLElement) => ({
    keyframes: {
      opacity: [0, 1],
    },
    options: {
      duration: 0.7,
      easing: easing(el),
    }
  }),
  'fade-down': (el: HTMLElement) => ({
    keyframes: {
      opacity: [0.01, 1],
      transform: [`translateY(-30px)`, 'translateY(0)']
    },
    options: {
      duration: parseFloat(getCSSVar(el, '--motion-dur-base')) * 0.001 || 0.18,
      easing: easing(el)
    }
  }),
};

type PresetName = keyof typeof PRESETS;

function isPreset(key: string | undefined): key is PresetName {
  return key !== undefined && key in PRESETS;
}

// INITIALIZATION
export function initAnimations() {
  if (typeof window === 'undefined') return;

  const startLoadAnimations = async () => {
    if (document.fonts) {
      await document.fonts.ready;
    }

    const trigger = () => triggerLoadAnimations();

    const paintEntries = performance.getEntriesByType('paint');
    const fcpEntry = paintEntries.find(e => e.name === 'first-contentful-paint');

    if (fcpEntry) {
      trigger();
    } else if ('PerformancePaintTiming' in window) {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        if (entries.some(e => e.name === 'first-contentful-paint')) {
          trigger();
          observer.disconnect();
        }
      });
      observer.observe({ entryTypes: ['paint'] });
    } else {
      requestAnimationFrame(trigger);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startLoadAnimations);
  } else {
    startLoadAnimations();
  }
}

function triggerLoadAnimations() {
  const elements = document.querySelectorAll<HTMLElement>('[data-motion]');

  elements.forEach(el => {
    const type = el.dataset.motion;
    const delay = parseFloat(el.dataset.motionDelay || '0');

    if (isPreset(type)) {
      const { keyframes, options } = PRESETS[type](el);
      animate(el, keyframes, { ...options, delay } as AnimationOptions);
    } else if (type) {
      animate(el, { opacity: [0.01, 1] }, { duration: 0.5, delay } as AnimationOptions);
    }
  });
}
