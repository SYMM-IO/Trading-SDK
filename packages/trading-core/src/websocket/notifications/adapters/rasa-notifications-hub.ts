import type { Address } from "viem";
import type { Config } from "../../../core/config";
import { createReconnectingSocket, type ReconnectingSocket } from "../../socket/create-reconnecting-socket";
import type { SocketListener } from "../../socket/socket-pool";
import type { SocketStatus } from "../../socket/socket-status";

/**
 * Build the rasa subscribe frame: the full list of SubAccount addresses this
 * socket watches. The endpoint accepts many addresses per socket, so the hub
 * always (re)sends the complete current list — correct whether the server
 * treats the frame as a replacement or as cumulative.
 */
export function buildRasaSubscribeMessage(addresses: readonly Address[]): string {
  return JSON.stringify({ address: [...addresses] });
}

/**
 * One shared rasa socket: the reconnecting connection, its fan-out listeners,
 * and the ref-counted address set the subscribe frame is built from.
 */
interface RasaNotificationsHub {
  socket: ReconnectingSocket;
  listeners: Set<SocketListener>;
  /** Watched addresses, ref-counted per checksummed form, keyed lowercase. */
  addresses: Map<string, { address: Address; count: number }>;
  status: SocketStatus;
}

/** Per-config hub registries, so connections never leak across `Config` instances. */
const hubRegistries = new WeakMap<Config, Map<string, RasaNotificationsHub>>();

/**
 * Parameters for {@link acquireRasaNotificationsSocket}.
 */
export interface AcquireRasaNotificationsSocketParameters {
  /** Rasa position-state WebSocket URL. One shared socket per URL per config. */
  url: string;
  /** SubAccount address this watcher subscribes for. */
  account: Address;
  /** This watcher's callbacks. Frames arrive unfiltered — every subscribed address's traffic. */
  listener: SocketListener;
}

/**
 * Join (or open) the shared rasa position-state socket for a URL, watching one
 * more SubAccount address.
 *
 * Unlike the channel-scoped pool sockets, the rasa endpoint multiplexes many
 * addresses on one connection: the hub keeps a single reconnecting socket per
 * (config, URL), maintains the ref-counted union of watched addresses, sends
 * the full address list on every (re)connect, and re-sends it whenever the set
 * changes while the socket is open. Every listener receives every inbound
 * frame; the caller filters by `counterparty_address` for its own account.
 *
 * @returns A release function; the socket closes when the last watcher releases.
 */
export function acquireRasaNotificationsSocket(
  config: Config,
  parameters: AcquireRasaNotificationsSocketParameters,
): () => void {
  const { url, account, listener } = parameters;

  let registry = hubRegistries.get(config);
  if (!registry) {
    registry = new Map();
    hubRegistries.set(config, registry);
  }

  let hub = registry.get(url);
  if (!hub) {
    const created: RasaNotificationsHub = {
      // assigned below; the socket may emit synchronously during creation.
      socket: undefined as unknown as ReconnectingSocket,
      listeners: new Set<SocketListener>(),
      addresses: new Map(),
      status: "connecting",
    };
    registry.set(url, created);
    created.socket = createReconnectingSocket({
      url,
      webSocketConstructor: config.getWebSocketConstructor(),
      // Reads the live address set, so every reconnect re-subscribes to
      // exactly the addresses watched at that moment.
      getOpenMessages: () => [buildRasaSubscribeMessage([...created.addresses.values()].map((e) => e.address))],
      onMessage: (data) => created.listeners.forEach((l) => l.onMessage?.(data)),
      onStatusChange: (status) => {
        created.status = status;
        created.listeners.forEach((l) => l.onStatusChange?.(status));
      },
      onError: (event) => created.listeners.forEach((l) => l.onError?.(event)),
    });
    hub = created;
  }

  const currentHub = hub;
  const currentRegistry = registry;
  currentHub.listeners.add(listener);
  // Sync the late joiner to the current status.
  listener.onStatusChange?.(currentHub.status);

  const addressKey = account.toLowerCase();
  const entry = currentHub.addresses.get(addressKey);
  if (entry) {
    entry.count += 1;
  } else {
    currentHub.addresses.set(addressKey, { address: account, count: 1 });
    // A new address joined an already-open socket: re-send the full list now.
    // While connecting/reconnecting, `getOpenMessages` covers it on open.
    resendSubscribeIfOpen(currentHub);
  }

  let released = false;
  return () => {
    if (released) return;
    released = true;
    currentHub.listeners.delete(listener);

    const current = currentHub.addresses.get(addressKey);
    if (current) {
      current.count -= 1;
      if (current.count === 0) {
        currentHub.addresses.delete(addressKey);
        // Tell the server the shrunk list (a replacement-semantics server
        // unsubscribes; a cumulative one just keeps sending frames the
        // remaining watchers ignore).
        resendSubscribeIfOpen(currentHub);
      }
    }

    if (currentHub.listeners.size === 0) {
      currentHub.socket.close();
      currentRegistry.delete(url);
    }
  };
}

/** Re-send the current full address list when the socket is open right now. */
function resendSubscribeIfOpen(hub: RasaNotificationsHub): void {
  if (hub.socket === undefined || hub.socket.getStatus() !== "open") return;
  hub.socket.send(buildRasaSubscribeMessage([...hub.addresses.values()].map((e) => e.address)));
}
