import type { SolverId } from "../../core/chains/types";
import type { Config } from "../../core/config";
import { resolvePriceService } from "../../price-service/resolve-price-service";
import type { MarkPriceTick } from "../../price-service/types";
import { SymmError } from "../../shared/errors/symm-error";
import type { Unwatch } from "../notifications/watch-notifications";
import type { SocketStatus } from "../socket/socket-status";
import { watchBinancePrices } from "./watch-binance-prices";
import { watchEnigmaPrices } from "./watch-enigma-prices";

/**
 * Parameters for {@link watchPrices}.
 */
export interface WatchPricesParameters {
  /** Target chain id. Defaults to the config's `defaultChainId`. */
  chainId?: number;
  /** Solver whose price provider to subscribe to. Defaults to the chain's default solver. */
  solverId?: SolverId;
  /**
   * Deliver ticks only for these market names (case-insensitive).
   *
   * Strongly recommended on Binance, whose stream pushes every listed symbol
   * once per second. Filtering is per-watcher, so watchers with different
   * filters still share one socket.
   */
  names?: readonly string[];
  /** Called for every parsed (and filtered) batch of ticks. */
  onPrices: (prices: MarkPriceTick[]) => void;
  /** Called whenever the underlying connection status changes. */
  onStatusChange?: (status: SocketStatus) => void;
  /** Called on a transport or parse error; does not stop the subscription. */
  onError?: (error: SymmError) => void;
}

/**
 * Subscribe to the live mark-price feed of whichever provider serves the
 * resolved solver (`solver.priceService ?? chain.priceService`).
 *
 * This is the provider-agnostic entry point: a positions table or trade ticket
 * subscribes once and narrows on `tick.provider` only when it wants
 * provider-specific fields.
 *
 * Opens a socket and nothing else — it never issues HTTP. For a REST fallback
 * while the socket is degraded, compose `getMarkPricesQueryOptions` gated on
 * `SocketStatus`, or use `usePrices({ restFallback })` in
 * `@symmio/trading-react`. A `watch*` that silently became an HTTP poller would
 * break its own contract: `Unwatch` would tear down two unlike resources and
 * `onStatusChange` would describe a transport the data no longer came from.
 *
 * @param config - The SDK config.
 * @param parameters - Handlers, optional chain/solver override, optional name filter.
 * @returns An unwatch function that releases this subscription.
 * @throws {SymmError} synchronously on unsupported chain, missing `wsUrl`, an
 *   unsupported provider, or no `WebSocket` implementation.
 *
 * @example
 * ```ts
 * const unwatch = watchPrices(config, {
 *   solverId: "rasa",
 *   names: ["BTCUSDT"],
 *   onPrices: (ticks) => {
 *     for (const tick of ticks) {
 *       console.log(tick.name, tick.markPrice);
 *       if (tick.provider === "binance") console.log(tick.indexPrice);
 *     }
 *   },
 * });
 * ```
 */
export function watchPrices(config: Config, parameters: WatchPricesParameters): Unwatch {
  const { chainId, solverId, names, onPrices, onStatusChange, onError } = parameters;
  const priceService = resolvePriceService(config, { chainId, solverId });

  switch (priceService.type) {
    case "enigma":
      return watchEnigmaPrices(config, {
        chainId,
        solverId,
        names,
        onPrices: (ticks) => onPrices(ticks.map((tick) => ({ ...tick, provider: "enigma" }))),
        onStatusChange,
        onError,
      });
    case "binance":
      return watchBinancePrices(config, { chainId, solverId, names, onPrices, onStatusChange, onError });
    default: {
      const unreachable: never = priceService.type;
      throw new SymmError(
        "config",
        "UNSUPPORTED_PRICE_SERVICE_TYPE",
        `No live price feed for price-service type "${unreachable}".`,
      );
    }
  }
}
