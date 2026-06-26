"use client";

import {
  getCollateralBalanceQueryOptions,
  type ConfigParameter,
  type GetCollateralBalanceOptions,
  type GetCollateralBalanceReturnType,
} from "@theoldvarorg/core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/**
 * Parameters for {@link useCollateralBalance}: the core query options (owner,
 * chain id, TanStack `query` overrides) plus an optional `config`.
 */
export type UseCollateralBalanceParameters = GetCollateralBalanceOptions & ConfigParameter;

/** Return type of {@link useCollateralBalance}. */
export type UseCollateralBalanceReturnType = UseQueryResult<GetCollateralBalanceReturnType, SymmioRequestError>;

/**
 * Read `owner`'s wallet balance of the chain's collateral token (e.g. USDC) — the
 * funds available to deposit. The query is disabled until `owner` is set.
 * `chainId` defaults to the connected chain.
 *
 * @example
 * ```tsx
 * const { data: balance } = useCollateralBalance({ owner: address });
 * ```
 */
export function useCollateralBalance(parameters: UseCollateralBalanceParameters = {}): UseCollateralBalanceReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = getCollateralBalanceQueryOptions(config, {
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
  }) as UseCollateralBalanceReturnType;
}
