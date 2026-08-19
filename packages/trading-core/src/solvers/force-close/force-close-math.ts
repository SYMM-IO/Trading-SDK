import { formatUnits } from "viem";
import type { Candle } from "../../candles/types";
import type { HighLowPriceSig, Quote } from "../../symmio-contracts/symmio/types";
import { OrderType, PositionType, QuoteStatus } from "../../symmio-contracts/symmio/types";
import type { ForceCloseEligibility, ForceCloseWindow } from "./types";

const WAD = 10n ** 18n;

/**
 * Pure force-close **eligibility gate** — whether a quote can be force-closed
 * right now. The quote must be a `CLOSE_PENDING` `LIMIT` order and the close
 * request must not be within the second cooldown of its `deadline` (else it is
 * treated as expired).
 *
 * The cooldown check is stricter than the contract's on-chain `firstCooldown`
 * require: a force close cannot **succeed** until a valid Muon signature window
 * exists, which needs
 * `now ≥ statusModifyTimestamp + firstCooldown + secondCooldown + minSigPeriod` —
 * the window `[statusModifyTimestamp + firstCooldown, now - secondCooldown]` must
 * be at least `minSigPeriod` long. Gating on that avoids enabling the button (and
 * firing the price fetch) during the gap where the window would be empty.
 *
 * @param input - The quote's status fields, the cooldowns + min signature period, and `now` (unix seconds).
 * @returns Whether it is eligible, the blocking `reason` if not, and the seconds
 *   left until a valid window exists.
 *
 * @example
 * ```ts
 * const { eligible, reason, cooldownRemaining } = checkForceCloseEligibility({
 *   quote, firstCooldown, secondCooldown, minSigPeriod,
 *   now: BigInt(Math.floor(Date.now() / 1000)),
 * });
 * ```
 */
export function checkForceCloseEligibility(input: {
  quote: Pick<Quote, "quoteStatus" | "orderType" | "statusModifyTimestamp" | "deadline">;
  firstCooldown: bigint;
  secondCooldown: bigint;
  minSigPeriod: bigint;
  now: bigint;
}): ForceCloseEligibility {
  const { quote, firstCooldown, secondCooldown, minSigPeriod, now } = input;
  if (quote.quoteStatus !== QuoteStatus.CLOSE_PENDING) {
    return { eligible: false, reason: "not-close-pending", cooldownRemaining: 0n };
  }
  if (quote.orderType !== OrderType.LIMIT) {
    return { eligible: false, reason: "not-limit", cooldownRemaining: 0n };
  }
  // Earliest `now` at which a valid signable window of length `minSigPeriod` fits
  // inside `[statusModifyTimestamp + firstCooldown, now - secondCooldown]`.
  const readyAt = quote.statusModifyTimestamp + firstCooldown + secondCooldown + minSigPeriod;
  if (now < readyAt) {
    return { eligible: false, reason: "cooldown", cooldownRemaining: readyAt - now };
  }
  if (now >= quote.deadline - secondCooldown) {
    return { eligible: false, reason: "expired", cooldownRemaining: 0n };
  }
  return { eligible: true, cooldownRemaining: 0n };
}

/**
 * Scan reference-exchange candles for the **first** bar that both sits inside the
 * valid Muon window (`statusModifyTimestamp + firstCooldown … now - secondCooldown`)
 * **and** whose price reached the force-close level, returning that bar's
 * `[t0, t1]` for the Muon `priceRange` request. Ported from the Vibe-ui
 * `useCheckForceClosePriceCondition` scan; the price condition follows the
 * contract gap check (see {@link checkForceClosePriceReached}):
 * LONG needs a `high` at least `requestedClosePrice × (1 + gap)`, SHORT a `low`
 * at most `requestedClosePrice × (1 - gap)`.
 *
 * The candle scan runs in floats (candle prices are floats); the exact on-chain
 * check runs later on the Muon sig via {@link checkForceClosePriceReached}.
 *
 * @param input - The quote side/price, the candles, the gap ratio, both cooldowns,
 *   `now` (unix seconds), and the candle interval in ms (for the bar close time).
 * @returns The `{ t0, t1 }` of the first matching bar, or `null` when none qualifies.
 */
