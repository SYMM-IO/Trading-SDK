"use client";

import {
  projectListingMarketConfig,
  type ConfigParameter,
  type ListingDepositChainId,
  type ListingMarketConfigProjection,
} from "@symmio/trading-core";
import { useMemo } from "react";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useListingMarketConfig } from "./use-listing-market-config";
import { useListingMarketDetail } from "./use-listing-market-detail";
import { useUserProfit } from "./use-user-profit";

/** Parameters for {@link useListingMarketConfigProjection}. */
export type UseListingMarketConfigProjectionParameters = ConfigParameter & {
  /** Bearer token from {@link useAuthenticateListing}. */
  accessToken: string;
  /** The pool's token contract address. */
  tokenContractAddress: string;
  /** The pool's deposit chain — the pool's `ListingMarket.chainId`. */
  depositChain: ListingDepositChainId;
  /** The buyback percentage the user is about to submit. Omit to skip that knob. */
  buybackRatio?: number;
  /** The max leverage the user is about to submit. Omit to skip that knob. */
  maxLeverage?: number;
  /** Chain the listing backend is resolved from. Defaults to the connected chain. */
  chainId?: number;
  /** Set `false` to keep every underlying read idle. */
  enabled?: boolean;
};

/** Return type of {@link useListingMarketConfigProjection}. */
export interface UseListingMarketConfigProjectionReturnType {
  /** The projection, or `undefined` until the reads it needs have resolved. */
  data: ListingMarketConfigProjection | undefined;
  /** `true` while any of the three underlying reads is still loading. */
  isLoading: boolean;
  /** The first error among the underlying reads, or `null`. */
  error: SymmioRequestError | null;
}

/**
 * Estimate where a pool's configuration lands once the user's opinion is saved
 * — the "new pool buyback / new pool leverage" figures an edit form shows before
 * the write.
 *
 * The listing service blends every LP's opinion by deposit weight, so this
 * composes the three reads that weight needs — the pool's current values
 * ({@link useListingMarketDetail}), the user's prior opinion
 * ({@link useListingMarketConfig}), and the user's stake
 * ({@link useUserProfit}) — and applies core's pure
 * `projectListingMarketConfig`. Nothing here is cached separately: it reuses the
 * three hooks' entries, so mounting it alongside them costs no extra request.
 *
 * The result is an **estimate**. The service rounds the blend it stores, so
 * render it with a `~` and treat the value
 * {@link useUpdateListingMarketConfig} resolves to as the exact figure.
 *
 * When the user has never configured this pool, the pool value is used as the
 * baseline for their prior opinion, which makes the projection an approximation
 * rather than a first-order exact shift.
 *
 * @example
 * ```tsx
 * const [buybackRatio, setBuybackRatio] = useState(50);
 *
 * const { data } = useListingMarketConfigProjection({
 *   accessToken,
 *   tokenContractAddress,
 *   depositChain: market.chainId,
 *   buybackRatio,
 * });
 *
 * // e.g. "~52.5%"
 * data?.projectedBuybackRatio;
 * ```
 */
export function useListingMarketConfigProjection(
  parameters: UseListingMarketConfigProjectionParameters,
): UseListingMarketConfigProjectionReturnType {
  const enabled = parameters.enabled ?? true;

  const detail = useListingMarketDetail({
    config: parameters.config,
    chainId: parameters.chainId,
    tokenContractAddress: parameters.tokenContractAddress,
    depositChain: parameters.depositChain,
    query: { enabled: enabled && parameters.tokenContractAddress.length > 0 },
  });

  const marketConfig = useListingMarketConfig({
    config: parameters.config,
    chainId: parameters.chainId,
    accessToken: parameters.accessToken,
    tokenContractAddress: parameters.tokenContractAddress,
    depositChain: parameters.depositChain,
    query: { enabled },
  });

  const profit = useUserProfit({
    config: parameters.config,
    chainId: parameters.chainId,
    accessToken: parameters.accessToken,
    tokenContractAddress: parameters.tokenContractAddress,
    query: { enabled },
  });

  const data = useMemo(() => {
    if (!detail.data) return undefined;

    return projectListingMarketConfig({
      poolBuybackRatio: detail.data.buybackRatio,
      poolMaxLeverage: detail.data.maxLeverage,
      // The prior opinion is optional: a backend without the read, or a user who
      // has never configured this pool, both fall back to the pool baseline.
      priorBuybackRatio: marketConfig.data?.userBuybackRatio ?? null,
      priorMaxLeverage: marketConfig.data?.userMaxLeverage ?? null,
      buybackRatio: parameters.buybackRatio,
      maxLeverage: parameters.maxLeverage,
      userTokenAmount: profit.data?.userBalanceInTokens ?? 0n,
      totalTokenInPool: detail.data.totalTokenInPool,
      tvl: detail.data.tvl,
      totalUsdcInPool: detail.data.totalUsdcInPool,
    });
  }, [detail.data, marketConfig.data, profit.data, parameters.buybackRatio, parameters.maxLeverage]);

  return {
    data,
    isLoading: detail.isLoading || marketConfig.isLoading || profit.isLoading,
    error: detail.error ?? marketConfig.error ?? profit.error,
  };
}
