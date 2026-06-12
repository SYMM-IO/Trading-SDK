"use client";

import {
  getPartyAOpenPositionsQueryOptions,
  type ConfigParameter,
  type GetPartyAOpenPositionsOptions,
  type GetPartyAOpenPositionsReturnType,
} from "@symm-frontier/core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/**
 * Parameters for {@link usePartyAOpenPositions}: the core query options (partyA,
 * pagination, chain id, TanStack `query` overrides) plus an optional `config`.
 */
export type UsePartyAOpenPositionsParameters = GetPartyAOpenPositionsOptions & ConfigParameter;

/** Return type of {@link usePartyAOpenPositions}. */
export type UsePartyAOpenPositionsReturnType = UseQueryResult<GetPartyAOpenPositionsReturnType, SymmioRequestError>;

/**
 * Read a partyA's open positions (full `Quote` structs) from the SYMMIO core.
 * `partyA` is a SubAccount (Majors) or Virtual Account (VibeCaps). The query is
 * disabled until `partyA` is set. `chainId` defaults to the connected chain.
 * Errors are normalized to {@link SymmioRequestError}.
 *
 * @example
 * ```tsx
 * const { data: positions, isLoading } = usePartyAOpenPositions({ partyA: "0xva…" });
 * ```
 */
export function usePartyAOpenPositions(
  parameters: UsePartyAOpenPositionsParameters = {},
): UsePartyAOpenPositionsReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = getPartyAOpenPositionsQueryOptions(config, {
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
  }) as UsePartyAOpenPositionsReturnType;
}
