"use client";

import {
  getSimulateFinalizeWithdrawRequestQueryOptions,
  type ConfigParameter,
  type SimulateFinalizeWithdrawRequestData,
  type SimulateFinalizeWithdrawRequestOptions,
} from "@symm-frontier/core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useConnection } from "wagmi";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/**
 * Parameters for {@link useSimulateFinalizeWithdrawRequest}: the core simulate
 * options (user, requestId, from, chain id, TanStack `query` overrides) plus an
 * optional `config`.
 */
export type UseSimulateFinalizeWithdrawRequestParameters = SimulateFinalizeWithdrawRequestOptions & ConfigParameter;

/** Return type of {@link useSimulateFinalizeWithdrawRequest}. */
export type UseSimulateFinalizeWithdrawRequestReturnType = UseQueryResult<
  SimulateFinalizeWithdrawRequestData,
  SymmioRequestError
>;

/**
 * Dry-run a `finalizeWithdrawRequest` transaction (`simulateContract`) without
 * sending it — surfaces e.g. a not-yet-elapsed cooldown before the user signs.
 * Disabled until `user` and `requestId` are set; `from` defaults to the connected
 * wallet. A would-be revert surfaces as a normalized {@link SymmioRequestError}.
 *
 * @example
 * ```tsx
 * const sim = useSimulateFinalizeWithdrawRequest({ user, requestId, query: { enabled: false } });
 * sim.refetch();
 * ```
 */
export function useSimulateFinalizeWithdrawRequest(
  parameters: UseSimulateFinalizeWithdrawRequestParameters = {},
): UseSimulateFinalizeWithdrawRequestReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const { address } = useConnection();
  const options = getSimulateFinalizeWithdrawRequestQueryOptions(config, {
    ...parameters,
    chainId: parameters.chainId ?? chainId,
    from: parameters.from ?? address,
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
  }) as UseSimulateFinalizeWithdrawRequestReturnType;
}
