"use client";

import {
  getVirtualAccountQueryOptions,
  type ConfigParameter,
  type GetVirtualAccountOptions,
  type GetVirtualAccountReturnType,
} from "@theoldvarorg/core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/**
 * Parameters for {@link useVirtualAccount}: the core query options
 * (`account`, chain id, TanStack `query` overrides) plus an optional `config`.
 */
export type UseVirtualAccountParameters = GetVirtualAccountOptions & ConfigParameter;

/** Return type of {@link useVirtualAccount}. */
export type UseVirtualAccountReturnType = UseQueryResult<GetVirtualAccountReturnType, SymmioRequestError>;

/**
 * Read a Virtual Account's on-chain detail (parent subaccount, market
 * `symbolId`, isolation type, metadata). The mapping is fixed at VA creation
 * and never changes, so the default `staleTime` is `Infinity` — the query
 * fires once per VA per session and is never refetched. The caller can
 * override `query.staleTime` to opt back into refresh behavior.
 *
 * Use it to derive a VA's `(market, side)`:
 * - `data.symbolId` → market id.
 * - `data.isolationType === MARKET_LONG` (`2`) → LONG-only VA.
 * - `data.isolationType === MARKET_SHORT` (`3`) → SHORT-only VA.
 * - `data.isolationType === MARKET` (`1`) → shared VA, both sides.
 * - `data.isolationType === POSITION` (`0`) → per-quote VA.
 *
 * The query is disabled until `account` is set. Errors are normalized to
 * {@link SymmioRequestError}.
 *
 * @example
 * ```tsx
 * const { data } = useVirtualAccount({ account: vaAddress });
 * // data?.symbolId, data?.isolationType
 * ```
 */
export function useVirtualAccount(parameters: UseVirtualAccountParameters = {}): UseVirtualAccountReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = getVirtualAccountQueryOptions(config, {
    ...parameters,
    chainId: parameters.chainId ?? chainId,
    query: {
      // Fixed-at-creation data — never stale.
      staleTime: Infinity,
      gcTime: Infinity,
      ...parameters.query,
    },
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
  }) as UseVirtualAccountReturnType;
}
