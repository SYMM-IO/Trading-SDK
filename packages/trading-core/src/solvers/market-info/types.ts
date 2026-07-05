/**
 * 24h volume figures for one solver market, normalized from the generated
 * `/get_market_info` response.
 *
 * Every numeric field is a plain JavaScript `number` in the **dollar units the
 * solver already reports** — no decimal scaling. `1234` here means $1,234.
 */
export interface MarketVolume {
  /** Market ticker and solver map key (e.g. `"BTCUSDT"`). */
  symbol: string;
  /** Rolling 24-hour trading volume for the market (dollars). */
  tradingVolume: number;
  /** Cumulative lifetime traded value for the market (dollars). */
  lifetimeValue: number;
}

/**
 * Return type of {@link getMarketInfo}: aggregate totals plus one
 * {@link MarketVolume} row per market.
 *
 * The solver serves per-market entries and the top-level aggregates in a single
 * flat object; the SDK splits them so the per-market rows and the totals are
 * addressable independently.
 */
export interface GetMarketInfoReturnType {
  /** Per-market volume rows, keyed out of the flat solver object. */
  markets: MarketVolume[];
  /** Σ 24-hour traded value across every market (dollars). */
  totalValue24h: number;
  /** Σ lifetime traded value across every market (dollars). */
  totalLifetimeValue: number;
}
