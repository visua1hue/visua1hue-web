function show(el: HTMLElement | null, delay: number): void {
  if (!el) return;
  setTimeout(() => {
    el.classList.add("is-visible");
    el.addEventListener("transitionend", () => { el.style.willChange = "auto"; }, { once: true });
  }, delay);
}

export async function runEntrance(): Promise<void> {
  await document.fonts.ready;
  const base = 100;
  show(document.getElementById("lower"), 50);
  show(document.querySelector<HTMLElement>(".hero-logo-svg"), base);
  show(document.querySelector<HTMLElement>(".hero-bio"), base + 320);
  document.querySelectorAll<HTMLElement>(".hero-statement-line").forEach((el) => show(el, base + 320));
  show(document.querySelector<HTMLElement>(".site-nav"), base + 320);
  setTimeout(() => document.body.classList.remove("is-loading"), base + 520);
}
