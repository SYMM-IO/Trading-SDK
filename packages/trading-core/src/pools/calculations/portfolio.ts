import { ListingMarketStatus } from "../types";

/** A deposit history in 18-decimal token units. These are lifetime flows, not the user's current balance. */
export interface PoolDepositHistory {
  pending: bigint;
  transferred: bigint;
  refund: bigint;
  rejected: bigint;
  success: bigint;
}
/** Minimal catalog identity required to assemble a portfolio; extra consumer fields pass through unchanged. */
export interface PoolPortfolioMarket {
  contractAddress: string;
  chainId: number;
  marketStatus: ListingMarketStatus;
  userDeposit?: bigint | null;
}
/** A deposit's amount and identity. `decimals` describes the amount, not token metadata; normalized transactions use 18. */
export interface PoolPortfolioDeposit {
  contractAddress: string;
  chainId: number;
  amount: bigint;
  decimals?: number;
  status: string;
  marketStatus?: ListingMarketStatus;
}
/** One assembled portfolio entry, with an authoritative source row or a deposit-backed fallback. */
export interface PoolPortfolioEntry<M, D> {
  market?: M;
  deposit?: D;
  marketStatus: ListingMarketStatus;
  history?: PoolDepositHistory;
}

/** Sum legacy/current deposit statuses using integer math. Withdrawal records never enter deposit history. */
export function sumPoolDepositHistory(
  deposits: readonly Pick<PoolPortfolioDeposit, "amount" | "decimals" | "status">[],
): PoolDepositHistory {
  const history: PoolDepositHistory = { pending: 0n, transferred: 0n, refund: 0n, rejected: 0n, success: 0n };
  for (const deposit of deposits) {
    const exponent = 18 - (deposit.decimals ?? 18);
    const amount = exponent >= 0 ? deposit.amount * 10n ** BigInt(exponent) : deposit.amount / 10n ** BigInt(-exponent);
    switch (deposit.status) {
      case "waiting":
      case "pending":
        history.pending += amount;
        break;
      case "deposited":
      case "transferred":
        history.transferred += amount;
        break;
      case "refund":
      case "refound":
        history.refund += amount;
        break;
      case "rejected":
        history.rejected += amount;
        break;
      case "success":
        history.success += amount;
        break;
    }
  }
  return history;
}

/**
 * Assemble the complete portfolio before caller filtering or pagination. Keep
 * catalog order and add non-listed pools only when backed by the user's deposits.
 * Non-listed catalog rows supply status only; they never create holdings.
 */
export function assemblePoolPortfolio<M extends PoolPortfolioMarket, D extends PoolPortfolioDeposit>(
  markets: readonly M[],
  nonListed: readonly M[],
  deposits: readonly D[],
): PoolPortfolioEntry<M, D>[] {
  const groups = new Map<string, D[]>();
  for (const deposit of deposits) {
    if (!deposit.contractAddress) continue;
    const key = identity(deposit);
    groups.set(key, [...(groups.get(key) ?? []), deposit]);
  }
  const result = new Map<string, PoolPortfolioEntry<M, D>>();
  for (const market of markets) {
    if (!market.contractAddress || result.has(identity(market))) continue;
    result.set(identity(market), {
      market,
      marketStatus: market.marketStatus,
      history:
        market.userDeposit != null && market.userDeposit > 0n
          ? { ...sumPoolDepositHistory([]), transferred: market.userDeposit }
          : undefined,
    });
  }
  const statuses = new Map(nonListed.map((market) => [identity(market), market.marketStatus]));
  for (const [key, values] of groups) {
    const history = sumPoolDepositHistory(values);
    const existing = result.get(key);
    if (existing) {
      existing.history = history;
      continue;
    }
    const deposit = values[0]!;
    const inferred =
      history.success + history.transferred > 0n
        ? ListingMarketStatus.LISTED
        : history.rejected > 0n
          ? ListingMarketStatus.REJECTED
          : ListingMarketStatus.WAITING_FOR_DEPOSIT;
    result.set(key, { deposit, history, marketStatus: statuses.get(key) ?? deposit.marketStatus ?? inferred });
  }
  return [...result.values()];
}

function identity(value: { contractAddress: string; chainId: number }) {
  return `${value.chainId}:${value.chainId === 0 ? value.contractAddress : value.contractAddress.toLowerCase()}`;
}
