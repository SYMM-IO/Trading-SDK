import type { Config } from "../../core/config";
import type { Compute, ConfigKeyParameter, ExactPartial } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { filterQueryOptions } from "../../shared/utils/query";
import { gaslessQueryPollDelay } from "../query-poll-delay";
import { gaslessTransientReadDelay, isTransientGaslessReadError } from "../transient-read";
import type { GaslessRequestStatus } from "../types";
import {
  getGaslessRequestTransactions,
  type GetGaslessRequestTransactionsParameters,
  type GetGaslessRequestTransactionsReturnType,
} from "./get-gasless-request-transactions";

/** Data resolved by the {@link getGaslessRequestTransactionsQueryOptions} query. */
export type GetGaslessRequestTransactionsData = GetGaslessRequestTransactionsReturnType;

/**
 * Build the TanStack Query key for {@link getGaslessRequestTransactionsQueryOptions}.
 *
 * @param options - Partial query parameters.
 * @returns A stable, hashable query key.
 */
export function getGaslessRequestTransactionsQueryKey(
  options: Compute<ExactPartial<GetGaslessRequestTransactionsParameters> & ConfigKeyParameter> = {},
) {
  return ["getGaslessRequestTransactions", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getGaslessRequestTransactionsQueryKey}. */
export type GetGaslessRequestTransactionsQueryKey = ReturnType<typeof getGaslessRequestTransactionsQueryKey>;

/**
 * Options accepted by {@link getGaslessRequestTransactionsQueryOptions}.
 */
export type GetGaslessRequestTransactionsOptions = Compute<
  GetGaslessRequestTransactionsParameters & {
    /**
     * The record's last known status, used **only** to drive the poll cadence:
     * the attempts list carries nothing that says when the workflow is over, so
     * without it this query has no stopping condition and does not poll at all.
     *
     * Pass the status you are already reading (`useGaslessRequest(...).data?.status`
     * or `getGaslessRequest`) and the list follows the record's jittered
     * cadence — 1–2 s while `queued`, 3–5 s after `submitted` — and stops on a
     * terminal status, whose attempts are final.
     *
     * It is deliberately not part of the query key: the attempts of one request
     * are one cache entry, not one per status.
     */
    status?: GaslessRequestStatus;
  } & QueryParameter<
      GetGaslessRequestTransactionsData,
      Error,
      GetGaslessRequestTransactionsData,
      GetGaslessRequestTransactionsQueryKey
    >
>;

/**
 * TanStack Query options returned by
 * {@link getGaslessRequestTransactionsQueryOptions}. Its `queryFn` takes the
 * query context, so TanStack's `AbortSignal` cancels the read in flight.
 */
export type GetGaslessRequestTransactionsQueryOptions = Omit<
  SymmioQueryOptions<
    GetGaslessRequestTransactionsData,
    Error,
    GetGaslessRequestTransactionsData,
    GetGaslessRequestTransactionsQueryKey
  >,
  "queryFn"
> & {
  queryFn: (context?: { signal?: AbortSignal }) => Promise<GetGaslessRequestTransactionsData>;
};

/** How many consecutive transient transport failures are absorbed before the query surfaces an error. */
const TRANSIENT_RETRIES = 8;

/**
 * Build TanStack Query options for {@link getGaslessRequestTransactions}.
 *
 * **Polls only when you hand it the record's `status`.** The attempts list has
 * no stopping condition of its own — an attempt that `reverted` may be followed
 * by another one, and a request with no attempt yet looks exactly like a request
 * that will never get one — so a self-driven poll here would keep billing the
 * service long after the workflow ended. Given `status` it follows the record's
 * jittered cadence and stops at a terminal status; without it it fetches once,
 * and `query.refetchInterval` is yours to set.
 *
 * Transient transport failures (`429`, `503`, a dropped connection) are retried
 * with the gateway's `Retry-After` when it sent one and a jittered backoff
 * otherwise; a definitive answer is surfaced immediately.
 *
 * @param config - The SDK config.
 * @param options - Query parameters, the optional cadence `status`, and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * const request = useQuery(getGaslessRequestQueryOptions(config, { requestId }));
 * // Follows the record: same cadence, stops when it does.
 * const attempts = useQuery(
 *   getGaslessRequestTransactionsQueryOptions(config, { requestId, status: request.data?.status }),
 * );
 * ```
 */
export function getGaslessRequestTransactionsQueryOptions(
  config: Config,
  options: GetGaslessRequestTransactionsOptions,
): GetGaslessRequestTransactionsQueryOptions {
  const query = options.query;
  /** Cadence input, never cache identity — see the field's docs. */
  const { status, ...keyOptions } = options;

  return {
    ...query,
    /**
     * `service` is defaulted into the key exactly as the record's factory does
     * it: the action defaults it too, so a key built without it would address
     * the same attempts under a second cache entry.
     */
    queryKey: getGaslessRequestTransactionsQueryKey({
      ...keyOptions,
      service: options.service ?? "operations",
      configKey: config.getChainConfigKey(options.chainId),
    }),
    enabled: query?.enabled ?? true,
    /**
     * Seeded from the query's fetch timestamps, not drawn per call: TanStack
     * restarts the countdown whenever a recomputed `refetchInterval` differs
     * from the running one, so a per-call random delay never fires.
     */
    refetchInterval:
      query?.refetchInterval ?? (status === undefined ? false : (q) => gaslessQueryPollDelay(status, q.state)),
    queryFn: (context) => {
      const { chainId, requestId, service } = options;
      return getGaslessRequestTransactions(config, {
        chainId,
        requestId,
        service,
        signal: context?.signal ?? options.signal,
      });
    },
    retry:
      query?.retry ??
      ((failureCount: number, error: Error) => isTransientGaslessReadError(error) && failureCount < TRANSIENT_RETRIES),
    retryDelay:
      query?.retryDelay ?? ((failureCount: number, error: Error) => gaslessTransientReadDelay(failureCount, error)),
  };
}
