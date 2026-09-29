"use client";

import {
  GaslessRequestStatus,
  getGaslessRequestQueryOptions,
  type ConfigParameter,
  type GaslessStatusTransport,
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
import { useGaslessRequestStream, type GaslessStreamState } from "./use-gasless-request-stream";

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
    /**
     * How to follow the workflow. `"auto"` (default) subscribes to the
     * gateway's status stream where the deployment enables it and polls only
     * while the stream is not delivering; `"poll"` forces HTTP polling.
     */
    transport?: GaslessStatusTransport;
  };

/** Return type of {@link useGaslessRequest}. */
export type UseGaslessRequestReturnType = UseQueryResult<GetGaslessRequestReturnType, SymmioRequestError> & {
  /**
   * The live transport's health. `stream.live` means the record is arriving
   * over the WebSocket and this hook has stopped polling; anything else means
   * it is polling, which is also the whole behavior on a deployment without a
   * status stream.
   */
  stream: GaslessStreamState;
};

/**
 * Poll one GaslessQ relayer request.
 *
 * **Polls on its own.** The query factory ships the service-recommended cadence
 * — a jittered 1–2 s while `queued`, 3–5 s after `submitted`, stopping at a
 * terminal status — tolerates the brief post-`202` `404` while the record
 * becomes readable, and absorbs transient transport failures (`429`, `503`, a
 * dropped connection) with the gateway's `Retry-After` when it sent one. A
 * failed read is not a failed request, so none of that surfaces as an error.
 * Pass `query.refetchInterval` only to override the cadence.
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
  const { invalidateOnSuccess = true, transport = "auto", ...queryParameters } = parameters;

  /**
   * The stream writes straight into this hook's cache entry, so the query below
   * only has to stop polling while it is live.
   */
  const stream = useGaslessRequestStream({
    config,
    chainId: resolvedChainId,
    requestId: parameters.requestId,
    service: parameters.service,
    enabled: (parameters.query?.enabled ?? true) && parameters.requestId.length > 0,
    transport,
  });

  const options = getGaslessRequestQueryOptions(config, {
    ...queryParameters,
    chainId: resolvedChainId,
  });

  const result = useQuery({
    ...options,
    enabled: (parameters.query?.enabled ?? true) && parameters.requestId.length > 0,
    /**
     * While the stream delivers, polling stands down; an explicit
     * `query.refetchInterval` still wins, and a degraded stream resumes it.
     */
    refetchInterval: parameters.query?.refetchInterval ?? (stream.live ? false : options.refetchInterval),
    queryFn: async (context) => {
      try {
        /** Forwards TanStack's abort signal, so an unmounted poll stops in flight. */
        return await options.queryFn(context);
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

  return { ...result, stream } as UseGaslessRequestReturnType;
}
