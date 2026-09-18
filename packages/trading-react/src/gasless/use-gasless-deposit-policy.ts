"use client";

import {
  getGaslessDepositPolicyQueryOptions,
  type ConfigParameter,
  type GetGaslessDepositPolicyOptions,
  type GetGaslessDepositPolicyReturnType,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/** Parameters for {@link useGaslessDepositPolicy}. */
export type UseGaslessDepositPolicyParameters = GetGaslessDepositPolicyOptions & ConfigParameter;

/** Return type of {@link useGaslessDepositPolicy}. */
export type UseGaslessDepositPolicyReturnType = UseQueryResult<GetGaslessDepositPolicyReturnType, SymmioRequestError>;

/**
 * Read the gasless deposit policy for one of an owner's GaslessWallets - the
 * deterministic deposit address, the collateral token and its decimals, and
 * the deposit fee, minimum and wallet creation fee - via RPC contract reads on
 * the GaslessLayer. `walletId` defaults to `0n`. Gate the settlement UI on the
 * observed balance reaching `settlementMinimum`, which already covers the
 * creation fee.
 *
 * The settlement hooks and `useGaslessWalletExecute` invalidate it, since
 * either may deploy the wallet and zero its creation fee.
 *
 * @param parameters - Owner, optional `walletId` (default `0n`), optional chain id, config and query overrides.
 * @returns The TanStack query result, with failures normalized to {@link SymmioRequestError}.
 *
 * @example
 * ```tsx
 * const query = useGaslessDepositPolicy({ owner });
 * ```
 */
export function useGaslessDepositPolicy(
  parameters: UseGaslessDepositPolicyParameters,
): UseGaslessDepositPolicyReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();

  const options = getGaslessDepositPolicyQueryOptions(config, {
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
  }) as UseGaslessDepositPolicyReturnType;
}
