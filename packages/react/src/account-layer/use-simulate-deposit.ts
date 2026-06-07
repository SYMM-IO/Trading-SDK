"use client";

import {
  getSimulateDepositForAccountQueryOptions,
  type ConfigParameter,
  type SimulateDepositForAccountData,
  type SimulateDepositForAccountOptions,
} from "@symm-frontier/core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useConnection } from "wagmi";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/**
 * Parameters for {@link useSimulateDeposit}: the core simulate options (account,
 * amount, from, chain id, TanStack `query` overrides) plus an optional `config`.
 */
export type UseSimulateDepositParameters = SimulateDepositForAccountOptions & ConfigParameter;

/** Return type of {@link useSimulateDeposit}. */
export type UseSimulateDepositReturnType = UseQueryResult<SimulateDepositForAccountData, SymmioRequestError>;

/**
 * Dry-run a `depositForAccount` transaction (`simulateContract`) without sending
 * it — surfaces e.g. an insufficient collateral allowance before the user signs.
 * Disabled until `account` and `amount` are set; `from` defaults to the connected
 * wallet. A would-be revert surfaces as a normalized {@link SymmioRequestError}.
 *
 * @example
 * ```tsx
 * const sim = useSimulateDeposit({ account, amount, query: { enabled: false } });
 * sim.refetch();
 * ```
 */
export function useSimulateDeposit(parameters: UseSimulateDepositParameters = {}): UseSimulateDepositReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const { address } = useConnection();
  const options = getSimulateDepositForAccountQueryOptions(config, {
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
  }) as UseSimulateDepositReturnType;
}
