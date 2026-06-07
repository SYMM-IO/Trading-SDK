"use client";

import {
  getSimulateCreateSubAccountsQueryOptions,
  type ConfigParameter,
  type SimulateCreateSubAccountsData,
  type SimulateCreateSubAccountsOptions,
} from "@symm-frontier/core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useConnection } from "wagmi";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/**
 * Parameters for {@link useSimulateCreateSubAccounts}: the core simulate options
 * (affiliate, accountsData, from, chain id, TanStack `query` overrides) plus an
 * optional `config`.
 */
export type UseSimulateCreateSubAccountsParameters = SimulateCreateSubAccountsOptions & ConfigParameter;

/** Return type of {@link useSimulateCreateSubAccounts}. */
export type UseSimulateCreateSubAccountsReturnType = UseQueryResult<SimulateCreateSubAccountsData, SymmioRequestError>;

/**
 * Dry-run a `createSubAccounts` transaction (`simulateContract`) without sending
 * it. The query is disabled until `affiliate` and a non-empty `accountsData` are
 * set; `from` defaults to the connected wallet, and `chainId` to the connected
 * chain. `data.result` holds the predicted subaccount addresses; a would-be
 * revert surfaces as a normalized {@link SymmioRequestError}.
 *
 * @example
 * ```tsx
 * const sim = useSimulateCreateSubAccounts({ affiliate, accountsData, query: { enabled: false } });
 * // run on demand:
 * sim.refetch();
 * ```
 */
export function useSimulateCreateSubAccounts(
  parameters: UseSimulateCreateSubAccountsParameters = {},
): UseSimulateCreateSubAccountsReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const { address } = useConnection();
  const options = getSimulateCreateSubAccountsQueryOptions(config, {
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
  }) as UseSimulateCreateSubAccountsReturnType;
}
