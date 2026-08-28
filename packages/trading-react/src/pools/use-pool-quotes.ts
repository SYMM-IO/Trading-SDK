"use client";

import {
  getPoolQuotesQueryOptions,
  type ConfigParameter,
  type GetPoolQuotesOptions,
  type GetPoolQuotesReturnType,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/** Parameters for {@link usePoolQuotes}: the core query options plus an optional `config`. */
export type UsePoolQuotesParameters = GetPoolQuotesOptions & ConfigParameter;

/** Return type of {@link usePoolQuotes}: the pool's quote rows. */
export type UsePoolQuotesReturnType = UseQueryResult<GetPoolQuotesReturnType, SymmioRequestError>;

/**
 * Read a **pool's** quote book from the analytics subgraph.
 *
 * This is the pool's whole book — every trader's quotes on that market, so
 * `partyA` varies row to row. That is what makes it different from the
 * account-scoped quote hooks, and why it needs no wallet connection.
 *
 * Which rows you get is the `quoteStatuses` filter: `POOL_PENDING_QUOTE_STATUSES`
 * (the default) for an "open quotes" tab, `POOL_OPEN_QUOTE_STATUSES` for live
 * positions. The query stays idle while `symbolId` is absent, since an unlisted
 * pool has no book. Errors are normalized to {@link SymmioRequestError}.
 *
 * @example
 * ```tsx
 * const { data } = usePoolQuotes({ symbolId, quoteStatuses: POOL_OPEN_QUOTE_STATUSES });
 * ```
 */
export function usePoolQuotes(parameters: UsePoolQuotesParameters): UsePoolQuotesReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = getPoolQuotesQueryOptions(config, {
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
  }) as UsePoolQuotesReturnType;
}
