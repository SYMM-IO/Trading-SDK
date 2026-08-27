"use client";

import {
  getListingStatusQueryOptions,
  type ConfigParameter,
  type GetListingStatusOptions,
  type GetListingStatusReturnType,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/** Parameters for {@link useListingStatus}: the core query options plus an optional `config`. */
export type UseListingStatusParameters = GetListingStatusOptions & ConfigParameter;

/** Return type of {@link useListingStatus}: one market's listing-pipeline status. */
export type UseListingStatusReturnType = UseQueryResult<GetListingStatusReturnType, SymmioRequestError>;

/**
 * Read a market's **listing status** — its lifecycle status plus where it sits in
 * the backend's listing pipeline (current step, all steps, retry count/limit, and
 * any step error), keyed by the market's token address and deposit chain.
 *
 * A public read (no bearer token): it gates only on `tokenContractAddress` — until
 * it is a non-empty string the hook stays idle (`enabled: false`) rather than
 * firing an incomplete request, so it can be mounted before an address is entered.
 * Set `query.refetchInterval` to poll a market still moving toward `LISTED`.
 * Enigma-only; errors are normalized to {@link SymmioRequestError}.
 *
 * @example
 * ```tsx
 * const { data, isPending } = useListingStatus({
 *   tokenContractAddress: "0x1234…",
 *   depositChain: ListingDepositChainId.HYPER_EVM,
 *   query: { refetchInterval: 5000 },
 * });
 * ```
 */
export function useListingStatus(parameters: UseListingStatusParameters): UseListingStatusReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = getListingStatusQueryOptions(config, {
    ...parameters,
    chainId: parameters.chainId ?? chainId,
  });

  return useQuery({
    ...options,
    enabled: (parameters.query?.enabled ?? true) && parameters.tokenContractAddress.length > 0,
    queryFn: async () => {
      try {
        return await options.queryFn();
      } catch (err) {
        throw normalizeSymmError(err);
      }
    },
  }) as UseListingStatusReturnType;
}
