"use client";

import {
  searchTpSlOrdersQueryOptions,
  type ConfigParameter,
  type SearchTpSlOrdersOptions,
  type SearchTpSlOrdersReturnType,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/** Parameters for {@link useSearchTpSlOrders}: the core query options plus an optional `config`. */
export type UseSearchTpSlOrdersParameters = SearchTpSlOrdersOptions & ConfigParameter;

/** Return type of {@link useSearchTpSlOrders}: one page of conditional-order rows. */
export type UseSearchTpSlOrdersReturnType = UseQueryResult<SearchTpSlOrdersReturnType, SymmioRequestError>;

/**
 * Search conditional orders at the chain's TP/SL handler.
 *
 * Every filter is optional, including `account`. Pass one to read a single
 * account's TP/SL legs; **omit it** to read across accounts — which is how a
 * pool's order book is read: filter by `symbolId` and
 * `conditionalOrderType: "send_quote"` and you get every trader's pending
 * trigger-to-open orders on that market.
 *
 * `isComplete` is the field to trust when deciding whether an absent order is
 * really gone; `count` is advisory. Errors are normalized to
 * {@link SymmioRequestError}.
 *
 * @example
 * ```tsx
 * const { data } = useSearchTpSlOrders({
 *   symbolId,
 *   conditionalOrderType: ConditionalOrderType.send_quote,
 * });
 * ```
 */
export function useSearchTpSlOrders(parameters: UseSearchTpSlOrdersParameters = {}): UseSearchTpSlOrdersReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = searchTpSlOrdersQueryOptions(config, {
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
  }) as UseSearchTpSlOrdersReturnType;
}
