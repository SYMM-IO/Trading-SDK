import { searchTpSlOrders, type Config } from "@symmio/trading-core";
import type { Address } from "viem";
import { applyTpSlSearchSnapshot, type TpSlWaitingSide } from "./apply-tpsl-search-snapshot";

/**
 * How long the WebSocket report gets on its own before the sweep starts, in
 * milliseconds.
 *
 * The sweep is a fallback, not a second opinion: while a report can still
 * plausibly arrive, asking the handler adds load and answers nothing the socket
 * was not about to say. A report that has not landed within this window is not
 * coming, and only then is it worth reading the handler directly.
 */
export const TPSL_FALLBACK_POLL_DELAY_MS = 30_000;

/** Default cadence of the fallback sweep once it has started, in milliseconds. */
export const TPSL_FALLBACK_POLL_INTERVAL_MS = 2_000;

/** How long one sweep may take before it counts as a failed tick. */
const REQUEST_TIMEOUT_MS = 10_000;

/** Backoff ceiling — a handler that keeps failing is polled every 30s, not every 2s. */
const MAX_BACKOFF_MS = 30_000;

/** A side the caller is waiting on, plus the account whose stream should report it. */
export interface TpSlPollWaitingSide extends TpSlWaitingSide {
  /** Virtual Account that owns the order — the handler's `party_a_address`. */
  account: Address;
}

/** Parameters for {@link startTpSlFallbackPoll}. */
export interface StartTpSlFallbackPollParameters {
  /**
   * The sides still awaiting confirmation, re-read on every tick and again
   * when a response lands. Returning an empty list stops the sweep.
   */
  getWaiting: () => readonly TpSlPollWaitingSide[];
  /** Chain override; defaults to the config's default chain. */
  chainId?: number;
  /**
   * How long to leave the report alone before the first sweep. Defaults to
   * {@link TPSL_FALLBACK_POLL_DELAY_MS}. `0` sweeps after one interval.
   */
  delayMs?: number;
  /** Tick cadence after the first sweep. Defaults to {@link TPSL_FALLBACK_POLL_INTERVAL_MS}. `0` disables. */
  intervalMs?: number;
}

/** Handle returned by {@link startTpSlFallbackPoll}. */
export interface TpSlFallbackPoll {
  /** Stop this lease. Idempotent; safe to call after the sweep already ended. */
  stop: () => void;
}

/** One account's sweep loop, shared by every lease that wants that account. */
interface Hub {
  timer: ReturnType<typeof setTimeout> | undefined;
  inFlight: boolean;
  failures: number;
  leases: Set<Lease>;
}

interface Lease {
  getWaiting: () => readonly TpSlPollWaitingSide[];
  delayMs: number;
  intervalMs: number;
  disposed: boolean;
}

/**
 * Sweep loops, scoped to a `Config` rather than to the module.
 *
 * Mirrors core's socket pool: a `WeakMap` keyed on the config means loops never
 * leak across config instances and die with the config that owns them, instead
 * of living in an app-wide singleton.
 */
const registries = new WeakMap<Config, Map<string, Hub>>();

function registryOf(config: Config): Map<string, Hub> {
  let registry = registries.get(config);
  if (!registry) {
    registry = new Map();
    registries.set(config, registry);
  }
  return registry;
}

/**
 * Poll the TP/SL handler for the orders a run is waiting on, as a fallback for
 * a WebSocket report that never arrives.
 *
 * One `POST /api/v5/search/` per distinct Virtual Account per tick — never one
 * per leg — and results are folded into the shared TP/SL store, which is what
 * both the run's waiter and every mounted cell reconcile against. Leases on the
 * same `(config, chain, account)` share one loop and one in-flight request, so
 * a set-run and a cancel-run confirming on the same account still cost one
 * request between them.
 *
 * The sweep is single-flight (a tick that finds a request in flight reschedules
 * rather than stacking), backs off exponentially on handler errors, and stops
 * as soon as `getWaiting()` comes back empty — as well as on `stop()`.
 *
 * @param config - The SDK config; also the scope the loops are registered under.
 * @param parameters - The waiting-side probe, chain override and cadence.
 * @returns A handle whose `stop()` releases this lease.
 *
 * @example
 * ```ts
 * const poll = startTpSlFallbackPoll(config, {
 *   getWaiting: () => waitingSidesOf(runRef.current.steps),
 * });
 * // later, when the run resolves:
 * poll.stop();
 * ```
 */
