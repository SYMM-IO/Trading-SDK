/**
 * Protocol force-close parameters, read together (one multicall) because the
 * eligibility gate + price window all depend on them. All `bigint`: cooldowns /
 * `minSigPeriod` are unix-second durations; `pricePenalty` / `gapRatio` are
 * 1e18 fixed-point ratios.
 */
export interface ForceCloseParams {
  /** First cooldown (seconds) after `statusModifyTimestamp` before a force close is allowed. */
  firstCooldown: bigint;
  /** Second cooldown (seconds); the signature window must end at least this far before `now`, and `now` this far before `deadline`. */
  secondCooldown: bigint;
  /** Price penalty applied to the requested close price (1e18 fixed-point). */
  pricePenalty: bigint;
  /** Minimum Muon signature window length (seconds). */
  minSigPeriod: bigint;
  /** Per-symbol price gap ratio the market must exceed the requested price by (1e18 fixed-point). */
  gapRatio: bigint;
}

/** Why a quote is not force-closeable, when {@link ForceCloseEligibility.eligible} is `false`. */
export type ForceCloseIneligibleReason = "not-close-pending" | "not-limit" | "cooldown" | "expired";

/** Result of the pure force-close eligibility gate. */
export interface ForceCloseEligibility {
  /** Whether the quote can be force-closed right now (cooldown passed, not expired). */
  eligible: boolean;
  /** The blocking reason when `eligible` is `false`. */
  reason?: ForceCloseIneligibleReason;
  /** Seconds left on the first cooldown (`0n` unless `reason === "cooldown"`). */
  cooldownRemaining: bigint;
}

/** A Muon signature time window (unix seconds) found by {@link findForceCloseWindow}. */
export interface ForceCloseWindow {
  /** Window start (unix seconds) — the matching candle's open time. */
  t0: bigint;
  /** Window end (unix seconds) — the matching candle's close time. */
  t1: bigint;
}
