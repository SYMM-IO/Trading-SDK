"use client";

import type { TpSlNotification } from "@symmio/trading-core";
import { useTpSlStore } from "./tpsl-store";

/**
 * Resolve which of `ids` a TP/SL notification belongs to.
 *
 * A quote is addressable by several ids over its life (the hedger's negative
 * `tempQuoteId` before it anchors, the on-chain `quoteId` after), and the store
 * aliases every id it has learned onto one record. So the match runs through
 * the store's index and compares records by reference — a frame carrying the
 * temp id still lands on a child now addressed by its on-chain id.
 *
 * When the store has no record for a candidate yet (the very first "seed"
 * frame), it falls back to comparing the raw ids on the frame.
 *
 * @param notification - The normalized TP/SL frame.
 * @param ids - Candidate quote ids, in the caller's own order.
 * @returns The first matching id, or `undefined` when the frame is unrelated.
 */
export function matchTpSlNotification(
  notification: TpSlNotification,
  ids: readonly (bigint | undefined)[],
): bigint | undefined {
  const store = useTpSlStore.getState();
  for (const id of ids) {
    if (id === undefined || id === 0n) continue;
    const target = store.get(id);
    if (!target) {
      if (
        notification.primaryIdentifier === Number(id) ||
        notification.secondaryIdentifier === Number(id) ||
        notification.quoteId === Number(id)
      ) {
        return id;
      }
      continue;
    }
    if (notification.primaryIdentifier !== 0 && store.get(BigInt(notification.primaryIdentifier)) === target) return id;
    if (notification.secondaryIdentifier !== 0 && store.get(BigInt(notification.secondaryIdentifier)) === target) {
      return id;
    }
  }
  return undefined;
}

/**
 * Learn the `tempQuoteId ↔ quoteId` pairing a frame carries, so both ids
 * resolve to the same store record from now on. No-op when the frame only
 * carries one identifier.
 *
 * @param notification - The normalized TP/SL frame.
 */
export function linkTpSlNotificationIds(notification: TpSlNotification): void {
  if (notification.primaryIdentifier === 0 || notification.secondaryIdentifier === 0) return;
  useTpSlStore.getState().link(BigInt(notification.primaryIdentifier), BigInt(notification.secondaryIdentifier));
}
