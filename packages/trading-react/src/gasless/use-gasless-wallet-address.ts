"use client";

import {
  getGaslessWalletAddressQueryOptions,
  type ConfigParameter,
  type GetGaslessWalletAddressOptions,
  type GetGaslessWalletAddressReturnType,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/** Parameters for {@link useGaslessWalletAddress}. */
export type UseGaslessWalletAddressParameters = GetGaslessWalletAddressOptions & ConfigParameter;

/** Return type of {@link useGaslessWalletAddress}. */
export type UseGaslessWalletAddressReturnType = UseQueryResult<GetGaslessWalletAddressReturnType, SymmioRequestError>;

/**
 * Read the deterministic address of one of an owner's GaslessWallets (a pure
 * CREATE2 view on the GaslessLayer) - the deposit address for gasless
 * onboarding and the target of gasless-wallet operations. A wallet is
 * identified by `(owner, walletId)`; `walletId` defaults to `0n`, the original
 * wallet, and each positive id has its own address.
 *
 * @param parameters - Owner, optional `walletId` (default `0n`), optional chain id, config and query overrides.
 * @returns The TanStack query result, with failures normalized to {@link SymmioRequestError}.
 *
 * @example
 * ```tsx
 * const query = useGaslessWalletAddress({ owner, walletId: 1n });
 * ```
 */
export function useGaslessWalletAddress(
  parameters: UseGaslessWalletAddressParameters,
): UseGaslessWalletAddressReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();

  const options = getGaslessWalletAddressQueryOptions(config, {
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
  }) as UseGaslessWalletAddressReturnType;
}
