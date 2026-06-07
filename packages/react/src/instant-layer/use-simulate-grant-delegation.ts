"use client";

import {
  getSimulateGrantDelegationQueryOptions,
  type ConfigParameter,
  type SimulateGrantDelegationData,
  type SimulateGrantDelegationOptions,
} from "@symm-frontier/core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useConnection } from "wagmi";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/**
 * Parameters for {@link useSimulateGrantDelegation}: the core simulate options
 * (account, delegatedSigner, selectors, expiryTimestamp, from, chain id, TanStack
 * `query` overrides) plus an optional `config`.
 */
export type UseSimulateGrantDelegationParameters = SimulateGrantDelegationOptions & ConfigParameter;

/** Return type of {@link useSimulateGrantDelegation}. */
export type UseSimulateGrantDelegationReturnType = UseQueryResult<SimulateGrantDelegationData, SymmioRequestError>;

/**
 * Dry-run a `grantDelegation` transaction (`simulateContract`) without sending
 * it. Disabled until `account`, `delegatedSigner`, `selectors`, and
 * `expiryTimestamp` are set; `from` defaults to the connected wallet. A would-be
 * revert surfaces as a normalized {@link SymmioRequestError}.
 *
 * @example
 * ```tsx
 * const sim = useSimulateGrantDelegation({ account, delegatedSigner, selectors, expiryTimestamp, query: { enabled: false } });
 * sim.refetch();
 * ```
 */
export function useSimulateGrantDelegation(
  parameters: UseSimulateGrantDelegationParameters = {},
): UseSimulateGrantDelegationReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const { address } = useConnection();
  const options = getSimulateGrantDelegationQueryOptions(config, {
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
  }) as UseSimulateGrantDelegationReturnType;
}
