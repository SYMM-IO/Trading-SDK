import { parseScaledPoolMetric } from "./metrics";
/** Cumulative deposit buckets as raw 18-decimal quantities. */
export type PoolDepositHistoryInput = Partial<
  Record<"pending" | "transferred" | "success" | "refund" | "rejected", string>
>;
function fromWei(value: string): number {
  return parseScaledPoolMetric(value) ?? 0;
}
type EffectiveDepositHistory = Pick<PoolDepositHistoryInput, "success" | "transferred">;
type RefundableDepositHistory = Pick<PoolDepositHistoryInput, "success" | "transferred" | "rejected" | "refund">;

function parseHistoryAmount(value: string | undefined): number {
  const amount = Number.parseFloat(value ?? "0");
  return Number.isFinite(amount) ? amount : 0;
}

/** Derive an unformatted deposit lifecycle amount from cumulative history. */
export function getPoolEffectiveDepositWei(history: EffectiveDepositHistory | null | undefined): string {
  const amount = parseHistoryAmount(history?.success) + parseHistoryAmount(history?.transferred);
  return amount.toString();
}

/** Derive an unformatted deposit lifecycle amount from cumulative history. */
export function getPoolEffectiveDepositTokens(history: EffectiveDepositHistory | null | undefined): number {
  return fromWei(getPoolEffectiveDepositWei(history));
}

/** Derive an unformatted deposit lifecycle amount from cumulative history. */
export function getPoolRefundableDepositTokens(history: RefundableDepositHistory | null | undefined): number {
  const remainingWei =
    parseHistoryAmount(history?.success) +
    parseHistoryAmount(history?.transferred) +
    parseHistoryAmount(history?.rejected) -
    parseHistoryAmount(history?.refund);
  return Math.max(0, fromWei(remainingWei.toString()));
}

/** Derive an unformatted deposit lifecycle amount from cumulative history. */
export function getPoolCurrentDepositTokens(
  history: Pick<PoolDepositHistoryInput, "success" | "transferred" | "pending"> | null | undefined,
): number {
  const amount =
    parseHistoryAmount(history?.success) +
    parseHistoryAmount(history?.transferred) +
    parseHistoryAmount(history?.pending);
  return Math.max(0, fromWei(amount.toString()));
}

/** Derive an unformatted deposit lifecycle amount from cumulative history. */
export function getPoolUncreditedDepositTokens(
  history: Pick<PoolDepositHistoryInput, "pending" | "rejected" | "refund"> | null | undefined,
): number {
  const amount =
    parseHistoryAmount(history?.pending) + parseHistoryAmount(history?.rejected) - parseHistoryAmount(history?.refund);
  return Math.max(0, fromWei(amount.toString()));
}

/** Derive an unformatted deposit lifecycle amount from cumulative history. */
export function getPoolCurrentDepositUsd(
  history: Pick<PoolDepositHistoryInput, "success" | "transferred" | "pending"> | null | undefined,
  priceUsd: string | number | undefined,
): number {
  const price = typeof priceUsd === "string" ? Number.parseFloat(priceUsd) : (priceUsd ?? 0);
  if (!Number.isFinite(price) || price <= 0) return 0;
  return getPoolCurrentDepositTokens(history) * price;
}

/** Derive an unformatted deposit lifecycle amount from cumulative history. */
export function getPoolUserOrPoolDepositUsd(
  userHistory: Pick<PoolDepositHistoryInput, "success" | "transferred" | "pending"> | null | undefined,
  poolHistory: Pick<PoolDepositHistoryInput, "success" | "transferred" | "pending"> | null | undefined,
  priceUsd: string | number | undefined,
): number {
  const userUsd = getPoolCurrentDepositUsd(userHistory, priceUsd);
  return userUsd > 0 ? userUsd : getPoolCurrentDepositUsd(poolHistory, priceUsd);
}

/** Derive an unformatted deposit lifecycle amount from cumulative history. */
export function getPoolRefundedTokens(history: Pick<PoolDepositHistoryInput, "refund"> | null | undefined): number {
  return Math.max(0, fromWei(parseHistoryAmount(history?.refund).toString()));
}

/** Derive an unformatted deposit lifecycle amount from cumulative history. */
export function isPoolFullyRefunded(history: RefundableDepositHistory | null | undefined): boolean {
  return getPoolRefundedTokens(history) > 0 && getPoolRefundableDepositTokens(history) <= 0;
}
