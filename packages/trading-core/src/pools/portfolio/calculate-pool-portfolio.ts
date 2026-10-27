import { units, type PoolReadGap } from "../composition";
import { calculatePoolPosition, type PoolPositionData } from "../position/calculate-pool-position";
import type { ListingMarketDetail, UserListingMarket, UserPoolProfit, UserTransaction } from "../types";

/** Pool identity and an optional third-party price, supplied by the consumer. */
export interface PoolPortfolioPrice {
  tokenContractAddress: string;
  depositChain: number;
  priceUsd: number;
}
/** Flat portfolio row. Stake fields have exactly the position read's semantics. */
export interface PoolPortfolioPosition extends PoolPositionData {
  tokenName: string | null;
  tokenTicker: string | null;
  apr: number | null;
}
/** Portfolio values before any consumer filtering or pagination. */
export interface PoolPortfolio {
  entries: PoolPortfolioPosition[];
  totalBalanceUsd: number | null;
  totalDepositedUsd: number | null;
  claimableRewardUsd: number | null;
  claimedRewardUsd: number | null;
  rewardWindowUsd: number | null;
  averageApr: number | null;
  /** ROI over the same fully priced positions on both sides. Null when no comparable deposits exist. */
  roiPercent: number | null;
  gaps: PoolReadGap[];
}
/** Normalized reads for portfolio assembly; no wire strings or generated vendor types. */
export interface CalculatePoolPortfolioParameters {
  listed: readonly UserListingMarket[];
  nonListed: readonly UserListingMarket[];
  deposits: readonly UserTransaction[] | null;
  positions: readonly {
    tokenContractAddress: string;
    depositChain: number;
    profit: UserPoolProfit | null;
    detail: ListingMarketDetail | null;
  }[];
  prices?: readonly PoolPortfolioPrice[];
  reward: bigint | null;
  gaps?: readonly PoolReadGap[];
}

/** Assemble holdings and totals from SDK reads; filtering and top-earner selection remain consumer-owned.
 * @param input - Normalized source snapshots and explicit read gaps.
 * @returns Rows with exact stake amounts, USD totals and completeness information.
 */
export function calculatePoolPortfolio(input: CalculatePoolPortfolioParameters): PoolPortfolio {
  const gaps = [...(input.gaps ?? [])];
  const catalog = [...input.listed, ...input.nonListed];
  const aliases = new Map<string, Set<string>>();
  for (const row of catalog) {
    const id = `${row.chainId}:${row.contractAddress.toLowerCase()}`;
    const values = aliases.get(id) ?? new Set<string>();
    values.add(row.contractAddress);
    aliases.set(id, values);
  }
  function key(address: string, chain: number): string {
    const folded = `${chain}:${address.toLowerCase()}`;
    return chain === 0 && (aliases.get(folded)?.size ?? 0) > 1 ? `${chain}:${address}` : folded;
  }
  const markets = new Map(catalog.map((row) => [key(row.contractAddress, row.chainId), row]));
  const groups = new Map<string, UserTransaction[]>();
  for (const row of input.deposits ?? []) {
    if (row.type !== "deposit") continue;
    const id = key(row.tokenAddress, row.chainId);
    if (
      row.chainId === 0 &&
      (aliases.get(`${row.chainId}:${row.tokenAddress.toLowerCase()}`)?.size ?? 0) > 1 &&
      !markets.has(id)
    ) {
      gaps.push({ source: "deposits", tokenContractAddress: row.tokenAddress, reason: "ambiguous-address" });
    }
    groups.set(id, [...(groups.get(id) ?? []), row]);
  }
  const identities = new Map(
    input.listed.map((row) => [
      key(row.contractAddress, row.chainId),
      { address: row.contractAddress, chain: row.chainId },
    ]),
  );
  for (const [id, rows] of groups)
    if (!identities.has(id)) {
      const market = markets.get(id);
      identities.set(id, { address: market?.contractAddress ?? rows[0]!.tokenAddress, chain: rows[0]!.chainId });
    }
  const entries = [...identities].map(([id, identity]) => {
    const market = markets.get(id);
    const source = input.positions.find((row) => key(row.tokenContractAddress, row.depositChain) === id);
    const price = input.prices?.find((row) => key(row.tokenContractAddress, row.depositChain) === id);
    const position = calculatePoolPosition({
      tokenContractAddress: identity.address,
      depositChain: identity.chain,
      detail: source?.detail ?? null,
      profit: source?.profit ?? null,
      deposits: input.deposits == null ? null : (groups.get(id) ?? []),
      depositsComplete: !gaps.some((gap) => gap.source === "deposits"),
      priceUsd: price?.priceUsd,
      gaps: gaps.filter((gap) => gap.tokenContractAddress === identity.address),
    });
    if (!groups.has(id))
      position.depositedToken =
        source?.profit?.userDepositedTokenAmount ?? market?.userDeposit ?? position.depositedToken;
    return {
      ...position,
      marketStatus: market?.marketStatus ?? position.marketStatus,
      symbolId: market?.symbolId ?? position.symbolId,
      tokenName: market?.tokenName ?? groups.get(id)?.[0]?.tokenName ?? null,
      tokenTicker: market?.tokenTicker ?? groups.get(id)?.[0]?.tokenTicker ?? null,
      apr: units(market?.apr),
    };
  });
  let balance = 0,
    deposits = 0,
    weight = 0,
    weightedApr = 0;
  for (const row of entries) {
    if (row.valuationComplete && row.balanceUsd != null && row.depositedToken != null && row.priceUsd != null) {
      balance += row.balanceUsd;
      deposits += units(row.depositedToken)! * row.priceUsd;
    }
    if (row.apr != null && row.apr > 0 && row.totalUsdc != null && row.totalUsdc > 0n) {
      weight += units(row.totalUsdc)!;
      weightedApr += units(row.totalUsdc)! * row.apr;
    }
  }
  const holdingsComplete = !gaps.some(
    (gap) =>
      gap.source === "deposits" ||
      ["listed", "under_review", "rejected", "delisted", "waiting_for_deposit"].includes(gap.source),
  );
  const allKnown = holdingsComplete && entries.every((row) => row.balanceUsd != null);
  const sumReward = (field: "claimableReward" | "claimedReward") =>
    holdingsComplete && entries.every((row) => row[field] != null)
      ? units(entries.reduce((sum, row) => sum + row[field]!, 0n))
      : null;
  return {
    entries,
    totalBalanceUsd: allKnown ? entries.reduce((sum, row) => sum + row.balanceUsd!, 0) : null,
    totalDepositedUsd:
      holdingsComplete && entries.every((row) => row.depositedToken != null && row.priceUsd != null)
        ? entries.reduce((sum, row) => sum + units(row.depositedToken)! * row.priceUsd!, 0)
        : null,
    claimableRewardUsd: sumReward("claimableReward"),
    claimedRewardUsd: sumReward("claimedReward"),
    rewardWindowUsd: units(input.reward),
    averageApr: weight > 0 ? weightedApr / weight : null,
    roiPercent: deposits > 0 ? ((balance - deposits) / deposits) * 100 : null,
    gaps,
  };
}
