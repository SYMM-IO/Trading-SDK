import type { Config } from "../../core/config";
import { createSocketPool, type SocketPool } from "./socket-pool";

/** Per-config socket pools, so connections never leak across `Config` instances. */
const pools = new WeakMap<Config, SocketPool>();

/**
 * Return the shared {@link SocketPool} bound to a {@link Config}. Lazily
 * created on first call and reused across every WebSocket watcher
 * (notifications, TP/SL, prices) so a given URL is opened once and shared.
 *
 * Pools are keyed by `Config` identity via a {@link WeakMap}, so swapping
 * configs (tests, multi-chain hosts) gets a fresh pool instead of leaking
 * sockets between unrelated SDK instances.
 */
export function getSocketPool(config: Config): SocketPool {
  let pool = pools.get(config);
  if (!pool) {
    pool = createSocketPool();
    pools.set(config, pool);
  }
  return pool;
}
