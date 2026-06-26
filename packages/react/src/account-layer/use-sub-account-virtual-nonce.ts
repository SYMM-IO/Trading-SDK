"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import {
  getSubAccountVirtualNonceQueryOptions,
  type ConfigParameter,
  type GetSubAccountVirtualNonceOptions,
  type GetSubAccountVirtualNonceReturnType,
} from "@theoldvarorg/core";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/**
 * Parameters for {@link useSubAccountVirtualNonce}: the core query options
 * (subAccount, chain id, TanStack `query` overrides) plus an optional `config`.
 */
export type UseSubAccountVirtualNonceParameters = GetSubAccountVirtualNonceOptions & ConfigParameter;

/** Return type of {@link useSubAccountVirtualNonce}. */
export type UseSubAccountVirtualNonceReturnType = UseQueryResult<
  GetSubAccountVirtualNonceReturnType,
  SymmioRequestError
>;

/**
 * Read a subaccount's Virtual Account (VA) nonce — the per-subaccount counter
 * seeding deterministic VA address derivation. The query is disabled until
 * `subAccount` is set. `chainId` defaults to the connected chain. Errors are
 * normalized to {@link SymmioRequestError}.
 *
 * @example
 * ```tsx
 * const { data: nonce } = useSubAccountVirtualNonce({ subAccount: "0xsub…" });
 * ```
 */
export function useSubAccountVirtualNonce(
  parameters: UseSubAccountVirtualNonceParameters = {},
): UseSubAccountVirtualNonceReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = getSubAccountVirtualNonceQueryOptions(config, {
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
  }) as UseSubAccountVirtualNonceReturnType;
}