export function findForceCloseWindow(input: {
  quote: Pick<Quote, "positionType" | "requestedClosePrice" | "statusModifyTimestamp">;
  candles: readonly Candle[];
  gapRatio: bigint;
  firstCooldown: bigint;
  secondCooldown: bigint;
  now: bigint;
  /** Candle interval in milliseconds (e.g. `60_000` for `"1m"`). */
  intervalMs: number;
}): ForceCloseWindow | null {
  const { quote, candles, gapRatio, firstCooldown, secondCooldown, now, intervalMs } = input;

  const firstCooldownLimit = quote.statusModifyTimestamp + firstCooldown;
  const secondCooldownLimit = now - secondCooldown;

  const requested = Number(formatUnits(quote.requestedClosePrice, 18));
  const gap = Number(formatUnits(gapRatio, 18));
  const longThreshold = requested * (1 + gap);
  const shortThreshold = requested * (1 - gap);

  for (const candle of candles) {
    const startSec = BigInt(Math.floor(candle.time / 1000));
    const endSec = BigInt(Math.floor((candle.time + intervalMs) / 1000));
    if (startSec < firstCooldownLimit || endSec > secondCooldownLimit) continue;

    const reached =
      quote.positionType === PositionType.LONG ? candle.high >= longThreshold : candle.low <= shortThreshold;
    if (reached) return { t0: startSec, t1: endSec };
  }
  return null;
}

/**
 * Exact on-chain **preflight** of the fetched Muon sig against the force-close
 * gap (contract §4) — run before sending to avoid a wasted `Requested close
 * price not reached` revert. LONG requires `sig.highest ≥ requestedClosePrice ×
 * (1 + gap)`; SHORT requires `sig.lowest ≤ requestedClosePrice × (1 - gap)`.
 *
 * @param input - The Muon sig, the quote side, the requested close price, and the gap ratio (all 1e18).
 * @returns `true` when the attested range clears the gap.
 */
export function checkForceClosePriceReached(input: {
  sig: Pick<HighLowPriceSig, "highest" | "lowest">;
  positionType: PositionType;
  requestedClosePrice: bigint;
  gapRatio: bigint;
}): boolean {
  const { sig, positionType, requestedClosePrice, gapRatio } = input;
  if (positionType === PositionType.LONG) {
    return sig.highest >= (requestedClosePrice * (WAD + gapRatio)) / WAD;
  }
  return sig.lowest <= (requestedClosePrice * (WAD - gapRatio)) / WAD;
}

/**
 * Informational preview of the price a force close would execute at (contract §4).
 * LONG: `max(requestedClosePrice × (1 + penalty), averagePrice)`; SHORT:
 * `min(requestedClosePrice × (1 - penalty), averagePrice)`.
 *
 * @param input - The Muon sig, the quote side, the requested close price, and the price penalty (all 1e18).
 * @returns The previewed close price (1e18).
 */
export function previewForceClosePrice(input: {
  sig: Pick<HighLowPriceSig, "averagePrice">;
  positionType: PositionType;
  requestedClosePrice: bigint;
  pricePenalty: bigint;
}): bigint {
  const { sig, positionType, requestedClosePrice, pricePenalty } = input;
  if (positionType === PositionType.LONG) {
    const penalized = (requestedClosePrice * (WAD + pricePenalty)) / WAD;
    return penalized > sig.averagePrice ? penalized : sig.averagePrice;
  }
  const penalized = (requestedClosePrice * (WAD - pricePenalty)) / WAD;
  return penalized < sig.averagePrice ? penalized : sig.averagePrice;
}
