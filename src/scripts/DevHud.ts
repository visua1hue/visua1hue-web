import { subscribeDevMetrics, type DevMetrics } from "@scripts/lib/dev-metrics";
import { subscribeMetrics, type Metrics } from "@scripts/lib/metrics";

const KEY = "visua1hue-hud";
type Shown = "fps" | "fcp" | "lcp" | "inp" | "cls" | "mem" | "delay" | "jank" | "net" | "css";

/** Shown unless switched off with the backtick key. */
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

/** Dev metrics HUD. Backtick toggles it, persisted; while hidden, collection is unsubscribed. */
export function initDevHud(root: HTMLElement): () => void {
  const out = Object.fromEntries(
    [...root.querySelectorAll<HTMLElement>("[data-m]")].map((el) => [el.dataset.m, el]),
  ) as Record<Shown, HTMLElement>;

  // Write only changed values; this runs on every FPS sample
  const last: Partial<Record<Shown, string>> = {};
  const write = (key: Shown, text: string) => {
    if (last[key] === text) return;
    last[key] = text;
    out[key].textContent = text;
  };
  const render = (m: Readonly<Metrics>) => {
    if (m.fps !== null) write("fps", String(m.fps));
    if (m.fcp !== null) write("fcp", String(m.fcp));
    if (m.lcp !== null) write("lcp", String(m.lcp));
    if (m.inp !== null) write("inp", String(m.inp));
    write("cls", m.cls.toFixed(3));
  };

  const renderDev = (m: Readonly<DevMetrics>) => {
    write("mem", m.mem === null ? "NA" : String(m.mem));
    write("delay", String(m.delay));
    write("jank", String(m.jank));
    write("net", String(m.net));
    write("css", String(m.css));
  };

  let unsubscribe: (() => void) | null = null;
  const set = (on: boolean) => {
    root.hidden = !on;
    if (on && !unsubscribe) {
      const stops = [subscribeMetrics(render), subscribeDevMetrics(renderDev)];
      unsubscribe = () => stops.forEach((stop) => stop());
    }
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

  return () => {
    ac.abort();
    unsubscribe?.();
  };
}
