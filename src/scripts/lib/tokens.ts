/** Reads numeric design tokens (custom properties from styles/variables.css) so scripts don't duplicate them. */
export function readTokens<K extends string>(el: Element, names: Record<K, string>): Record<K, number> {
  const style = getComputedStyle(el);
  const out = {} as Record<K, number>;
  for (const key in names) {
    const value = parseFloat(style.getPropertyValue(names[key]));
    if (Number.isNaN(value)) throw new Error(`Missing design token ${names[key]}`);
    out[key] = value;
  }
  return out;
}
