"use client";

import {
  getCoolDownsOfMAQueryOptions,
  type ConfigParameter,
  type GetCoolDownsOfMAOptions,
  type GetCoolDownsOfMAReturnType,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/**
 * Parameters for {@link useCoolDownsOfMA}: the core query options (chain id,
 * TanStack `query` overrides) plus an optional `config`.
 */
export type UseCoolDownsOfMAParameters = GetCoolDownsOfMAOptions & ConfigParameter;

/** Return type of {@link useCoolDownsOfMA}. */
export type UseCoolDownsOfMAReturnType = UseQueryResult<GetCoolDownsOfMAReturnType, SymmioRequestError>;

/**
 * Read the protocol cooldown periods (`coolDownsOfMA`) as a 4-tuple of seconds.
 * **Index 1 is the force-cancel cooldown** — the delay after a quote enters
 * `CANCEL_PENDING` before {@link useForceCancelQuote} becomes eligible
 * (`now >= statusModifyTimestamp + coolDowns[1]`). These values rarely change,
 * so a long `staleTime` is appropriate. Errors are normalized to
 * {@link SymmioRequestError}.
 *
 * @example
 * ```tsx
 * const { data: coolDowns } = useCoolDownsOfMA();
 * const forceCancelCooldown = coolDowns?.[1];
 * ```
 */
export function useCoolDownsOfMA(parameters: UseCoolDownsOfMAParameters = {}): UseCoolDownsOfMAReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = getCoolDownsOfMAQueryOptions(config, {
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
  }) as UseCoolDownsOfMAReturnType;
}
