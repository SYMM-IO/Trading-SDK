import type { ReconnectingSocket } from "./create-reconnecting-socket";
import type { SocketStatus } from "./socket-status";

/**
 * The fan-out handlers a {@link SocketPool} wires into the shared socket. The
 * pool forwards each underlying event to every current listener.
 */
export interface PooledSocketHandlers {
  onMessage: (data: unknown) => void;
  onStatusChange: (status: SocketStatus) => void;
  onError: (event: unknown) => void;
}

/**
 * One subscriber's callbacks. All optional — subscribe only to what you need.
 */
export interface SocketListener {
  onMessage?: (data: unknown) => void;
  onStatusChange?: (status: SocketStatus) => void;
  onError?: (event: unknown) => void;
}

/**
 * A ref-counted registry that shares one {@link ReconnectingSocket} across many
 * listeners keyed by a stable string (e.g. `endpoint|account`).
 */
export interface SocketPool {
  /**
   * Join (or open) the socket for `key`. The first listener creates the socket
   * via `createSocket`; later listeners reuse it. Returns a `release` function;
   * the socket closes when the last listener releases.
   *
   * @param key - Stable identity for the shared connection.
   * @param createSocket - Builds the socket given the pool's fan-out handlers. Called once per key.
   * @param listener - This subscriber's callbacks. `onStatusChange` fires immediately with the current status.
   */
  acquire(
    key: string,
    createSocket: (handlers: PooledSocketHandlers) => ReconnectingSocket,
    listener: SocketListener,
  ): () => void;
}

interface SocketHub {
  socket: ReconnectingSocket;
  listeners: Set<SocketListener>;
  status: SocketStatus;
}

/**
 * Create a {@link SocketPool}. Each pool owns its own set of shared sockets;
 * scope one per `Config` so connections never leak across configs.
 */
export function createSocketPool(): SocketPool {
  const hubs = new Map<string, SocketHub>();

  return {
    acquire(key, createSocket, listener) {
      let hub = hubs.get(key);

      if (!hub) {
        const created: SocketHub = {
          // assigned below; the socket may emit synchronously during creation.
          socket: undefined as unknown as ReconnectingSocket,
          listeners: new Set<SocketListener>(),
          status: "connecting",
        };
        hubs.set(key, created);
        created.socket = createSocket({
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
      currentHub.listeners.add(listener);
      // Sync the late joiner to the current status.
      listener.onStatusChange?.(currentHub.status);

      let released = false;
      return () => {
        if (released) return;
        released = true;
        currentHub.listeners.delete(listener);
        if (currentHub.listeners.size === 0) {
          currentHub.socket.close();
          hubs.delete(key);
        }
      };
    },
  };
}
