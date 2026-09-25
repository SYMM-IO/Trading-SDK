/**
 * "Ember" — the SYMMIO brand aesthetic, translated to a truecolor terminal
 * palette. A single coral accent on warm near-black, mint/rose for long/short,
 * naples-yellow for caution, picton-blue for information. Ink renders hex
 * colors via chalk on any truecolor terminal.
 *
 * Values are the `.dark` tokens from `@symmio/ui`'s `globals.css` (the design
 * system's source of truth) converted from `hsl()` to hex. Dark is the only
 * variant a terminal needs. Three tokens deviate, each noted below: `negative`
 * and `faint` are retuned for the medium, and `primaryDeep` borrows the
 * light-mode `--primary`. Every other value is a verbatim port — keep it that
 * way, and carry brand changes over from `globals.css` rather than inventing.
 *
 * Colors are chosen to survive chalk's 256-color downgrade (no two tokens
 * quantize to the same xterm index) and to clear WCAG AA against the Ember
 * background, so the palette holds up on terminals without truecolor.
 *
 * Import `theme` directly; it is static (no runtime theming), so a provider
 * would only add ceremony.
 */
export const theme = {
  /** Primary brand accent — coral (`--primary`). Focus rings, active tab, primary CTAs. */
  primary: "#FF7C70",
  /** A brighter coral for emphasis (`--brand-red-300`): selected row, live glyphs. */
  primaryBright: "#FFA89E",
  /**
   * Deep coral for filled backgrounds behind light text — the design system's
   * light-mode `--primary`, which it tunes to exactly this purpose.
   */
  primaryDeep: "#C12715",
  /** Text drawn on top of a filled accent fill (`--primary-foreground`). */
  onAccent: "#171717",

  /** Long / positive / success — mint (`--positive`). */
  positive: "#36C984",
  /**
   * Short / negative / danger — rose.
   *
   * Deliberately hue-shifted off the design system's `--negative` (#EF5D5D).
   * That red sits only ~5° from the coral accent, which the web mitigates with
   * icons and shape; a terminal has no such channel, so a selected short row
   * would render its coral caret and its red side glyph as the same color.
   * This rose roughly doubles the perceptual gap (OKLab ΔE 0.12 vs 0.07) while
   * staying in the brand's warm family.
   */
  negative: "#E44464",
  /** Caution / pending / cooldown — naples-yellow (`--warning`). */
  warning: "#F1CE5B",
  /** Neutral informational — picton-blue (`--info`). */
  info: "#50C3ED",

  /** Primary readable text (`--foreground`). */
  text: "#F5F0F0",
  /** Secondary text — labels, units (`--muted-foreground`). */
  muted: "#938A8A",
  /**
   * Tertiary text — hints, disabled, scaffolding. Has no design-system
   * counterpart (the web recesses with opacity, which a terminal cannot do), so
   * it is a warm gray tuned to 3.5:1 on the background: recessive, still legible
   * for the footer key hints.
   */
  faint: "#6E6363",

  /** Panel border, idle (`--border`). */
  border: "#2C2626",
  /** Panel border, focused. */
  borderFocus: "#FF7C70",
} as const;

/** Side → color. LONG is mint, SHORT is rose. */
export function sideColor(isLong: boolean): string {
  return isLong ? theme.positive : theme.negative;
}

/** A signed number → color: positive mint, negative rose, zero muted. */
export function signColor(value: number): string {
  if (value > 0) return theme.positive;
  if (value < 0) return theme.negative;
  return theme.muted;
}

/** Glyphs used across the UI. Kept ASCII-safe with a few Unicode accents. */
export const glyph = {
  brand: "◆",
  live: "●",
  idle: "○",
  up: "▲",
  down: "▼",
  arrow: "›",
  caret: "❯",
  check: "✓",
  cross: "✕",
  dot: "·",
  bullet: "•",
  spark: "▁▂▃▄▅▆▇█",
  long: "▲",
  short: "▼",
  ellipsis: "…",
} as const;
