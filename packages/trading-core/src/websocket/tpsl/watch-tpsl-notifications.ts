import type { Address } from "viem";
import type { Config } from "../../core/config";
import { SymmError } from "../../shared/errors/symm-error";
import { resolveTpSlConfig } from "../../tpsl/internal/resolve-tpsl-config";
import { buildSubscribeMessage } from "../notifications/build-subscribe-message";
import { createReconnectingSocket } from "../socket/create-reconnecting-socket";
import { getSocketPool } from "../socket/get-socket-pool";
import type { SocketStatus } from "../socket/socket-status";
import { parseTpSlFrame } from "./parse-tpsl-frame";
import type { TpSlNotification } from "./types";

/** Idempotent disposer returned by {@link watchTpSlNotifications}. */
export type UnwatchTpSl = () => void;

/**
 * Parameters for {@link watchTpSlNotifications}.
 */
export interface WatchTpSlNotificationsParameters {
  /** SubAccount address to subscribe for. */
  account: Address;
  /** Target chain id. Defaults to the config's `defaultChainId`. */
  chainId?: number;
  /** Called for every normalized TP/SL report. */
  onNotification: (notification: TpSlNotification) => void;
  /** Connection status changes. */
  onStatusChange?: (status: SocketStatus) => void;
  /** Transport / parse errors; does not stop the subscription. */
  onError?: (error: SymmError) => void;
}

function toTpSlError(event: unknown): SymmError {
  if (event instanceof SymmError) return event;
  const cause = event instanceof Error ? event : undefined;
  return new SymmError("api", "TPSL_SOCKET_ERROR", `TP/SL socket error${cause ? `: ${cause.message}` : "."}`, {
    cause,
  });
}

/**
 * Subscribe to live TP/SL notifications for an account. Reuses the
 * defilytics-protocol subscribe-frame builder and the SDK's socket pool, so
 * many watchers across the app share one underlying connection per
 * `(wsUrl, appName, account)` triple. Scoped by `tpsl.appName` (e.g.
 * `Hyper-EVM_COH-Low-Cap_Production`), distinct from the quote-state
 * notifications stream.
 *
 * @throws {SymmError} synchronously when the chain has no `tpsl` config or no
 *   WebSocket implementation is available.
 */
export function watchTpSlNotifications(config: Config, parameters: WatchTpSlNotificationsParameters): UnwatchTpSl {
  const { account, chainId, onNotification, onStatusChange, onError } = parameters;
  const tpsl = resolveTpSlConfig(config, chainId);
  const webSocketConstructor = config.getWebSocketConstructor();

  // Defilytics protocol with the TP/SL appName as the channel.
  const subscribeMessage = buildSubscribeMessage({ account, channel: tpsl.appName, protocol: "defilytics" });

  const key = `${tpsl.wsUrl}|${tpsl.appName}|${account.toLowerCase()}`;

  return getSocketPool(config).acquire(
    key,
    (handlers) =>
      createReconnectingSocket({
        url: tpsl.wsUrl,
        webSocketConstructor,
        getOpenMessages: () => [subscribeMessage],
        onMessage: handlers.onMessage,
        onStatusChange: handlers.onStatusChange,
        onError: handlers.onError,
      }),
    {
      onMessage: (data) => {
        try {
          const parsed = parseTpSlFrame(data);
          if (!parsed) return;
          onNotification(parsed);
        } catch (err) {
          onError?.(toTpSlError(err));
        }
      },
      onStatusChange,
      onError: (event) => onError?.(toTpSlError(event)),
    },
  );
}
