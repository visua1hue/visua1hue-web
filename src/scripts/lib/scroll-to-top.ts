export function scrollToTop(): void {
  const smooth = !matchMedia("(prefers-reduced-motion: reduce)").matches;
  scrollTo({ top: 0, behavior: smooth ? "smooth" : "instant" });
}
