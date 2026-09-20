"use client";

import {
  getGaslessWalletNonceQueryOptions,
  type ConfigParameter,
  type GetGaslessWalletNonceOptions,
  type GetGaslessWalletNonceReturnType,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/** Parameters for {@link useGaslessWalletNonce}. */
export type UseGaslessWalletNonceParameters = GetGaslessWalletNonceOptions & ConfigParameter;

/** Return type of {@link useGaslessWalletNonce}. */
export type UseGaslessWalletNonceReturnType = UseQueryResult<GetGaslessWalletNonceReturnType, SymmioRequestError>;

/**
 * Read the GaslessLayer's wallet-operation replay nonce
 * (`walletOperationNonces(owner, walletId, signerAccount)`) — the last nonce a
 * GaslessWallet consumed for one signer account. Each `(walletId, account)` pair
 * is its own stream, separate from InstantLayer nonces.
 *
 * Use it to display a wallet's state. Do not sign from a cached value:
 * `useGaslessWalletExecute` reads the nonce itself immediately before signing,
 * and invalidates this query once the operation lands.
 *
 * @param parameters - Owner, optional `walletId` (default `0n`), signer `account`, optional chain id, config and query overrides.
 * @returns The TanStack query result, with failures normalized to {@link SymmioRequestError}.
 *
 * @example
 * ```tsx
 * const nonce = useGaslessWalletNonce({ owner, walletId: 1n, account: subAccount });
 * ```
 */
export function useGaslessWalletNonce(parameters: UseGaslessWalletNonceParameters): UseGaslessWalletNonceReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();

  const options = getGaslessWalletNonceQueryOptions(config, {
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
  }) as UseGaslessWalletNonceReturnType;
}
