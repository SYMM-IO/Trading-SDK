"use client";

import {
  getListingConfigQueryOptions,
  type ConfigParameter,
  type GetListingConfigOptions,
  type ListingConfig,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/** Parameters for {@link useListingConfig}: the core query options plus an optional `config`. */
export type UseListingConfigParameters = GetListingConfigOptions & ConfigParameter;

/** Return type of {@link useListingConfig}: the listing service's public client config. */
export type UseListingConfigReturnType = UseQueryResult<ListingConfig, SymmioRequestError>;

/**
 * Read the listing service's **public** client configuration — the data a
 * create-pool UI must show a user before they list a token: the recommended and
 * minimum initial deposits, the listing fee, the supported deposit chains, the
 * per-day rate limits, and the protocol reward share.
 *
 * This is the public twin of {@link useAuthenticateListing}-gated reads: no
 * token, resolved from the config, so it can be mounted unconditionally. The
 * three `*Usdc` figures are `bigint` at `LISTING_VALUE_DECIMALS` (18) — descale
 * with `formatUnits` before rendering as USD. `supportedDepositChains` is the
 * source of truth for a deposit-chain picker; do not hardcode the list.
 * Enigma-only; errors are normalized to {@link SymmioRequestError}.
 *
 * @example
 * ```tsx
 * const { data, isPending } = useListingConfig();
 * const chains = data?.supportedDepositChains ?? [];
 * ```
 */
export function useListingConfig(parameters: UseListingConfigParameters = {}): UseListingConfigReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = getListingConfigQueryOptions(config, {
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
  }) as UseListingConfigReturnType;
}
