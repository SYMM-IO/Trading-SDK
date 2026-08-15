/**
 * 24h volume figures for one **Enigma** market, normalized from `/get_market_info`.
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

/** Per-market figures for one **Rasa** market, normalized from `/get_market_info`. */
export interface RasaMarketInfoRow {
  /** Market ticker and solver map key. */
  symbol: string;
  /** Solver-reported reference price (dollars). */
  price: number;
  /** 24-hour price change, percent. */
  priceChangePercent: number;
  /** 24-hour trade volume for the market (dollars). */
  tradeVolume: number;
  /** Notional cap configured for the market (dollars). */
  notionalCap: number;
}

/**
 * Market info from an **Enigma**-kind solver: per-market 24h volume + lifetime
 * value rows, plus the aggregate totals across all markets.
 */
export interface EnigmaMarketInfo {
  /** Discriminant: from an Enigma solver. */
  kind: "enigma";
  /** Per-market volume rows, keyed out of the flat solver object. */
  markets: MarketVolume[];
  /** Σ 24-hour traded value across every market (dollars). */
  totalValue24h: number;
  /** Σ lifetime traded value across every market (dollars). */
  totalLifetimeValue: number;
}

/**
 * Market info from a **Rasa**-kind solver: per-market price / 24h change /
 * volume / notional cap. Rasa exposes **no** aggregate totals or lifetime value.
 */
export interface RasaMarketInfo {
  /** Discriminant: from a Rasa solver. */
  kind: "rasa";
  /** Per-market rows, keyed out of the solver map. */
  markets: RasaMarketInfoRow[];
}

/**
 * Market info from any solver — a discriminated union on `kind`. Enigma and Rasa
 * expose **different** per-market data (volume/value vs price/cap), so narrow on
 * `kind` before reading either side's rows.
 */
export type MarketInfo = EnigmaMarketInfo | RasaMarketInfo;

/** Maps each solver kind to its normalized market-info type. */
export interface NormalizedMarketInfoByKind {
  enigma: EnigmaMarketInfo;
  rasa: RasaMarketInfo;
}
