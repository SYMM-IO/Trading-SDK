"use client";

import {
  getSimulateApproveCollateralQueryOptions,
  type ConfigParameter,
  type SimulateApproveCollateralData,
  type SimulateApproveCollateralOptions,
} from "@symm-frontier/core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useConnection } from "wagmi";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/**
 * Parameters for {@link useSimulateApproveCollateral}: the core simulate options
 * (amount, from, chain id, TanStack `query` overrides) plus an optional `config`.
 */
export type UseSimulateApproveCollateralParameters = SimulateApproveCollateralOptions & ConfigParameter;

/** Return type of {@link useSimulateApproveCollateral}. */
export type UseSimulateApproveCollateralReturnType = UseQueryResult<SimulateApproveCollateralData, SymmioRequestError>;

/**
 * Dry-run an `approveCollateral` (ERC20 `approve`) transaction
 * (`simulateContract`) without sending it. Disabled until `amount` is set; `from`
 * defaults to the connected wallet. A would-be revert surfaces as a normalized
 * {@link SymmioRequestError}.
 *
 * @example
 * ```tsx
 * const sim = useSimulateApproveCollateral({ amount, query: { enabled: false } });
 * sim.refetch();
 * ```
 */
export function useSimulateApproveCollateral(
  parameters: UseSimulateApproveCollateralParameters = {},
): UseSimulateApproveCollateralReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const { address } = useConnection();
  const options = getSimulateApproveCollateralQueryOptions(config, {
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
  }) as UseSimulateApproveCollateralReturnType;
}
