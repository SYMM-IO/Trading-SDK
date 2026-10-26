import { units, type PoolReadGap } from "../composition";
import type {
  ListingDepositChainId,
  ListingMarketDetail,
  ListingMarketStatus,
  UserPoolProfit,
  UserTransaction,
} from "../types";
import { sumPoolDepositHistory } from "./sum-deposits";

/** One user's stake. Raw token, collateral and LP amounts use 18 decimals; USD values are unformatted numbers. */
export interface PoolPositionData {
  tokenContractAddress: string;
  depositChain: ListingDepositChainId;
  marketStatus: ListingMarketStatus | null;
  symbolId: number | null;
  availableToken: bigint | null;
  availableUsdc: bigint | null;
  pendingToken: bigint | null;
  pendingUsdc: bigint | null;
  availableLp: bigint | null;
  pendingLp: bigint | null;
  totalLp: bigint | null;
  totalToken: bigint | null;
  totalUsdc: bigint | null;
  depositedToken: bigint | null;
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
  tokenContractAddress: string;
  depositChain: ListingDepositChainId;
  detail: ListingMarketDetail | null;
  profit: UserPoolProfit | null;
  deposits: readonly UserTransaction[] | null;
  depositsComplete?: boolean;
  priceUsd?: number;
  gaps?: readonly PoolReadGap[];
}

/** Derive a stake from normalized reads, preserving unknown values and doing balance math in bigint.
 * @param input - Detail, profit, and deposit reads for one pool.
 * @returns Flat position data, shared by the position and portfolio hooks.
 */
export function calculatePoolPosition(input: CalculatePoolPositionParameters): PoolPositionData {
  const { profit, detail } = input;
  const totalLp = profit?.userLpAmount ?? null;
  const pendingLp =
    profit == null
      ? null
      : profit.pendingWithdrawLpAmount > profit.userLpAmount
        ? profit.userLpAmount
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
    input.deposits && input.depositsComplete !== false
      ? sumPoolDepositHistory(
          input.deposits
            .filter(
              (row) =>
                row.type === "deposit" &&
                row.chainId === input.depositChain &&
                row.tokenAddress.toLowerCase() === input.tokenContractAddress.toLowerCase(),
            )
            .map((row) => ({ amount: row.amount, status: row.status })),
        )
      : null;
  const depositedToken = history ? history.success + history.transferred : (profit?.userDepositedTokenAmount ?? null);
  const refundable = history ? history.success + history.transferred + history.rejected - history.refund : null;
  const priceUsd =
    input.priceUsd != null && Number.isFinite(input.priceUsd) && input.priceUsd >= 0 ? input.priceUsd : null;
  return {
    tokenContractAddress: input.tokenContractAddress,
    depositChain: input.depositChain,
    marketStatus: detail?.marketStatus ?? null,
    symbolId: detail?.symbolId ?? null,
    availableToken,
    availableUsdc,
    pendingToken: totalToken == null || availableToken == null ? null : totalToken - availableToken,
    pendingUsdc: totalUsdc == null || availableUsdc == null ? null : totalUsdc - availableUsdc,
    availableLp,
    pendingLp,
    totalLp,
    totalToken,
    totalUsdc,
    depositedToken,
    pendingDepositToken: history?.pending ?? null,
    rejectedDepositToken: history?.rejected ?? null,
    refundedToken: history?.refund ?? null,
    refundableToken: refundable == null ? null : refundable > 0n ? refundable : 0n,
    fullyRefunded: history && refundable != null ? history.refund > 0n && refundable <= 0n : null,
    claimableReward: profit?.claimableReward ?? null,
    claimedReward: profit?.claimedReward ?? null,
    shareFraction:
      profit == null || !detail || detail.totalUsdcInPool <= 0n
        ? null
        : Math.min(1, Math.max(0, Number((profit.userBalanceInUsdc * 10n ** 18n) / detail.totalUsdcInPool) / 1e18)),
    priceUsd,
    balanceUsd:
      totalToken == null || totalUsdc == null ? null : units(totalUsdc)! + units(totalToken)! * (priceUsd ?? 0),
    valuationComplete: profit != null && (totalToken === 0n || priceUsd != null),
    gaps: [...(input.gaps ?? [])],
  };
}
