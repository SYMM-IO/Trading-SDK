"use client";

import {
  getForceCloseParamsQueryOptions,
  type ConfigParameter,
  type GetForceCloseParamsData,
  type GetForceCloseParamsOptions,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/** Parameters for {@link useForceCloseParams}: the core options (`symbolId`, chain id) plus an optional `config`. */
export type UseForceCloseParamsParameters = GetForceCloseParamsOptions & ConfigParameter;

/** Return type of {@link useForceCloseParams}. */
export type UseForceCloseParamsReturnType = UseQueryResult<GetForceCloseParamsData, SymmioRequestError>;

/**
 * Read the protocol force-close params (cooldowns, price penalty, min signature
 * period, and the symbol's gap ratio) for a market — the inputs to the
 * force-close eligibility gate and price checks. Disabled until `symbolId` is
 * set; these change rarely, so a long `staleTime` fits. Errors are normalized to
 * {@link SymmioRequestError}.
 *
 * @example
 * ```tsx
 * const { data: params } = useForceCloseParams({ symbolId: 1n });
 * ```
 */
export function useForceCloseParams(parameters: UseForceCloseParamsParameters = {}): UseForceCloseParamsReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = getForceCloseParamsQueryOptions(config, {
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
  }) as UseForceCloseParamsReturnType;
}
