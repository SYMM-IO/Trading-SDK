/**
 * Fields every price provider delivers for one market.
 *
 * Not exported on its own — consume {@link MarkPriceTick} so the `provider`
 * discriminant always travels with the data.
 */
interface BaseMarkPriceTick {
  /**
   * SYMMIO market name — matches the solver's `/contract-symbols` `name`
   * (e.g. `"BTCUSDT"`).
   *
   * Note this is `Market.name`, **not** `Market.symbol`, which is the base asset
   * (`"BTC"`). One name can map to several `symbolId`s (fee tiers), so a price
   * keyed by name may fan out to several markets.
   */
  name: string;
  /**
   * Mark price as a **decimal string**, exactly as the provider sent it.
   *
   * Never parsed to a float anywhere in the SDK: this value is signed into an
   * EIP-712 payload, and rounding it is a trade-path defect.
   */
  markPrice: string;
  /** Source timestamp (unix ms), when the provider reports one. */
  time?: number;
}

/**
 * A mark price from the Enigma lowcap price service.
 */
export interface EnigmaMarkPriceTick extends BaseMarkPriceTick {
  /** Discriminant: priced by the Enigma lowcap price service. */
  provider: "enigma";
  /**
   * Address of the underlying token / market. Enigma-only — lowcap markets are
   * token-addressed, which has no Binance analogue.
   */
  address?: string;
}

/**
 * A mark price from Binance USD-M Futures.
 */
export interface BinanceMarkPriceTick extends BaseMarkPriceTick {
  /** Discriminant: priced by Binance USD-M Futures. */
  provider: "binance";
  /** Binance index price (spot composite) as a decimal string. */
  indexPrice: string;
  /**
   * Binance's OWN last funding rate for its perpetual, as a decimal string.
   *
   * **This is not the funding you are charged on SYMMIO.** The solver's
   * long/short per-epoch rates come from `getFundingInfo`. Showing this next to a
   * SYMMIO position displays a proxy from a different exchange on a different
   * schedule, not the real cost of carry.
   */
  binanceLastFundingRate: string;
  /** Binance's next funding settlement (unix ms). Binance's schedule, not the solver's. */
  binanceNextFundingTime: number;
}

/**
 * A mark price from whichever provider serves the resolved solver.
 *
 * Discriminated union on `provider`: read `name` / `markPrice` without
 * narrowing, and narrow (`if (tick.provider === "binance")`) to reach
 * provider-specific fields.
 *
 * @example
 * ```ts
 * const ticks = await getMarkPrices(config, { solverId: "rasa", names: ["BTCUSDT"] });
 * for (const tick of ticks) {
 *   console.log(tick.name, tick.markPrice);
 *   if (tick.provider === "binance") console.log(tick.indexPrice);
 * }
 * ```
 */
export type MarkPriceTick = EnigmaMarkPriceTick | BinanceMarkPriceTick;

/**
 * Maps each price provider to its normalized mark-price tick type.
 *
 * Lets a caller that knows its provider name the exact variant without
 * re-deriving the union member.
 */
export interface NormalizedMarkPriceByProvider {
  enigma: EnigmaMarkPriceTick;
  binance: BinanceMarkPriceTick;
}
