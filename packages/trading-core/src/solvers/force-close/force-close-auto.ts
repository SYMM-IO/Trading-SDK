import type { Address } from "viem";
import { BINANCE_MAX_LIMIT, BINANCE_REST_URL } from "../../candles/sources/binance/constants";
import { fetchBinanceKlines } from "../../candles/sources/binance/fetch-binance-klines";
import type { Config } from "../../core/config";
import { getForceClosePriceSig } from "../../muon/force-close-price-sig/get-force-close-price-sig";
import { SymmError } from "../../shared/errors/symm-error";
import type { Compute, WriteContractParameter } from "../../shared/types/properties";
import { getQuote } from "../../symmio-contracts/symmio/actions/get-quote";
import { getMarkets } from "../markets/get-markets";
import { checkForceCloseEligibility, checkForceClosePriceReached, findForceCloseWindow } from "./force-close-math";
import { forceClosePosition, type ForceClosePositionReturnType } from "./force-close-position";
import { getForceCloseParams } from "./get-force-close-params";

/** Candle interval used to scan for a valid force-close price window. */
const KLINE_INTERVAL = "1m";
const KLINE_INTERVAL_MS = 60_000;
const BINANCE_MARKET = "usd-m-futures" as const;

/**
 * Parameters for {@link forceCloseAuto}.
 */
export type ForceCloseAutoParameters = Compute<
  WriteContractParameter & {
    /**
     * The subaccount (partyA) that owns the position. Routed through the
     * AccountLayer `_call` proxy; the connected wallet must be its `owner`.
     */
    account: Address;
    /** The `CLOSE_PENDING` limit quote id to force-close. */
    quoteId: bigint;
    /** Override the current unix-second clock (testing). Defaults to `Date.now()`. */
    now?: bigint;
    /**
     * **Debug/temporary**: skip the client-side price checks — build and send the
     * tx even when the market has not reached the price. When no candle in the
     * window qualifies, the full valid window is used for the Muon sig instead of
     * bailing. Pair with `simulateBeforeWrite: false` to actually broadcast a tx
     * that will revert on-chain (so you can inspect it in an explorer).
     */
    skipPriceCheck?: boolean;
  }
>;

/** Return type of {@link forceCloseAuto}: the submitted transaction hash. */
export type ForceCloseAutoReturnType = ForceClosePositionReturnType;

/**
 * Force-close a stalled `CLOSE_PENDING` **limit** position end-to-end, from just
 * the `quoteId`:
 *
 * 1. read the quote + the protocol force-close params (one multicall);
 * 2. gate on eligibility (status / order type / cooldown / not expired);
 * 3. fetch reference-exchange (Binance) candles over the valid window and find a
 *    bar where the price reached the force-close level → the Muon time window;
 * 4. fetch the Muon `HighLowPriceSig` for that window;
 * 5. preflight the on-chain gap check against the sig;
 * 6. send `forceClosePosition(quoteId, sig)` through the AccountLayer proxy.
 *
 * @param config - The SDK config (must have a `getWalletClient` resolver).
 * @param parameters - The owning subaccount, the quote id, optional `now` / `from` / pre-flight / chain id.
 * @returns The submitted transaction hash.
 * @throws {SymmError} `FORCE_CLOSE_NOT_ELIGIBLE` (with the blocking reason),
 *   `FORCE_CLOSE_MARKET_NOT_FOUND`, or `FORCE_CLOSE_PRICE_NOT_REACHED`.
 *
 * @example
 * ```ts
 * const hash = await forceCloseAuto(config, { account: "0xsub…", quoteId: 42n });
 * ```
 */
