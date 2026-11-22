import { subscribeDevMetrics } from "@/dev/dev-metrics";
import type { DevMetrics } from "@/dev/dev-metrics";

const KEY = "visua1hue-debugger";
type Key = keyof DevMetrics;

/** null keeps the placeholder; mem null means unsupported */
function format(key: Key, v: number | null): string | null {
  if (v === null) return key === "mem" ? "NA" : null;
  return key === "cls" ? v.toFixed(3) : String(v);
}

const load = () => {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false; // storage blocked
  }
};

const save = (on: boolean) => {
  try {
    localStorage.setItem(KEY, on ? "1" : "0");
  } catch {
    /* storage blocked */
  }
};

const snapshot = (root: HTMLElement) =>
  [
    `Dev metrics ${location.pathname} ${innerWidth}x${innerHeight}`,
    ...[...root.querySelectorAll<HTMLElement>(".cell")].map((cell) =>
      [...cell.children]
        .map((el) => el.textContent?.trim())
        .filter(Boolean)
        .join(" "),
    ),
  ].join("\n");

const flash = (el: HTMLElement) => {
  // var() inside WAAPI keyframes is unreliable across engines
  const soft = getComputedStyle(el).getPropertyValue("--color-soft").trim() || "currentColor";
  el.animate(
    [{ backgroundColor: `color-mix(in oklab, ${soft} 14%, transparent)` }, { backgroundColor: "transparent" }],
    { duration: 500, easing: "ease-out" },
  );
};

export function initDebugger(root: HTMLElement): () => void {
  const out = new Map(
    [...root.querySelectorAll<HTMLElement>("[data-m]")].map((el) => [el.dataset.m as Key, el] as const),
  );

  // Runs per FPS sample; write only changes
  const shown = new Map<Key, string>();
  const render = (m: Readonly<DevMetrics>) => {
    for (const [key, el] of out) {
      const text = format(key, m[key]);
      if (text === null || shown.get(key) === text) continue;
      shown.set(key, text);
      el.textContent = text;
    }
  };

  let unsubscribe: (() => void) | null = null;
  const set = (on: boolean) => {
    root.hidden = !on;
    if (on && !unsubscribe) unsubscribe = subscribeDevMetrics(render);
    if (!on && unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
  };

  const ac = new AbortController();
  set(load());
  addEventListener(
    "keydown",
    (e) => {
      if (e.key !== "`" || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      const on = root.hidden;
      set(on);
      save(on);
    },
    { signal: ac.signal },
  );

  root.addEventListener(
    "click",
    () =>
      navigator.clipboard
        .writeText(snapshot(root))
        .then(() => flash(root))
        .catch((err) => console.error("Debugger: copy failed", err)),
    { signal: ac.signal },
  );

  return () => {
    ac.abort();
    unsubscribe?.();
  };
}
