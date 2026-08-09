"use client";

import {
  searchNotificationsQueryOptions,
  type ConfigParameter,
  type SearchNotificationsOptions,
  type SearchNotificationsReturnType,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/**
 * Parameters for {@link useSearchNotifications}: the core search options
 * (`solverId`, common filters `account` / `quoteId` / `tempQuoteId` /
 * `timestampGte`, `size`, `start`, chain id, TanStack `query` overrides) plus an
 * optional `config`.
 */
export type UseSearchNotificationsParameters = SearchNotificationsOptions & ConfigParameter;

/** Return type of {@link useSearchNotifications}: the per-kind {@link SearchNotificationsReturnType} union. */
export type UseSearchNotificationsReturnType = UseQueryResult<SearchNotificationsReturnType, SymmioRequestError>;

/**
 * Search stored notifications for a solver — one hook over both kinds, dispatched
 * by the resolved `solverId`: an **enigma** solver hits the notification service
 * (`POST /api/v1/search`), a **rasa** solver hits its own position-state
 * endpoint. `chainId` / `solverId` default to the connected chain's default
 * solver. The result is a per-kind union — narrow on `data.kind`. Errors are
 * normalized to {@link SymmioRequestError}.
 *
 * @example
 * ```tsx
 * const { data } = useSearchNotifications({ account: subAccount, quoteId: 1024 });
 * if (data?.kind === "enigma") data.rows.forEach((d) => console.log(d.id));
 * if (data?.kind === "rasa") data.rows.forEach((r) => console.log(r.quote_id));
 * ```
 */
export function useSearchNotifications(parameters: UseSearchNotificationsParameters): UseSearchNotificationsReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = searchNotificationsQueryOptions(config, {
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
  }) as UseSearchNotificationsReturnType;
}
