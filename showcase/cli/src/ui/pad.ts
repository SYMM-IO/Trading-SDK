/** Truncate a string to `width`, adding an ellipsis when it overflows. */
export function truncate(text: string, width: number): string {
  if (text.length <= width) return text;
  if (width <= 1) return text.slice(0, Math.max(0, width));
  return `${text.slice(0, width - 1)}…`;
}

/** Pad (and truncate) a string to an exact cell `width`. */
export function pad(text: string, width: number, align: "left" | "right" = "left"): string {
  const clipped = truncate(text, width);
  const space = " ".repeat(Math.max(0, width - clipped.length));
  return align === "right" ? space + clipped : clipped + space;
}
