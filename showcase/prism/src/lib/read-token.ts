/**
 * Resolve a design-system token to its computed value.
 *
 * Charting libraries paint into a canvas and cannot read CSS variables, so the
 * only way a chart follows the palette is to hand it resolved values — and to
 * re-hand them when the mode changes (watch `data-mode` on the root element).
 * Never hardcode a hex here; that is what strands a chart on the old palette.
 */
export function readToken(token: string): string {
  if (typeof window === "undefined") return "";
  return getComputedStyle(document.documentElement).getPropertyValue(token).trim();
}