export async function forceCloseAuto(
  config: Config,
  parameters: ForceCloseAutoParameters,
): Promise<ForceCloseAutoReturnType> {
  const { chainId, account, quoteId } = parameters;
  const now = parameters.now ?? BigInt(Math.floor(Date.now() / 1000));

  const quote = await getQuote(config, { quoteId, chainId });
  if (!quote) {
    throw new SymmError("validation", "FORCE_CLOSE_QUOTE_NOT_FOUND", `No quote found for id ${quoteId}.`);
  }
  const params = await getForceCloseParams(config, { symbolId: quote.symbolId, chainId });

  const eligibility = checkForceCloseEligibility({
    quote,
    firstCooldown: params.firstCooldown,
    secondCooldown: params.secondCooldown,
    minSigPeriod: params.minSigPeriod,
    now,
  });
  if (!eligibility.eligible) {
    throw new SymmError(
      "validation",
      "FORCE_CLOSE_NOT_ELIGIBLE",
      `Quote ${quoteId} is not force-closeable: ${eligibility.reason}.`,
    );
  }

  // Resolve the Binance symbol for this market (reference-exchange klines).
  const markets = await getMarkets(config, { chainId });
  const market = markets.find((entry) => BigInt(entry.symbolId) === quote.symbolId);
  if (!market) {
    throw new SymmError(
      "validation",
      "FORCE_CLOSE_MARKET_NOT_FOUND",
      `No market found for symbolId ${quote.symbolId}.`,
    );
  }

  const windowStart = quote.statusModifyTimestamp + params.firstCooldown;
  const windowEnd = now - params.secondCooldown;
  // Defensive: eligibility already guarantees a non-empty window, but never fetch
  // klines with `start > end` (Binance rejects it with "Start time is greater than
  // end time"). If we reach here with an empty window, the cooldown has not passed.
  if (windowEnd <= windowStart) {
    throw new SymmError("validation", "FORCE_CLOSE_NOT_ELIGIBLE", `Quote ${quoteId} is not force-closeable: cooldown.`);
  }
  const candles = await fetchBinanceKlines({
    restUrl: BINANCE_REST_URL[BINANCE_MARKET],
    market: BINANCE_MARKET,
    symbol: market.name.toUpperCase(),
    interval: KLINE_INTERVAL,
    startTime: Number(windowStart) * 1000,
    endTime: Number(windowEnd) * 1000,
    limit: BINANCE_MAX_LIMIT[BINANCE_MARKET],
  });

  const matchedWindow = findForceCloseWindow({
    quote,
    candles,
    gapRatio: params.gapRatio,
    firstCooldown: params.firstCooldown,
    secondCooldown: params.secondCooldown,
    now,
    intervalMs: KLINE_INTERVAL_MS,
  });
  if (!matchedWindow && !parameters.skipPriceCheck) {
    throw new SymmError(
      "validation",
      "FORCE_CLOSE_PRICE_NOT_REACHED",
      `The market has not reached the requested close price for quote ${quoteId}.`,
    );
  }
  // No qualifying candle but `skipPriceCheck` — sign over the full valid window so
  // the tx can still be built (it will revert on-chain if the price isn't met).
  const window = matchedWindow ?? { t0: windowStart, t1: windowEnd };

  const sig = await getForceClosePriceSig(config, {
    t0: window.t0,
    t1: window.t1,
    partyA: account,
    partyB: quote.partyB,
    symbolId: quote.symbolId,
    chainId,
  });

  // Exact on-chain preflight against the fetched sig — avoids a wasted revert
  // (skipped when `skipPriceCheck`, so the tx is sent regardless).
  if (!parameters.skipPriceCheck) {
    const reached = checkForceClosePriceReached({
      sig,
      positionType: quote.positionType,
      requestedClosePrice: quote.requestedClosePrice,
      gapRatio: params.gapRatio,
    });
    if (!reached) {
      throw new SymmError(
        "validation",
        "FORCE_CLOSE_PRICE_NOT_REACHED",
        `The attested price range does not clear the gap for quote ${quoteId}.`,
      );
    }
  }

  return forceClosePosition(config, {
    account,
    quoteId,
    sig,
    chainId,
    from: parameters.from,
    simulateBeforeWrite: parameters.simulateBeforeWrite,
  });
}
