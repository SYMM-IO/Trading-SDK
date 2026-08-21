export interface BuildPoolEmbedUrlOptions {
  /** Network slug — the price service's `chain_id` (`"solana"`, `"bsc"`, …). */
  chainSlug: string;
  /** Liquidity pool identifier — the price service's `pair_address`. */
  pairAddress: string;
}

/** Public pair page for a pool — the "open on DexScreener" target. */
export function buildPoolPairUrl(chainSlug: string, pairAddress: string): string {
  return `https://dexscreener.com/${chainSlug.toLowerCase()}/${pairAddress}`;
}

/**
 * Build the `<iframe>` src for a pool's DexScreener chart.
 *
 * `embed=1` strips their chrome and the `0` flags drop the panels Prism already
 * has its own version of; `loadChartSettings=0` stops a visitor's saved
 * DexScreener preferences from overriding what this page asked for.
 *
 * `interval` is only the bar size the frame *opens* on. The embed keeps its own
 * timeframe toolbar, which is why Prism does not draw a second one around it —
 * the frame is opaque, so an outer control could only ever reload it and would
 * then disagree with whatever the trader picked inside.
 */
export function buildPoolEmbedUrl(options: BuildPoolEmbedUrlOptions): string {
  const params = new URLSearchParams({
    embed: "1",
    loadChartSettings: "0",
    trades: "0",
    info: "0",
    chartLeftToolbar: "0",
    chartTheme: "dark",
    theme: "dark",
    chartStyle: "1",
    chartType: "price",
    interval: "15",
  });

  return `${buildPoolPairUrl(options.chainSlug, options.pairAddress)}?${params.toString()}`;
}

/**
 * Brand colour for a pool's own chain.
 *
 * A lowcap perp settles on HyperEVM regardless of where its token trades, so
 * the pool's chain is a separate fact from the market's chain and needs its own
 * colour. Unknown slugs fall back to a neutral so a new chain degrades quietly
 * rather than borrowing another chain's identity.
 */
export function poolChainColor(chainSlug: string): string {
  switch (chainSlug.toLowerCase()) {
    case "solana":
      return "var(--chain-solana)";
    case "base":
      return "var(--chain-base)";
    case "bsc":
      return "var(--chain-bsc)";
    case "hyperevm":
      return "var(--chain-hyperevm)";
    default:
      return "var(--fg-3)";
  }
}
