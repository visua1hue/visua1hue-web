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
  show(document.querySelector<HTMLElement>(".logotype"), base);
  setTimeout(() => document.body.classList.remove("is-loading"), base + 520);
}
