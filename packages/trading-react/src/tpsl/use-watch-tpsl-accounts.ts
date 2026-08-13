"use client";

import { watchTpSlNotifications, type ConfigParameter, type TpSlNotification } from "@symmio/trading-core";
import { useEffect, useRef } from "react";
import type { Address } from "viem";
import { useSymmioConfig } from "../provider/use-symmio-config";
import { linkTpSlNotificationIds, matchTpSlNotification } from "./match-tpsl-notification";
import { useTpSlStore } from "./tpsl-store";

/** Parameters for {@link useWatchTpSlAccounts}. */
export interface UseWatchTpSlAccountsParameters extends ConfigParameter {
  /** Accounts to subscribe to. A grouped position can span Virtual Accounts. */
  accounts: readonly Address[];
  /** Quote ids an incoming frame may belong to; read live inside the handler. */
  ids: readonly (bigint | undefined)[];
  /** Target chain id. Defaults to the config's default chain. */
  chainId?: number;
  /** Subscribe only when `true`. Default `true`. */
  enabled?: boolean;
}

/**
 * Subscribe to the TP/SL stream of several accounts at once and fold every
 * matching frame into the shared TP/SL store.
 *
 * `useWatchTpSlNotifications` cannot cover this: the account count changes as a
 * group grows, and a hook cannot be called in a loop. So this drives the core
 * watcher directly from one effect. The SDK's socket pool keys on
 * `(wsUrl, appName, account)`, so subscribing here adds handlers to sockets
 * other hooks already opened rather than new connections.
 *
 * Frames land in the store rather than in a caller-supplied callback, because
 * the store is what every consumer — read hooks, run hooks, cells — reconciles
 * against. That way a step confirms no matter which subscription received it.
 *
 * @param parameters - The accounts to watch, the candidate quote ids, and the enable switch.
 */
export function useWatchTpSlAccounts(parameters: UseWatchTpSlAccountsParameters): void {
  const { accounts, ids, chainId, enabled = true } = parameters;
  const config = useSymmioConfig(parameters);

  /** Read the live id list from inside the long-lived socket handler. */
  const idsRef = useRef(ids);
  idsRef.current = ids;

  /** Re-subscribe only when the account set genuinely changes. */
  const accountsKey = accounts.map((account) => account.toLowerCase()).join(",");

  useEffect(() => {
    if (!enabled || accounts.length === 0) return;

    const onNotification = (notification: TpSlNotification) => {
      linkTpSlNotificationIds(notification);
      const target = matchTpSlNotification(notification, idsRef.current);
      if (target === undefined) return;
      useTpSlStore.getState().applyNotification(target, notification);
    };

    const unwatchers = accounts.map((account) => watchTpSlNotifications(config, { account, chainId, onNotification }));
    return () => {
      for (const unwatch of unwatchers) unwatch();
    };
    // `accountsKey` stands in for `accounts` — a fresh array with the same
    // members must not tear down and rebuild the subscriptions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountsKey, chainId, config, enabled]);
}

/** Case-insensitive address dedupe that preserves first-seen order. */
export function dedupeAddresses(addresses: readonly (Address | undefined)[]): Address[] {
  const seen = new Set<string>();
  const unique: Address[] = [];
  for (const address of addresses) {
    if (!address) continue;
    const normalized = address.toLowerCase();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    unique.push(address);
  }
  return unique;
}