export function startTpSlFallbackPoll(config: Config, parameters: StartTpSlFallbackPollParameters): TpSlFallbackPoll {
  const intervalMs = parameters.intervalMs ?? TPSL_FALLBACK_POLL_INTERVAL_MS;
  if (intervalMs <= 0) return { stop: () => {} };
  const delayMs = parameters.delayMs ?? TPSL_FALLBACK_POLL_DELAY_MS;

  const lease: Lease = { getWaiting: parameters.getWaiting, delayMs, intervalMs, disposed: false };
  const registry = registryOf(config);
  /** Hubs this lease joined, so `stop()` releases exactly those. */
  const joined = new Set<string>();

  /**
   * Resolve the chain once, so a caller that passes it explicitly and one that
   * omits it land on the same hub instead of opening two loops.
   */
  let chainId: number;
  try {
    chainId = config.getChainConfig(parameters.chainId).chainId;
  } catch {
    // An unconfigured chain can never answer; there is nothing to poll.
    return { stop: () => {} };
  }

  function hubKeyFor(account: Address): string {
    return `${chainId}:${account.toLowerCase()}`;
  }

  /** The accounts this lease currently needs, deduped. */
  function accountsOf(sides: readonly TpSlPollWaitingSide[]): Map<string, Address> {
    const accounts = new Map<string, Address>();
    for (const side of sides) accounts.set(hubKeyFor(side.account), side.account);
    return accounts;
  }

  function schedule(hub: Hub, key: string, account: Address, delayMs: number): void {
    if (hub.timer !== undefined) return;
    hub.timer = setTimeout(() => {
      hub.timer = undefined;
      void tick(hub, key, account);
    }, delayMs);
  }

  function stopHub(hub: Hub, key: string): void {
    if (hub.timer !== undefined) clearTimeout(hub.timer);
    hub.timer = undefined;
    registry.delete(key);
  }

  /** The union of every live lease's waiting sides for one account. */
  function waitingFor(hub: Hub, key: string): TpSlPollWaitingSide[] {
    const sides: TpSlPollWaitingSide[] = [];
    for (const entry of hub.leases) {
      if (entry.disposed) {
        hub.leases.delete(entry);
        continue;
      }
      for (const side of entry.getWaiting()) {
        if (hubKeyFor(side.account) === key) sides.push(side);
      }
    }
    return sides;
  }

  /** The shortest cadence any live lease asked for. */
  function cadenceOf(hub: Hub): number {
    let cadence = Number.POSITIVE_INFINITY;
    for (const entry of hub.leases) {
      if (!entry.disposed) cadence = Math.min(cadence, entry.intervalMs);
    }
    return Number.isFinite(cadence) ? cadence : intervalMs;
  }

  async function tick(hub: Hub, key: string, account: Address): Promise<void> {
    if (registry.get(key) !== hub) return;
    if (hub.leases.size === 0) return stopHub(hub, key);
    if (hub.inFlight) return schedule(hub, key, account, cadenceOf(hub));

    const wanted = waitingFor(hub, key);
    if (wanted.length === 0) return stopHub(hub, key);

    hub.inFlight = true;
    try {
      const snapshot = await searchTpSlOrders(config, { account, chainId, timeoutMs: REQUEST_TIMEOUT_MS });
      hub.failures = 0;
      // Re-read the waiting set: a WebSocket frame may have settled these sides
      // while the request was in flight, and a response must never speak for a
      // side that is no longer confirming.
      applyTpSlSearchSnapshot(waitingFor(hub, key), snapshot);
    } catch {
      hub.failures += 1;
    } finally {
      hub.inFlight = false;
    }

    if (registry.get(key) !== hub) return;
    if (waitingFor(hub, key).length === 0) return stopHub(hub, key);
    const backoff = hub.failures === 0 ? cadenceOf(hub) : Math.min(cadenceOf(hub) * 2 ** hub.failures, MAX_BACKOFF_MS);
    schedule(hub, key, account, backoff);
  }

  for (const [key, account] of accountsOf(parameters.getWaiting())) {
    let hub = registry.get(key);
    if (!hub) {
      hub = { timer: undefined, inFlight: false, failures: 0, leases: new Set() };
      registry.set(key, hub);
    }
    hub.leases.add(lease);
    joined.add(key);
    /**
     * The first sweep waits out `delayMs` — the window the report owns. A hub
     * another lease already armed keeps its schedule; whichever lease got there
     * first set the clock.
     */
    schedule(hub, key, account, Math.max(lease.delayMs, lease.intervalMs));
  }

  return {
    stop: () => {
      if (lease.disposed) return;
      lease.disposed = true;
      for (const key of joined) {
        const hub = registry.get(key);
        if (!hub) continue;
        hub.leases.delete(lease);
        if (hub.leases.size === 0) stopHub(hub, key);
      }
      joined.clear();
    },
  };
}

/** Tear down every sweep loop. Intended for tests only. */
export function __resetTpSlFallbackPolls(config: Config): void {
  const registry = registries.get(config);
  if (!registry) return;
  for (const [key, hub] of registry) {
    if (hub.timer !== undefined) clearTimeout(hub.timer);
    registry.delete(key);
  }
}
