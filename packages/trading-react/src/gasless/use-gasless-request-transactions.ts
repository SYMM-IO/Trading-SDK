"use client";

import {
  getGaslessRequestTransactionsQueryOptions,
  type ConfigParameter,
  type GetGaslessRequestTransactionsOptions,
  type GetGaslessRequestTransactionsReturnType,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/** Parameters for {@link useGaslessRequestTransactions}. */
export type UseGaslessRequestTransactionsParameters = GetGaslessRequestTransactionsOptions & ConfigParameter;

/** Return type of {@link useGaslessRequestTransactions}. */
export type UseGaslessRequestTransactionsReturnType = UseQueryResult<
  GetGaslessRequestTransactionsReturnType,
  SymmioRequestError
>;

/**
 * List the EVM broadcast attempts stored for one GaslessQ request.
 *
 * The companion to {@link useGaslessRequest}: the record says what the workflow
 * is doing, this says which transactions it tried. That distinction is
 * load-bearing — the relayer replaces a stuck transaction, so a request has one
 * id and possibly several hashes, and an attempt that `reverted` or `failed`
 * does not mean the request did. Read the outcome from the record; read the
 * attempts to link to an explorer or to explain a failure.
 *
 * **Polls only when you pass the record's `status`.** The attempts list has no
 * terminal of its own to stop on, so a self-driven poll would outlive the
 * workflow. Hand it the status you are already reading from `useGaslessRequest`
 * and it follows the same jittered cadence and stops when the record does;
 * leave it out and it fetches once, with `query.refetchInterval` yours to set.
 *
 * Enabled only while `requestId` is non-empty, so the hook can mount before a
 * submit has happened.
 *
 * @param parameters - Request id, the optional cadence `status`, optional service and chain id, TanStack overrides.
 * @returns The stored attempts, oldest first as the service returns them.
 *
 * @example
 * ```tsx
 * const request = useGaslessRequest({ requestId: requestId ?? "", query: { enabled: Boolean(requestId) } });
 * const attempts = useGaslessRequestTransactions({
 *   requestId: requestId ?? "",
 *   status: request.data?.status,
 *   query: { enabled: Boolean(requestId) },
 * });
 * const latest = attempts.data?.at(-1);
 * ```
 */
export function useGaslessRequestTransactions(
  parameters: UseGaslessRequestTransactionsParameters,
): UseGaslessRequestTransactionsReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();

  const options = getGaslessRequestTransactionsQueryOptions(config, {
    ...parameters,
    chainId: parameters.chainId ?? chainId,
  });

  return useQuery({
    ...options,
    enabled: (parameters.query?.enabled ?? true) && parameters.requestId.length > 0,
    queryFn: async (context) => {
      try {
        return await options.queryFn(context);
      } catch (err) {
        throw normalizeSymmError(err);
      }
    },
  }) as UseGaslessRequestTransactionsReturnType;
}
