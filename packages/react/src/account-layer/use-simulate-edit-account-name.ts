"use client";

import {
  getSimulateEditAccountNameQueryOptions,
  type ConfigParameter,
  type SimulateEditAccountNameData,
  type SimulateEditAccountNameOptions,
} from "@symm-frontier/core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useConnection } from "wagmi";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/**
 * Parameters for {@link useSimulateEditAccountName}: the core simulate options
 * (account, name, from, chain id, TanStack `query` overrides) plus an optional
 * `config`.
 */
export type UseSimulateEditAccountNameParameters = SimulateEditAccountNameOptions & ConfigParameter;

/** Return type of {@link useSimulateEditAccountName}. */
export type UseSimulateEditAccountNameReturnType = UseQueryResult<SimulateEditAccountNameData, SymmioRequestError>;

/**
 * Dry-run an `editAccountName` transaction (`simulateContract`) without sending
 * it. Disabled until `account` and a non-empty `name` are set; `from` defaults to
 * the connected wallet. A would-be revert surfaces as a normalized
 * {@link SymmioRequestError}.
 *
 * @example
 * ```tsx
 * const sim = useSimulateEditAccountName({ account, name, query: { enabled: false } });
 * sim.refetch();
 * ```
 */
export function useSimulateEditAccountName(
  parameters: UseSimulateEditAccountNameParameters = {},
): UseSimulateEditAccountNameReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const { address } = useConnection();
  const options = getSimulateEditAccountNameQueryOptions(config, {
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
  }) as UseSimulateEditAccountNameReturnType;
}
