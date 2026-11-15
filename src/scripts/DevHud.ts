import { subscribeDevMetrics, type DevMetrics } from "@scripts/lib/dev-metrics";

const KEY = "visua1hue-hud";
type Key = keyof DevMetrics;

/** How a value reads. Null keeps the placeholder: not measured yet (heap: unsupported, so "NA") */
function format(key: Key, v: number | null): string | null {
  if (v === null) return key === "mem" ? "NA" : null;
  return key === "cls" ? v.toFixed(3) : String(v);
}

/** Hidden until switched on with the backtick key. */
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

/** Plain-text snapshot of the HUD for pasting, e.g. "LCP 840 ms". */
const snapshot = (root: HTMLElement) =>
  [
    `Dev metrics ${location.pathname} ${innerWidth}x${innerHeight}`,
    ...[...root.querySelectorAll<HTMLElement>(".cell")].map((cell) =>
      [...cell.children].map((el) => el.textContent?.trim()).filter(Boolean).join(" "),
    ),
  ].join("\n");

/** Brief background fade confirming the copy. */
const flash = (el: HTMLElement) => {
  // Resolve the token here: var() support inside WAAPI keyframes is uneven across engines
  const soft = getComputedStyle(el).getPropertyValue("--color-soft").trim() || "currentColor";
  el.animate(
    [{ backgroundColor: `color-mix(in oklab, ${soft} 14%, transparent)` }, { backgroundColor: "transparent" }],
    { duration: 500, easing: "ease-out" },
  );
};

/** Dev metrics HUD. Backtick toggles it, persisted; while hidden, collection is unsubscribed. Click copies. */
export function initDevHud(root: HTMLElement): () => void {
  const out = new Map(
    [...root.querySelectorAll<HTMLElement>("[data-m]")].map((el) => [el.dataset.m as Key, el] as const),
  );

  // Write only changed values; this runs on every frame-rate sample
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
        .catch((err) => console.error("DevHud: copy failed", err)),
    { signal: ac.signal },
  );

  return () => {
    ac.abort();
    unsubscribe?.();
  };
}
