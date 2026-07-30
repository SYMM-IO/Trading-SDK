/**
 * Figures both solvers' `/notional_cap/{symbolId}` responses share. Every numeric
 * field is a plain JavaScript `number` in the **dollar units the solver already
 * reports** — no decimal scaling (`1234` means $1,234).
 */
interface BaseNotionalCap {
  /** Total notional cap configured for the market (dollars). */
  totalCap: number;
  /** Notional already used across both sides (dollars). */
  used: number;
}

/**
 * Notional cap from an **Enigma**-kind solver — the full per-market liquidity
 * breakdown (`/notional_cap/{symbolId}` on Enigma returns every field below).
 */
export interface EnigmaNotionalCap extends BaseNotionalCap {
  /** Discriminant: from an Enigma solver. */
  kind: "enigma";
  /** Solver market id (`symbol_id`). */
  symbolId: number;
  /** Market ticker (`symbol`). */
  symbol: string;
  /** Notional the solver will still accept on the long side (dollars). */
  availableToLong: number;
  /** Notional the solver will still accept on the short side (dollars). */
  availableToShort: number;
  /** Net open interest on the market (dollars). */
  openInterest: number;
  /** Solver-reported reference price (dollars). */
  price: number;
  /** Solver token balance backing the market (dollars). */
  tokenBalance: number;
  /** Solver USDC balance backing the market (dollars). */
  usdcBalance: number;
  /** Solver-reported error string for this market, or `null` when none. */
  error: string | null;
}

/**
 * Notional cap from a **Rasa**-kind solver. Rasa's `/notional_cap/{symbolId}`
 * returns only `total_cap` and `used` — it exposes **no** per-side availability,
 * open interest, price, or balances, so those fields do not exist here. Narrow
 * on `kind` before reaching for Enigma-only figures.
 */
export interface RasaNotionalCap extends BaseNotionalCap {
  /** Discriminant: from a Rasa solver. */
  kind: "rasa";
}

/**
 * Per-market notional cap from any solver — a discriminated union on `kind`.
 * {@link getNotionalCapBySymbolId} returns this; narrow on `kind` to read the
 * richer Enigma fields (Rasa carries only `totalCap` / `used`).
 */
export type MarketNotionalCap = EnigmaNotionalCap | RasaNotionalCap;

/** Maps each solver kind to its normalized notional-cap type. */
export interface NormalizedNotionalCapByKind {
  enigma: EnigmaNotionalCap;
  rasa: RasaNotionalCap;
}
