import { toDecimal } from "@symmio/utils";
import { parseUnits } from "viem";
import { units, type PoolReadGap } from "../composition";
import type {
  ListingDepositChainId,
  ListingMarketDetail,
  ListingMarketStatus,
  UserPoolProfit,
  UserTransaction,
} from "../types";
import { sumPoolDepositHistory } from "./sum-deposits";

/** Complete cumulative deposit buckets, already normalized to 18 decimals. */
export interface PoolDepositHistory {
  pending: bigint;
  transferred: bigint;
  success: bigint;
  rejected: bigint;
  refund: bigint;
}

/** One user's stake. Raw token, collateral and LP amounts use 18 decimals; USD values are unformatted numbers. */
export interface PoolPositionData {
  tokenContractAddress: string | null;
  depositChain: ListingDepositChainId | null;
  marketStatus: ListingMarketStatus | null;
  symbolId: number | null;
  availableToken: bigint | null;
  availableUsdc: bigint | null;
  pendingToken: bigint | null;
  pendingUsdc: bigint | null;
  availableLp: bigint | null;
  pendingLp: bigint | null;
  totalLp: bigint | null;
  /** Pending fraction of total LP, using the same clamped ledger as availableLp; null without profit. */
  pendingRatio: number | null;
  /** Available fraction of the LP ledger; null when the ledger is unavailable. */
  availableRatio: number | null;
  /** Selected available LP, floored at 18 decimals; null without a selection or profit. */
  withdrawalLpAmount: bigint | null;
  /** Estimated token leg before LP rounding, in 18-decimal units. */
  withdrawalTokenAmount: bigint | null;
  /** Estimated USDC leg before LP rounding, in 18-decimal units. */
  withdrawalUsdcAmount: bigint | null;
  /** Estimated USD at 18 decimals; includes only collateral when price is unknown. */
  withdrawalValueUsd: bigint | null;
  totalToken: bigint | null;
  totalUsdc: bigint | null;
  depositedToken: bigint | null;
  /** Complete cumulative history; null for an incomplete or unavailable source. */
  depositHistory: PoolDepositHistory | null;
  currentDepositToken: bigint | null;
  uncreditedDepositToken: bigint | null;
  currentDepositUsd: number | null;
  refundableValueUsd: number | null;
  /** Known pending collateral plus priced pending tokens. */
  pendingValueUsd: number | null;
  pendingDepositToken: bigint | null;
  rejectedDepositToken: bigint | null;
  refundedToken: bigint | null;
  refundableToken: bigint | null;
  fullyRefunded: boolean | null;
  claimableReward: bigint | null;
  claimedReward: bigint | null;
  shareFraction: number | null;
  priceUsd: number | null;
  /** Known collateral plus priced tokens. See valuationComplete before treating it as a complete valuation. */
  balanceUsd: number | null;
  valuationComplete: boolean;
  gaps: PoolReadGap[];
}

/** SDK reads consumed unchanged by calculatePoolPosition. Null means the source failed or has not loaded. */
export interface CalculatePoolPositionParameters {
  /** Omit both identity fields only for already-scoped snapshots. Network reads require both. */
  tokenContractAddress?: string;
  depositChain?: ListingDepositChainId;
  detail: Partial<ListingMarketDetail> | null;
  /** Partial cached snapshots are supported; omitted monetary fields remain unknown. */
  profit: Partial<UserPoolProfit> | null;
  deposits: readonly UserTransaction[] | null;
  /** Complete, already-scoped buckets. Used instead of rows when supplied. */
  depositHistory?: PoolDepositHistory | null;
  /** LP-ledger ownership in whole percent, e.g. 3.2 means 3.2%. */
  userSharePercentage?: number | null;
  depositsComplete?: boolean;
  priceUsd?: number;
  /** Optional integer percentage of available LP, from 0 through 100. Omit for no preview. */
  withdrawalPercent?: number;
  gaps?: readonly PoolReadGap[];
}

/** Derive a stake from normalized reads, preserving unknown values and doing balance math in bigint.
 * @param input - Detail, profit, and deposit reads for one pool.
 * @returns Flat position data, shared by the position and portfolio hooks.
 */
