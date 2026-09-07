import type { Config } from "../core/config";

/**
 * Per-config serialization of gasless relays by `(chainId, signerAccount)`.
 *
 * InstantLayer replay nonces are sequential and read fresh immediately before
 * signing; two concurrent relays built from the same read would sign the same
 * nonce and one would be rejected in simulation. This chains each account's
 * relays behind a promise so the read-sign-submit critical section never
 * overlaps. Keyed off the `Config` object with a `WeakMap` so locks die with
 * the config.
 *
 * @internal
 */
const locks = new WeakMap<Config, Map<string, Promise<unknown>>>();

/**
 * Run `task` exclusively for one `(chainId, account)` pair. Queued tasks run
 * in FIFO order; a failed task never blocks the next one, and the map entry is
 * cleared once the last queued task settles.
 *
 * @internal
 */
export function withGaslessNonceLock<result>(
  config: Config,
  chainId: number,
  account: string,
  task: () => Promise<result>,
): Promise<result> {
  let byKey = locks.get(config);
  if (!byKey) {
    byKey = new Map();
    locks.set(config, byKey);
  }

  const key = `${chainId}:${account.toLowerCase()}`;
  const previous = byKey.get(key) ?? Promise.resolve();
  const run = previous.then(task, task);

  const settled = run.then(
    () => undefined,
    () => undefined,
  );
  byKey.set(key, settled);
  void settled.then(() => {
    if (byKey.get(key) === settled) byKey.delete(key);
  });

  return run;
}
