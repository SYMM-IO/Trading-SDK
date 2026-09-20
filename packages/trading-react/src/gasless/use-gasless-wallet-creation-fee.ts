"use client";

import {
  getGaslessWalletCreationFeeQueryOptions,
  type ConfigParameter,
  type GetGaslessWalletCreationFeeOptions,
  type GetGaslessWalletCreationFeeReturnType,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/** Parameters for {@link useGaslessWalletCreationFee}. */
export type UseGaslessWalletCreationFeeParameters = GetGaslessWalletCreationFeeOptions & ConfigParameter;

/** Return type of {@link useGaslessWalletCreationFee}. */
export type UseGaslessWalletCreationFeeReturnType = UseQueryResult<
  GetGaslessWalletCreationFeeReturnType,
  SymmioRequestError
>;

/**
 * Read the one-time fee for deploying one of an owner's GaslessWallets
 * (`getWalletCreationFee(owner, walletId)` on the GaslessLayer), in collateral
 * token units. It is the configured fee while the wallet has no code, for any
 * wallet id including `0`, and `0n` once the wallet is deployed. A deposit
 * settlement deducts it from the swept balance; a relayed wallet operation
 * charges it to the payer's SYMMIO balance.
 *
 * The relay hooks invalidate it after a wallet execute or a deposit settlement,
 * since either may deploy the wallet.
 *
 * @param parameters - Owner, optional `walletId` (default `0n`), optional chain id, config and query overrides.
 * @returns The TanStack query result, with failures normalized to {@link SymmioRequestError}.
 *
 * @example
 * ```tsx
 * const creationFee = useGaslessWalletCreationFee({ owner, walletId: 1n });
 * const chargesFirstUse = (creationFee.data ?? 0n) > 0n;
 * ```
 */
export function useGaslessWalletCreationFee(
  parameters: UseGaslessWalletCreationFeeParameters,
): UseGaslessWalletCreationFeeReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();

  const options = getGaslessWalletCreationFeeQueryOptions(config, {
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
  }) as UseGaslessWalletCreationFeeReturnType;
}
