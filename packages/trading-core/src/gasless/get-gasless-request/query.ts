import type { Config } from "../../core/config";
import type { Compute, ConfigKeyParameter, ExactPartial } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { filterQueryOptions } from "../../shared/utils/query";
import { gaslessQueryPollDelay } from "../query-poll-delay";
import { gaslessTransientReadDelay, isTransientGaslessReadError } from "../transient-read";
import { gaslessPollDelay, isGaslessRequestTerminal } from "../types";
import {
  getGaslessRequest,
  type GetGaslessRequestParameters,
  type GetGaslessRequestReturnType,
} from "./get-gasless-request";

/** Data resolved by the {@link getGaslessRequestQueryOptions} query. */
export type GetGaslessRequestData = GetGaslessRequestReturnType;

/**
 * Build the TanStack Query key for {@link getGaslessRequestQueryOptions}.
 *
 * @param options - Partial query parameters.
 * @returns A stable, hashable query key.
 */
export function getGaslessRequestQueryKey(
  options: Compute<ExactPartial<GetGaslessRequestParameters> & ConfigKeyParameter> = {},
) {
  return ["getGaslessRequest", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getGaslessRequestQueryKey}. */
export type GetGaslessRequestQueryKey = ReturnType<typeof getGaslessRequestQueryKey>;

/**
 * Options accepted by {@link getGaslessRequestQueryOptions}: the action's
 * required read parameters, an optional chain id, and TanStack overrides.
 */
export type GetGaslessRequestOptions = Compute<
  GetGaslessRequestParameters &
    QueryParameter<GetGaslessRequestData, Error, GetGaslessRequestData, GetGaslessRequestQueryKey>
>;

/**
 * TanStack Query options returned by {@link getGaslessRequestQueryOptions}.
 *
 * Its `queryFn` takes the query context, so TanStack's own `AbortSignal`
 * reaches the HTTP call: a query that unmounts or is cancelled stops its poll
 * in flight instead of finishing into a discarded result.
 */
export type GetGaslessRequestQueryOptions = Omit<
  SymmioQueryOptions<GetGaslessRequestData, Error, GetGaslessRequestData, GetGaslessRequestQueryKey>,
  "queryFn"
> & {
  queryFn: (context?: { signal?: AbortSignal }) => Promise<GetGaslessRequestData>;
};

/**
 * Number of consecutive `404`s tolerated right after a submit: the accepted
 * workflow's record may not be readable immediately (the accept-vs-record
 * race). Mirrors the imperative wait loop's tolerance.
 */
const NOT_FOUND_RETRIES = 3;

/**
 * How many consecutive transient transport failures are absorbed before the
 * query surfaces an error.
 *
 * Generous on purpose: a `429`, a `503` or a dropped connection says nothing
 * about the workflow, which keeps running server-side, and a UI that renders
 * "failed" because a poll was throttled is what makes a user resubmit a request
 * that is already executing. Each retry waits `max(Retry-After, jittered 1 s →
 * 30 s backoff)`, so the ceiling is minutes of blindness, not a burst.
 */
const TRANSIENT_RETRIES = 8;

/**
 * Whether an error is the service's "record not readable yet" `404`.
 *
 * Duck-typed on `status` rather than an `instanceof SymmApiError` check: a
 * framework layer may normalize the error before TanStack's `retry` sees it
 * (the React hook wraps `queryFn` and rethrows a `SymmioRequestError`), and an
 * `instanceof` test would silently make this whole tolerance dead code there.
 */
function isNotFound(error: unknown): boolean {
  return (error as { status?: number } | undefined)?.status === 404;
}

/**
 * Build TanStack Query options for {@link getGaslessRequest}.
 *
 * **Polls by default.** A relay request is a workflow, not a value: fetching it
 * once answers `queued` and freezes there, which reads as a stalled UI even
 * though the relayer finished seconds later. So this factory ships the
 * service-recommended cadence — a jittered 1–2 s while `queued`, 3–5 s after
 * `submitted`, and **stop** once terminal, because a terminal record is
 * immutable and polling one forever bills the service for an answer that cannot
 * change.
 *
 * It also absorbs the two failures that are not answers: the accept-vs-record
 * `404` right after a `202` (up to three), and transient transport failures —
 * `429`, `503`, a dropped connection — which are retried with the gateway's
 * `Retry-After` when it sent one, and a jittered backoff otherwise. A definitive
 * answer (`401`, `403`, `422`, a service error code) is surfaced immediately.
 *
 * Every default is applied only where the caller supplied nothing, so
 * `query.refetchInterval` / `query.retry` / `query.staleTime` still win.
 *
 * @param config - The SDK config.
 * @param options - Query parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * // Polls to a terminal status on its own.
 * const request = useQuery(getGaslessRequestQueryOptions(config, { requestId }));
 * ```
 */
export function getGaslessRequestQueryOptions(
  config: Config,
  options: GetGaslessRequestOptions,
): GetGaslessRequestQueryOptions {
  const query = options.query;

  return {
    ...query,
    /**
     * `service` is defaulted into the key, not left to the caller: the action
     * defaults it too, so a key built without it would identify the same
     * record under a second cache entry that no writer ever seeds.
     */
    queryKey: getGaslessRequestQueryKey({
      ...options,
      service: options.service ?? "operations",
      configKey: config.getChainConfigKey(options.chainId),
    }),
    enabled: query?.enabled ?? true,
    queryFn: (context) => {
      const { chainId, requestId, service } = options;
      return getGaslessRequest(config, { chainId, requestId, service, signal: context?.signal ?? options.signal });
    },
    /**
     * The jitter is seeded from the query's own fetch timestamps rather than
     * drawn per call: TanStack restarts the countdown whenever a recomputed
     * `refetchInterval` differs from the running one, and a per-call
     * `Math.random()` would restart it on every render and never fire.
     */
    refetchInterval: query?.refetchInterval ?? ((q) => gaslessQueryPollDelay(q.state.data?.status, q.state)),
    /** A terminal record never changes, so a remount must not refetch one. */
    staleTime:
      query?.staleTime ?? ((q) => (q.state.data && isGaslessRequestTerminal(q.state.data.status) ? Infinity : 0)),
    retry:
      query?.retry ??
      ((failureCount: number, error: Error) =>
        isNotFound(error)
          ? failureCount < NOT_FOUND_RETRIES
          : isTransientGaslessReadError(error) && failureCount < TRANSIENT_RETRIES),
    retryDelay:
      query?.retryDelay ??
      ((failureCount: number, error: Error) =>
        isNotFound(error) ? (gaslessPollDelay(undefined) as number) : gaslessTransientReadDelay(failureCount, error)),
  };
}
