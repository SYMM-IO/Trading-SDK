import type { Config } from "../../core/config";
import { resolveGaslessService } from "../../gasless/resolve-gasless";
import { isGaslessRequestTerminal, type GaslessService } from "../../gasless/types";
import type { SymmError } from "../../shared/errors/symm-error";
import type { ChainIdParameter, Compute } from "../../shared/types/properties";
import { acquireGaslessStreamSelector, releaseGaslessStreamSelector } from "./gasless-stream-hub";
import { canResolveGaslessStreamUrl, resolveGaslessStreamUrl } from "./resolve-gasless-stream-url";
import type { GaslessRequestStreamUpdate, GaslessStreamStatus, GaslessStreamStatusDetail } from "./types";

/**
 * Parameters for {@link watchGaslessRequest}.
 */
export type WatchGaslessRequestParameters = Compute<
  ChainIdParameter & {
    /** Stable service id returned by a gasless submit. */
    requestId: string;
    /** Which service stores the workflow. Defaults to `"operations"`. */
    service?: GaslessService;
    /** Called with the subscribe snapshot and every later change; both carry complete state. */
    onUpdate: (update: GaslessRequestStreamUpdate) => void;
    /** Called whenever the stream's health changes, so a caller can poll while it is not `live`. */
    onStatusChange?: (status: GaslessStreamStatus, detail: GaslessStreamStatusDetail | null) => void;
    /** Called on a stream-level error; the subscription stays and the caller keeps polling. */
    onError?: (error: SymmError) => void;
  }
>;

/** Releases a {@link watchGaslessRequest} subscription. */
export type UnwatchGaslessRequest = () => void;

/**
 * Subscribe to one relayer workflow's live status.
 *
 * **Opens a socket and nothing else — it never issues HTTP.** The gateway's
 * status stream is optional and off unless a deployment declares
 * `gasless.statusStream.enabled`, so a caller pairs this with
 * `getGaslessRequestQueryOptions` (or `useGaslessRequest`, which does it for
 * you) and polls while `onStatusChange` reports anything but `"live"`. A
 * `watch*` that silently became an HTTP poller would break its own contract:
 * `Unwatch` would tear down two unlike resources and `onStatusChange` would
 * describe a transport the data no longer came from.
 *
 * One socket per `(config, service, instance)` is shared by every watcher, its
 * subscriptions are replayed after each reconnect, and a terminal workflow
 * status unsubscribes itself.
 *
 * @param config - The SDK config.
 * @param parameters - Request id, optional chain/service override, handlers.
 * @returns An unwatch function that releases this subscription.
 * @throws {SymmError} synchronously when the chain has no gasless block, the
 *   stream is not enabled, or the endpoint cannot be derived
 *   (`GASLESS_STREAM_NOT_CONFIGURED`, `GASLESS_STREAM_ORIGIN_REQUIRED`,
 *   `GASLESS_STREAM_ORIGIN_CONFLICT`, plus the url/config errors).
 *
 * @example
 * ```ts
 * const unwatch = watchGaslessRequest(config, {
 *   requestId,
 *   onUpdate: ({ request }) => render(request),
 *   onStatusChange: (status) => setPolling(status !== "live"),
 * });
 * ```
 */
export function watchGaslessRequest(config: Config, parameters: WatchGaslessRequestParameters): UnwatchGaslessRequest {
  const { chainId, requestId, service = "operations", onUpdate, onStatusChange, onError } = parameters;
  const chain = config.getChainConfig(chainId);
  const gasless = resolveGaslessService(config, { chainId });
  const endpoint = resolveGaslessStreamUrl(chain.chainId, gasless, service);
  const selector = { kind: "request", requestId } as const;

  return acquireGaslessStreamSelector(config, {
    endpoint,
    selector,
    listener: {
      onUpdate: (update) => {
        /** A terminal record ends the subscription: the gateway sends nothing more. */
        if (update.request && isGaslessRequestTerminal(update.request.status)) {
          releaseGaslessStreamSelector(config, endpoint.url, selector);
        }
        onUpdate(update);
      },
      onStatusChange,
      onError,
    },
  });
}

/**
 * Whether `(chain, service)` can be streamed at all.
 *
 * Non-throwing: a consumer asks before subscribing and falls back to polling
 * when the answer is `false` — an un-upgraded deployment, a proxy without a
 * declared gateway origin, or simply a deployment whose operators have not
 * enabled status WebSockets yet.
 *
 * @param config - The SDK config.
 * @param parameters - Optional chain and service override.
 * @returns `true` when {@link watchGaslessRequest} would resolve an endpoint.
 */
export function supportsGaslessStatusStream(
  config: Config,
  parameters: Compute<ChainIdParameter & { service?: GaslessService }> = {},
): boolean {
  const { chainId, service = "operations" } = parameters;
  try {
    const chain = config.getChainConfig(chainId);
    const gasless = resolveGaslessService(config, { chainId });
    return canResolveGaslessStreamUrl(chain.chainId, gasless, service);
  } catch {
    return false;
  }
}
