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
 * (`filter`, `size`, `start`, chain id, TanStack `query` overrides) plus an
 * optional `config`.
 */
export type UseSearchNotificationsParameters = SearchNotificationsOptions & ConfigParameter;

/** Return type of {@link useSearchNotifications}. */
export type UseSearchNotificationsReturnType = UseQueryResult<SearchNotificationsReturnType, SymmioRequestError>;

/**
 * Search stored notifications via the notification service's free-form
 * `POST /api/v1/search` endpoint. The `filter` matches keys exactly — top-level
 * fields (`app_name`, …) or dotted payload paths (`data.temp_quote_id`, …).
 *
 * The query is disabled until `filter` has at least one key. `chainId` defaults
 * to the connected chain. Errors are normalized to {@link SymmioRequestError}.
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useSearchNotifications({
 *   filter: { app_name: "Base_Superflow_Stage", "data.temp_quote_id": -172 },
 * });
 * data?.documents.forEach((d) => console.log(d.id));
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
