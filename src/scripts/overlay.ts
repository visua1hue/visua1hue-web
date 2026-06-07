export function initOverlay(): void {
  const panel = document.getElementById("menu-panel");
  const toggle = document.getElementById("menu-toggle");
  if (!panel || !toggle) return;

  const content = Array.from(panel.querySelectorAll<HTMLElement>(".menu-socials, .menu-nav"));

  function close(): void {
    content.forEach((el) => { el.style.opacity = "0"; });
    // double rAF: lets the display:none removal process before re-triggering the transition
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        panel!.classList.remove("is-open");
        panel!.setAttribute("aria-hidden", "true");
        toggle!.setAttribute("aria-expanded", "false");
        toggle!.setAttribute("data-anim", "close");
        setTimeout(() => toggle!.removeAttribute("data-anim"), 250);
      })
    );
  }

  function open(): void {
    content.forEach((el) => { el.style.opacity = ""; });
    panel!.classList.add("is-open");
    toggle!.setAttribute("aria-expanded", "true");
    panel!.setAttribute("aria-hidden", "false");
  }

  toggle.addEventListener("click", () => {
    panel.classList.contains("is-open") ? close() : open();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && panel.classList.contains("is-open")) {
      close();
      toggle.focus();
      return;
    }
    if (
      e.key === "/" &&
      !e.metaKey && !e.ctrlKey && !e.altKey &&
      !(e.target instanceof HTMLInputElement) &&
      !(e.target instanceof HTMLTextAreaElement)
    ) {
      e.preventDefault();
      panel.classList.contains("is-open") ? close() : open();
      toggle.focus();
    }
  });

  document.addEventListener("click", (e) => {
    if (
      panel.classList.contains("is-open") &&
      !panel.contains(e.target as Node) &&
      !toggle.contains(e.target as Node)
    ) {
      close();
      toggle.focus();
    }
  });

  panel.querySelectorAll("a").forEach((a) => a.addEventListener("click", close));
}
