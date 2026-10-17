"use client";

import {
  getFundingInfoQueryOptions,
  type ConfigParameter,
  type GetFundingInfoOptions,
  type GetFundingInfoReturnType,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/**
 * Parameters for {@link useFundingInfo}: the core query options plus an optional
 * `config`.
 */
export type UseFundingInfoParameters = GetFundingInfoOptions & ConfigParameter;

/** Return type of {@link useFundingInfo}. */
export type UseFundingInfoReturnType = UseQueryResult<GetFundingInfoReturnType, SymmioRequestError>;

/**
 * Read per-market funding rates from the active chain's solver in one call.
 * Surfaces the next-epoch long/short funding rate, next funding time, and epoch
 * length for every market (or only the requested `symbolIds`).
 *
 * Does not poll by default; pass `query.refetchInterval` to opt into polling.
 *
 * @param parameters - Deployment, optional config and query overrides.
 * @returns Query state; Enigma rows identify markets by symbolId.
 * @throws {SymmioRequestError} Action failures appear in the query error state.
 * @example
 * ```tsx
 * const { data } = useFundingInfo();
 * const btc = data?.find((f) => f.symbolId === 1);
 * ```
 */
export function useFundingInfo(parameters: UseFundingInfoParameters = {}): UseFundingInfoReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = getFundingInfoQueryOptions(config, {
    ...parameters,
    chainId: parameters.chainId ?? chainId,
  });

  return useQuery({
    ...options,
    queryFn: async () => {
      try {
        return await options.queryFn();
      } catch (err) {
        throw normalizeSymmError(err);
      }
    },
  }) as UseFundingInfoReturnType;
}
