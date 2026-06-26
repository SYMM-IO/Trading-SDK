"use client";

import {
  getPartyAPendingQuotesQueryOptions,
  type ConfigParameter,
  type GetPartyAPendingQuotesOptions,
  type GetPartyAPendingQuotesReturnType,
} from "@theoldvarorg/core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/**
 * Parameters for {@link usePartyAPendingQuotes}: the core query options (partyA,
 * chain id, TanStack `query` overrides) plus an optional `config`.
 */
export type UsePartyAPendingQuotesParameters = GetPartyAPendingQuotesOptions & ConfigParameter;

/** Return type of {@link usePartyAPendingQuotes}. */
export type UsePartyAPendingQuotesReturnType = UseQueryResult<GetPartyAPendingQuotesReturnType, SymmioRequestError>;

/**
 * Read the ids of a partyA's pending quotes (`PENDING` / `LOCKED` /
 * `CANCEL_PENDING`) from the SYMMIO core. Hydrate each id with {@link useQuote}.
 * The query is disabled until `partyA` is set. `chainId` defaults to the
 * connected chain. Errors are normalized to {@link SymmioRequestError}.
 *
 * @example
 * ```tsx
 * const { data: ids } = usePartyAPendingQuotes({ partyA: "0xva…" });
 * ```
 */
export function usePartyAPendingQuotes(
  parameters: UsePartyAPendingQuotesParameters = {},
): UsePartyAPendingQuotesReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = getPartyAPendingQuotesQueryOptions(config, {
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
  }) as UsePartyAPendingQuotesReturnType;
}
