import { subscribeMetrics, type Metrics } from "@scripts/lib/metrics";

const KEY = "visua1hue-debug";
type Shown = "fcp" | "lcp" | "inp" | "cls" | "fps";

/** On unless the visitor switched it off. */
const load = () => {
  try {
    return localStorage.getItem(KEY) !== "0";
  } catch {
    return true; // storage blocked
  }
};

const save = (on: boolean) => {
  try {
    localStorage.setItem(KEY, on ? "1" : "0");
  } catch {
    /* storage blocked */
  }
};

/** DEBUG on/off, persisted. While on, shows live metrics; while off, collection is unsubscribed. */
export function initDebugToggle(root: HTMLElement): () => void {
  const btn = root.querySelector<HTMLElement>("[data-debug-toggle]");
  const val = root.querySelector<HTMLElement>("[data-debug-value]");
  const panel = root.querySelector<HTMLElement>("[data-debug-panel]");
  if (!btn || !val || !panel) return () => {};

  const out = Object.fromEntries(
    [...panel.querySelectorAll<HTMLElement>("[data-m]")].map((el) => [el.dataset.m, el]),
  ) as Record<Shown, HTMLElement>;

  // Write only changed values; this runs on every FPS sample
  const last: Partial<Record<Shown, string>> = {};
  const write = (key: Shown, text: string) => {
    if (last[key] === text) return;
    last[key] = text;
    out[key].textContent = text;
  };
  const render = (m: Readonly<Metrics>) => {
    if (m.fcp !== null) write("fcp", String(m.fcp));
    if (m.lcp !== null) write("lcp", String(m.lcp));
    if (m.inp !== null) write("inp", String(m.inp));
    if (m.fps !== null) write("fps", String(m.fps));
    write("cls", m.cls.toFixed(3));
  };

  let unsubscribe: (() => void) | null = null;
  const set = (on: boolean) => {
    btn.setAttribute("aria-pressed", String(on));
    val.textContent = on ? "True" : "False";
    panel.hidden = !on;
    if (on && !unsubscribe) unsubscribe = subscribeMetrics(render);
    if (!on && unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
  };

  const ac = new AbortController();
  set(load());
  btn.addEventListener(
    "click",
    () => {
      const on = btn.getAttribute("aria-pressed") !== "true";
      set(on);
      save(on);
    },
    { signal: ac.signal },
  );

  return () => {
    ac.abort();
    unsubscribe?.();
  };
}
