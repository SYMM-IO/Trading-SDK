/**
 * Candle intervals offered for the embedded chart, labelled the way the rest of
 * the page labels resolutions. The values are DexScreener's own interval codes
 * (minutes, or `1D` for a daily bar), not the SDK's `CandleResolution` —
 * nothing in the SDK is involved in rendering this chart.
 */
export const DEXSCREENER_INTERVAL_OPTIONS = [
  { value: "1", label: "1m" },
  { value: "5", label: "5m" },
  { value: "15", label: "15m" },
  { value: "60", label: "1h" },
  { value: "240", label: "4h" },
  { value: "1D", label: "1D" },
] as const;

/** The interval codes {@link DEXSCREENER_INTERVAL_OPTIONS} offers. */
export type DexScreenerInterval = (typeof DEXSCREENER_INTERVAL_OPTIONS)[number]["value"];

/** Options for {@link buildDexScreenerEmbedUrl}. */
export interface BuildDexScreenerEmbedUrlOptions {
  /** Network slug — the price service's `chain_id` (`"solana"`, `"bsc"`, …). */
  chainSlug: string;
  /** Liquidity pool identifier — the price service's `pair_address`. */
  pairAddress: string;
  /** Matches the frame to the app's active palette. */
  theme?: "dark" | "light";
  /** Initial bar size. */
  interval?: DexScreenerInterval;
  /** Escape hatch for any flag not modelled above. */
  overrides?: Record<string, string>;
}

/**
 * Public pair page for a pool — the "open on DexScreener" target, without the
 * embed flags.
 */
export function buildDexScreenerPairUrl(chainSlug: string, pairAddress: string): string {
  return `https://dexscreener.com/${chainSlug.toLowerCase()}/${pairAddress}`;
}

/**
 * Build the `<iframe>` src for a pool's DexScreener chart.
 *
 * The flags below are what turn a full DexScreener page into something that can
 * sit inside a card: `embed=1` strips their chrome, the `0` flags drop the
 * panels and toolbars the app already has its own version of, and
 * `loadChartSettings=0` stops a visitor's saved DexScreener preferences from
 * overriding what this page asked for.
 */
export function buildDexScreenerEmbedUrl(options: BuildDexScreenerEmbedUrlOptions): string {
  const theme = options.theme ?? "dark";
  const params = new URLSearchParams({
    embed: "1",
    loadChartSettings: "0",
    trades: "0",
    info: "0",
    chartLeftToolbar: "0",
    chartTheme: theme,
    theme,
    chartStyle: "1",
    interval: options.interval ?? "15",
    chartType: "price",
    ...options.overrides,
  });

  return `${buildDexScreenerPairUrl(options.chainSlug, options.pairAddress)}?${params.toString()}`;
}
