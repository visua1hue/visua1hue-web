/**
 * Contract between the hero's components and its scripts. Components mark their
 * elements with `data-hero={part}`; scripts look them up only through `heroParts`.
 */
export type HeroPart = "root" | "field" | "logo" | "slice" | "copy" | "build" | "debug" | "metric";

export interface HeroParts {
  root: HTMLElement;
  field: HTMLCanvasElement;
  logo: HTMLElement;
  slice: HTMLElement;
  copy: HTMLElement;
  build: HTMLElement | null;
  debug: HTMLElement | null;
  metrics: HTMLElement[];
}

const sel = (part: HeroPart) => `[data-hero="${part}"]`;

/** Collects the parts of one hero. Throws if a required part is missing, so a renamed attribute fails loudly. */
export function heroParts(root: HTMLElement): HeroParts {
  const req = <T extends Element>(part: HeroPart) => {
    const el = root.querySelector<T>(sel(part));
    if (!el) throw new Error(`Hero part "${part}" missing`);
    return el;
  };
  return {
    root,
    field: req<HTMLCanvasElement>("field"),
    logo: req<HTMLElement>("logo"),
    slice: req<HTMLElement>("slice"),
    copy: req<HTMLElement>("copy"),
    build: root.querySelector<HTMLElement>(sel("build")),
    debug: root.querySelector<HTMLElement>(sel("debug")),
    metrics: [...root.querySelectorAll<HTMLElement>(sel("metric"))],
  };
}

export const heroRoots = () => document.querySelectorAll<HTMLElement>(sel("root"));
