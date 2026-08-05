import type { SolverId } from "../../core/chains/types";
import type { Config } from "../../core/config";
import { assertPriceServiceProvider } from "../../price-service/assert-price-service-provider";
import { resolvePriceService } from "../../price-service/resolve-price-service";
import { SymmError } from "../../shared/errors/symm-error";
import type { Unwatch } from "../notifications/types";
import { createReconnectingSocket } from "../socket/create-reconnecting-socket";
import { getSocketPool } from "../socket/get-socket-pool";
import type { SocketStatus } from "../socket/socket-status";
import { parsePriceFrame } from "./parse-price-frame";
import type { EnigmaPriceTick } from "./types";

/**
 * Parameters for {@link watchEnigmaPrices}.
 */
export interface WatchEnigmaPricesParameters {
  /** Target chain id. Defaults to the config's `defaultChainId`. */
  chainId?: number;
  /** Solver whose price provider to resolve. Defaults to the chain's default solver. */
  solverId?: SolverId;
  /** Deliver ticks only for these market names (case-insensitive). */
  names?: readonly string[];
  /** Called for every parsed batch of price ticks. */
  onPrices: (prices: EnigmaPriceTick[]) => void;
  /** Called whenever the underlying connection status changes. */
  onStatusChange?: (status: SocketStatus) => void;
  /** Called on a transport or parse error; does not stop the subscription. */
  onError?: (error: SymmError) => void;
}

function toPricesError(event: unknown): SymmError {
  if (event instanceof SymmError) return event;
  const cause = event instanceof Error ? event : undefined;
  return new SymmError("api", "PRICES_SOCKET_ERROR", `Prices socket error${cause ? `: ${cause.message}` : "."}`, {
    cause,
  });
}

/**
 * Subscribe to the chain's Enigma lowcap price-service WebSocket.
 *
 * The endpoint is broadcast-only — there is no subscribe message; every
 * connected client receives the same price ticks. Watchers sharing the
 * same `wsUrl` share one underlying socket; it closes when the last
 * watcher unwatches.
 *
 * @param config - The SDK config.
 * @param parameters - Handlers + optional chain override.
 * @returns An unwatch function that releases this subscription.
 * @throws {SymmError} synchronously when the chain is unsupported, has no
 *   `priceService.wsUrl` configured, or no `WebSocket` implementation exists.
 *
 * @example
 * ```ts
 * const unwatch = watchEnigmaPrices(config, {
 *   onPrices: (ticks) => console.log(ticks.length, "ticks"),
 *   onStatusChange: (status) => console.log(status),
 * });
 * ```
 */
export function watchEnigmaPrices(config: Config, parameters: WatchEnigmaPricesParameters): Unwatch {
  const { chainId, solverId, names, onPrices, onStatusChange, onError } = parameters;

  const priceService = resolvePriceService(config, { chainId, solverId });
  /**
   * Without this guard, pointing an Enigma watcher at a non-Enigma feed is the
   * only *silent* failure in the price layer: the socket connects, the other
   * vendor's frames parse to nothing, `parsePriceFrame` returns an empty array,
   * and the watcher reports `status: "open"` while delivering zero ticks
   * forever. Fail as a typed config error instead.
   */
  assertPriceServiceProvider(priceService, "enigma", "watchEnigmaPrices");

  const wsUrl = priceService.wsUrl;
  if (!wsUrl) {
    throw new SymmError("config", "PRICES_WS_NOT_CONFIGURED", "Chain has no `priceService.wsUrl` configured.");
  }
  const webSocketConstructor = config.getWebSocketConstructor();

  const wanted = names?.length ? new Set(names.map((name) => name.trim().toUpperCase())) : undefined;

  const key = `${wsUrl}|prices`;

  return getSocketPool(config).acquire(
    key,
    (handlers) =>
      createReconnectingSocket({
        url: wsUrl,
        webSocketConstructor,
        getOpenMessages: () => [],
        onMessage: handlers.onMessage,
        onStatusChange: handlers.onStatusChange,
        onError: handlers.onError,
      }),
    {
      onMessage: (data) => {
        let ticks;
        try {
          ticks = parsePriceFrame(data);
        } catch (err) {
          onError?.(toPricesError(err));
          return;
        }
        if (!ticks || ticks.length === 0) return;

        const delivered = wanted ? ticks.filter((tick) => wanted.has(tick.name.toUpperCase())) : ticks;
        if (delivered.length === 0) return;

        try {
          onPrices(delivered);
        } catch (err) {
          onError?.(toPricesError(err));
        }
      },
      onStatusChange,
      onError: (event) => onError?.(toPricesError(event)),
    },
  );
}
