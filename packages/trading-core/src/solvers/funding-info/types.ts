/**
 * Next-epoch funding figures for one solver market, normalized from the
 * generated `/funding-info` response.
 *
 * Funding is charged per epoch: the long side pays (or receives) at
 * {@link MarketFundingInfo.nextFundingRateLong} and the short side at
 * {@link MarketFundingInfo.nextFundingRateShort}. Both rates are the plain
 * per-epoch decimal fractions the solver reports — multiply by `100` for a
 * percentage. A **positive** rate means that side *receives* funding; a
 * **negative** rate means it *pays*.
 * @example
 * const row: MarketFundingInfo = { kind: "enigma", symbolId: 117, nextFundingRateLong: 0.0001, nextFundingRateShort: -0.0001, nextFundingTime: 1783209600000, epochDurationSeconds: 43200 };
 */
interface BaseMarketFundingInfo {
  /**
   * Next funding rate for the long side, as a per-epoch decimal fraction
   * (`0.0001` = `0.01%`). Positive receives, negative pays.
   */
  nextFundingRateLong: number;
  /**
   * Next funding rate for the short side, as a per-epoch decimal fraction
   * (`0.0001` = `0.01%`). Positive receives, negative pays.
   */
  nextFundingRateShort: number;
  /**
   * Timestamp of the next funding settlement, as reported by the solver — a Unix
   * timestamp in **milliseconds** (e.g. `1783209600000`). `0` when the solver
   * omits it. Consumers rendering a countdown should stay defensive about the
   * unit (treat a value below `1e12` as seconds) in case the solver changes it.
   */
  nextFundingTime: number;
  /** Length of one funding epoch, in seconds (e.g. `43200` = 12h). `0` when absent. */
  epochDurationSeconds: number;
}

/** Funding from Enigma's symbol-ID endpoint. */
export interface EnigmaMarketFundingInfo extends BaseMarketFundingInfo {
  /** Discriminant identifying the solver response. */
  kind: "enigma";
  /** Stable solver symbol ID; join with getSymbols for names. */
  symbolId: number;
}
/** Funding from Rasa's existing ticker endpoint. */
export interface RasaMarketFundingInfo extends BaseMarketFundingInfo {
  /** Discriminant identifying the solver response. */
  kind: "rasa";
  /** Market ticker from the response map key. */
  symbol: string;
}
/** Solver funding row. Narrow on kind before reading symbolId or symbol. */
export type MarketFundingInfo = EnigmaMarketFundingInfo | RasaMarketFundingInfo;
/** Maps each solver kind to its funding row, used to narrow actions and hooks. */
export interface NormalizedFundingInfoByKind {
  enigma: EnigmaMarketFundingInfo;
  rasa: RasaMarketFundingInfo;
}