export function calculatePoolPosition(input: CalculatePoolPositionParameters): PoolPositionData {
  const percent = input.withdrawalPercent;
  if (percent != null && (!Number.isInteger(percent) || percent < 0 || percent > 100)) {
    throw new RangeError("Withdrawal percent must be an integer from 0 to 100");
  }
  const { profit, detail } = input;
  if ((input.tokenContractAddress == null) !== (input.depositChain == null)) {
    throw new TypeError("Supply both pool identity fields or neither for scoped snapshots");
  }
  const totalLp = profit?.userLpAmount ?? null;
  const pendingLp =
    totalLp == null || profit?.pendingWithdrawLpAmount == null
      ? null
      : profit.pendingWithdrawLpAmount > totalLp
        ? totalLp
        : profit.pendingWithdrawLpAmount < 0n
          ? 0n
          : profit.pendingWithdrawLpAmount;
  const availableLp = totalLp == null || pendingLp == null ? null : totalLp - pendingLp;
  const totalToken = profit?.userBalanceInTokens ?? null;
  const totalUsdc = profit?.userBalanceInUsdc ?? null;
  const split = (amount: bigint | null) =>
    amount == null || totalLp == null || availableLp == null
      ? null
      : totalLp > 0n
        ? (amount * availableLp) / totalLp
        : 0n;
  const availableToken = split(totalToken);
  const availableUsdc = split(totalUsdc);
  const history =
    input.depositsComplete === false
      ? null
      : input.depositHistory !== undefined
        ? input.depositHistory
        : input.deposits
          ? sumPoolDepositHistory(
              input.deposits
                .filter(
                  (row) =>
                    row.type === "deposit" &&
                    (input.depositChain == null || row.chainId === input.depositChain) &&
                    (input.tokenContractAddress == null ||
                      row.tokenAddress.toLowerCase() === input.tokenContractAddress.toLowerCase()),
                )
                .map((row) => ({ amount: row.amount, status: row.status })),
            )
          : null;
  const depositedToken = history ? history.success + history.transferred : (profit?.userDepositedTokenAmount ?? null);
  const refundable = history ? history.success + history.transferred + history.rejected - history.refund : null;
  const nonnegative = (value: bigint) => (value > 0n ? value : 0n);
  const currentDepositToken = history ? nonnegative(history.success + history.transferred + history.pending) : null;
  const pendingToken = totalToken == null || availableToken == null ? null : totalToken - availableToken;
  const pendingUsdc = totalUsdc == null || availableUsdc == null ? null : totalUsdc - availableUsdc;
  const sharePercent = input.userSharePercentage;
  const poolUsdc = profit?.totalUsdcInPool ?? detail?.totalUsdcInPool;
  const share =
    sharePercent != null && Number.isFinite(sharePercent)
      ? sharePercent / 100
      : profit?.userBalanceInUsdc != null && poolUsdc != null && poolUsdc > 0n
        ? Number((profit.userBalanceInUsdc * 10n ** 18n) / poolUsdc) / 1e18
        : null;
  const priceUsd =
    input.priceUsd != null && Number.isFinite(input.priceUsd) && input.priceUsd >= 0 ? input.priceUsd : null;
  const selectedLp = percent == null || availableLp == null ? null : availableLp * BigInt(percent);
  const denominator = totalLp != null && totalLp > 0n ? totalLp * 100n : 1n;
  const withdrawalTokenAmount =
    selectedLp == null || totalToken == null ? null : (totalToken * selectedLp) / denominator;
  const withdrawalUsdcAmount = selectedLp == null || totalUsdc == null ? null : (totalUsdc * selectedLp) / denominator;
  const priceRaw = priceUsd == null ? 0n : parseUnits(toDecimal(priceUsd).toFixed(), 18);
  return {
    tokenContractAddress: input.tokenContractAddress ?? null,
    depositChain: input.depositChain ?? null,
    marketStatus: detail?.marketStatus ?? null,
    symbolId: detail?.symbolId ?? null,
    availableToken,
    availableUsdc,
    pendingToken,
    pendingUsdc,
    availableLp,
    pendingLp,
    totalLp,
    availableRatio:
      availableLp == null || totalLp == null
        ? null
        : totalLp > 0n
          ? Number((availableLp * 10n ** 18n) / totalLp) / 1e18
          : 0,
    pendingRatio:
      pendingLp == null || totalLp == null
        ? null
        : totalLp > 0n
          ? Number((pendingLp * 10n ** 18n) / totalLp) / 1e18
          : 0,
    withdrawalLpAmount: selectedLp == null ? null : selectedLp / 100n,
    withdrawalTokenAmount,
    withdrawalUsdcAmount,
    withdrawalValueUsd:
      withdrawalTokenAmount == null || withdrawalUsdcAmount == null
        ? null
        : withdrawalUsdcAmount + (withdrawalTokenAmount * priceRaw) / 10n ** 18n,
    totalToken,
    totalUsdc,
    depositedToken,
    depositHistory: history,
    currentDepositToken,
    uncreditedDepositToken: history ? nonnegative(history.pending + history.rejected - history.refund) : null,
    currentDepositUsd: currentDepositToken == null || priceUsd == null ? null : units(currentDepositToken)! * priceUsd,
    refundableValueUsd: refundable == null || priceUsd == null ? null : units(nonnegative(refundable))! * priceUsd,
    pendingValueUsd:
      pendingToken == null || pendingUsdc == null ? null : units(pendingUsdc)! + units(pendingToken)! * (priceUsd ?? 0),
    pendingDepositToken: history?.pending ?? null,
    rejectedDepositToken: history?.rejected ?? null,
    refundedToken: history?.refund ?? null,
    refundableToken: refundable == null ? null : refundable > 0n ? refundable : 0n,
    fullyRefunded: history && refundable != null ? history.refund > 0n && refundable <= 0n : null,
    claimableReward: profit?.claimableReward ?? null,
    claimedReward: profit?.claimedReward ?? null,
    shareFraction: share == null ? null : Math.min(1, Math.max(0, share)),
    priceUsd,
    balanceUsd:
      totalToken == null || totalUsdc == null ? null : units(totalUsdc)! + units(totalToken)! * (priceUsd ?? 0),
    valuationComplete: totalToken != null && totalUsdc != null && (totalToken === 0n || priceUsd != null),
    gaps: [...(input.gaps ?? [])],
  };
}
