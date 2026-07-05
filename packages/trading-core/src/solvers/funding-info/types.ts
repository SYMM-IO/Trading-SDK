/**
 * Next-epoch funding figures for one solver market, normalized from the
 * generated `/get_funding_info` response.
 *
 * Funding is charged per epoch: the long side pays (or receives) at
 * {@link MarketFundingInfo.nextFundingRateLong} and the short side at
 * {@link MarketFundingInfo.nextFundingRateShort}. Both rates are the plain
 * per-epoch decimal fractions the solver reports — multiply by `100` for a
 * percentage. A **positive** rate means that side *receives* funding; a
 * **negative** rate means it *pays*.
 */
export interface MarketFundingInfo {
  /** Market ticker and solver map key (e.g. `"BTCUSDT"`). */
  symbol: string;
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
