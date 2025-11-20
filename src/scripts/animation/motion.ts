/**
 * MOTION ORCHESTRATOR
 * This script implements the "A-Tier" fallback for our Hybrid Animation System.
 *
 * ARCHITECTURE:
 * 1. S-TIER (Native CSS): Modern browsers use `animation-timeline: view()` defined
 *    in `motion.css`. This runs entirely on the Compositor Thread (0ms Main Thread cost).
 *
 * 2. A-TIER (Fallback): This script detects browsers without `view()` support
 *    (e.g., older Safari/Mobile) and uses Motion One to manually animate elements.
 *    It reads the CSS utility classes (.motion-preset-*) to determine the animation.
 *
 * USAGE:
 * Import `initAnimations` in your app entry point and call it once.
 * The script automatically exits if native support is detected.
 */

import { inView, animate } from "motion";

const supportsScrollTimeline = CSS.supports("animation-timeline: view()");

export function initAnimations() {
  // 1. If native support exists, exit immediately (S-Tier performance)
  if (supportsScrollTimeline) return;

  // 2. Fallback for legacy browsers (A-Tier)
  // We explicitly type 'info' as 'any' to bypass the TS inference mismatch
  inView(".motion-scroll", (info: any) => {
    // Robust check: use .target if it's an Entry, or the object itself if it's an Element
    const element = (info.target || info) as HTMLElement;

    // Map CSS classes to animation definitions
    const getAnimation = () => {
      if (element.classList.contains("motion-preset-fade-up")) {
        return {
          keyframes: { opacity: [0, 1], transform: ["translateY(30px)", "translateY(0)"] },
          options: { duration: 0.5, easing: [0.25, 0.1, 0.25, 1] }
        };
      }

      if (element.classList.contains("motion-preset-fade-down")) {
        return {
          keyframes: { opacity: [0, 1], transform: ["translateY(-30px)", "translateY(0)"] },
          options: { duration: 0.5, easing: [0.25, 0.1, 0.25, 1] }
        };
      }

      if (element.classList.contains("motion-preset-scale")) {
        return {
          keyframes: { opacity: [0, 1], transform: ["scale(0.95)", "scale(1)"] },
          options: { duration: 0.5, easing: [0.25, 0.1, 0.25, 1] }
        };
      }

      if (element.classList.contains("motion-preset-blur")) {
        return {
          keyframes: { opacity: [0, 1], filter: ["blur(10px)", "blur(0)"] },
          options: { duration: 0.6, easing: "ease-out" }
        };
      }

      // Default fallback
      return {
        keyframes: { opacity: [0, 1] },
        options: { duration: 0.3 }
      };
    };

    const { keyframes, options } = getAnimation();

    animate(element, keyframes, options);
  });
}
