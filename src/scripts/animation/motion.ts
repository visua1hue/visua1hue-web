import { animate, inView, type AnimationOptions } from "motion";

/**
 * MOTION SYSTEM:
 * 1. Load Animations: Triggered via WAAPI after FCP (Zero render blocking)
 * 2. Scroll Animations:
 *    - S-Tier: Native CSS `animation-timeline` (Compositor)
 *    - A-Tier: WAAPI fallback (Compositor)
 */

// UTILITIES
const getCSSVar = (el: Element, name: string) =>
  getComputedStyle(el).getPropertyValue(name).trim();

const parseDuration = (val: string) =>
  parseFloat(val) * (val.includes('ms') ? 0.001 : 1);

// ANIMATION PRESETS
const PRESETS = {
  'blur-focus': (el: HTMLElement) => ({
    keyframes: {
      opacity: [0, 1],
      filter: [`blur(20px) hue-rotate(90deg)`, 'blur(0px) hue-rotate(0deg)'],
      transform: ['scale(1.1)', 'scale(1)']
    },
    options: {
      duration: parseDuration(getCSSVar(el, '--motion-dur-long')) || 0.6,
      easing: [0.25, 0.1, 0.25, 1] as const // explicit tuple type
    }
  }),
  'fade-down': (el: HTMLElement) => ({
    keyframes: {
      opacity: [0, 1],
      transform: [`translateY(-30px)`, 'translateY(0)']
    },
    options: {
      duration: parseDuration(getCSSVar(el, '--motion-dur-base')) || 0.18,
      easing: [0.25, 0.1, 0.25, 1] as const
    }
  }),
  'fade-up': (el: HTMLElement) => ({
    keyframes: {
      opacity: [0, 1],
      transform: [`translateY(30px)`, 'translateY(0)']
    },
    options: {
      duration: parseDuration(getCSSVar(el, '--motion-dur-base')) || 0.18,
      easing: [0.25, 0.1, 0.25, 1] as const
    }
  })
};

// Define valid preset keys
type PresetName = keyof typeof PRESETS;

// Helper type guard to check if a string is a valid preset
function isPreset(key: string | undefined): key is PresetName {
  return key !== undefined && key in PRESETS;
}

// INITIALIZATION
export function initAnimations() {
  if (typeof window === 'undefined') return;

  const startLoadAnimations = () => {
    const paintEntries = performance.getEntriesByType('paint');
    const fcpEntry = paintEntries.find(e => e.name === 'first-contentful-paint');

    if (fcpEntry) {
      // FCP already happened, trigger immediately
      triggerLoadAnimations();
    } else if ('PerformancePaintTiming' in window) {
      // FCP hasn't happened yet, observe it
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        if (entries.some(e => e.name === 'first-contentful-paint')) {
          triggerLoadAnimations();
          observer.disconnect();
        }
      });
      observer.observe({ entryTypes: ['paint'] });
    } else {
      // Fallback
      requestAnimationFrame(() => triggerLoadAnimations());
    }
  };

  const start = () => {
    startLoadAnimations();
    initScrollFallback();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
}

function triggerLoadAnimations() {
  const elements = document.querySelectorAll<HTMLElement>('[data-motion]');

  elements.forEach(el => {
    const type = el.dataset.motion;
    const delay = parseFloat(el.dataset.motionDelay || '0');

    if (isPreset(type)) {
      const { keyframes, options } = PRESETS[type](el);
      // Use 'any' for options to bypass strict Motion One types if needed,
      // or ensure options strictly match AnimationOptions
      animate(el, keyframes, { ...options, delay } as AnimationOptions);
    }
  });
}

function initScrollFallback() {
  if (typeof window === 'undefined' || (CSS.supports && CSS.supports("animation-timeline: view()"))) return;

  const elements = document.querySelectorAll<HTMLElement>('[data-motion-scroll]');

  elements.forEach(el => {
    const type = el.dataset.motionScroll;

    if (isPreset(type)) {
      inView(el, () => {
        const { keyframes, options } = PRESETS[type](el);
        animate(el, keyframes, options as AnimationOptions);
      });
    }
  });
}
