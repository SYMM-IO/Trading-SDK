"use client";

import {
  GaslessRequestStatus,
  getGaslessRequestQueryOptions,
  type ConfigParameter,
  type GetGaslessRequestOptions,
  type GetGaslessRequestReturnType,
} from "@symmio/trading-core";
import { useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";
import { invalidateAccountBalances } from "../utils/invalidate-account-balances";

/** Parameters for {@link useGaslessRequest}. */
export type UseGaslessRequestParameters = GetGaslessRequestOptions &
  ConfigParameter & {
    /**
     * Invalidate account-balance reads once the request transitions to
     * `succeeded` (a relayed operation moved collateral: the action itself
     * and/or its operational fee). Default `true`. Flow-specific reads are the
     * submitting hook's job — this covers the balance staleness every gasless
     * success implies.
     */
    invalidateOnSuccess?: boolean;
  };

/** Return type of {@link useGaslessRequest}. */
export type UseGaslessRequestReturnType = UseQueryResult<GetGaslessRequestReturnType, SymmioRequestError>;

/**
 * Poll one GaslessQ relayer request.
 *
 * **Polls on its own.** The query factory ships the service-recommended cadence
 * — 1.5 s while `queued`, 3 s after `submitted`, stopping at a terminal status
 * — and tolerates the brief post-`202` `404` while the record becomes readable.
 * Pass `query.refetchInterval` only to override that.
 *
 * Enabled only while `requestId` is non-empty, so the hook can mount before a
 * submit has happened. `submitted` is **not** success; only `succeeded` is.
 *
 * On a `succeeded` terminal it invalidates account balances (every relayed
 * action moves collateral); pass `invalidateOnSuccess: false` to opt out. Reads
 * specific to the action belong to the hook that submitted it.
 *
 * @example
 * ```tsx
 * const request = useGaslessRequest({ requestId: requestId ?? "", query: { enabled: Boolean(requestId) } });
 * ```
 */
export function useGaslessRequest(parameters: UseGaslessRequestParameters): UseGaslessRequestReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const queryClient = useQueryClient();
  const resolvedChainId = parameters.chainId ?? chainId;
  /**
   * Strip the hook-only control flag before forwarding: the key factory hashes
   * whatever it is handed, so leaving it in would make two callers watching the
   * same request with different flags key on separate cache entries and poll
   * the record twice.
   */
  const { invalidateOnSuccess = true, ...queryParameters } = parameters;

  const options = getGaslessRequestQueryOptions(config, {
    ...queryParameters,
    chainId: resolvedChainId,
  });

  const result = useQuery({
    ...options,
    enabled: (parameters.query?.enabled ?? true) && parameters.requestId.length > 0,
    queryFn: async () => {
      try {
        return await options.queryFn();
      } catch (err) {
        throw normalizeSymmError(err);
      }
    },
  }) as UseGaslessRequestReturnType;

  /**
   * Invalidate balances exactly once per request id on the transition into
   * `succeeded` — after on-chain reality, per the invalidation timing rule.
   */
  const invalidatedForRef = useRef<string | null>(null);
  const status = result.data?.status;
  useEffect(() => {
    if (!invalidateOnSuccess || status !== GaslessRequestStatus.SUCCEEDED) return;
    if (invalidatedForRef.current === parameters.requestId) return;
    invalidatedForRef.current = parameters.requestId;
    invalidateAccountBalances(queryClient, { configKey: config.getChainConfigKey(resolvedChainId) });
  }, [invalidateOnSuccess, status, parameters.requestId, queryClient, config, resolvedChainId]);

  return result;
}
