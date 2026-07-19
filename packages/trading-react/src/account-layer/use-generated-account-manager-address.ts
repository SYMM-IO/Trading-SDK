"use client";

import {
  generateAccountManagerAddressQueryOptions,
  type ConfigParameter,
  type GenerateAccountManagerAddressOptions,
  type GenerateAccountManagerAddressReturnType,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/**
 * Parameters for {@link useGeneratedAccountManagerAddress}: the core query
 * options (registrant, name, chain id, TanStack `query` overrides) plus an
 * optional `config`.
 */
export type UseGeneratedAccountManagerAddressParameters = GenerateAccountManagerAddressOptions & ConfigParameter;

/** Return type of {@link useGeneratedAccountManagerAddress}. */
export type UseGeneratedAccountManagerAddressReturnType = UseQueryResult<
  GenerateAccountManagerAddressReturnType,
  SymmioRequestError
>;

/**
 * Predict the deterministic affiliate (`AccountManager`) address for a
 * `(registrant, name)` pair — the address `requestToRegisterAffiliate` would
 * assign. The query is disabled until both `registrant` and `name` are set, so
 * it can drive a live preview as the user types a name. `chainId` defaults to the
 * connected chain. Errors are normalized to {@link SymmioRequestError}.
 *
 * @example
 * ```tsx
 * const { data: predicted } = useGeneratedAccountManagerAddress({ registrant, name });
 * ```
 */
export function useGeneratedAccountManagerAddress(
  parameters: UseGeneratedAccountManagerAddressParameters = {},
): UseGeneratedAccountManagerAddressReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = generateAccountManagerAddressQueryOptions(config, {
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
  }) as UseGeneratedAccountManagerAddressReturnType;
}
