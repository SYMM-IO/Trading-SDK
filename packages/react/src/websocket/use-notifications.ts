"use client";

import { watchNotifications, type ConfigParameter, type Notification, type SocketStatus } from "@symm-frontier/core";
import { useEffect, useRef, useState } from "react";
import type { Address } from "viem";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/** Default number of notifications retained in the buffer. */
const DEFAULT_LIMIT = 50;

/**
 * Parameters for {@link useNotifications}.
 */
export interface UseNotificationsParameters extends ConfigParameter {
  /** SubAccount address to subscribe for. The hook is idle until this is set. */
  account?: Address;
  /** Target chain id. Defaults to the SDK's active chain. */
  chainId?: number;
  /** Optional per-message callback, invoked in addition to buffering. */
  onNotification?: (notification: Notification) => void;
  /** Max notifications retained in `notifications` (newest-first). Default 50. */
  limit?: number;
  /** Subscribe only when `true` (and an account is set). Default `true`. */
  enabled?: boolean;
}

/**
 * Value returned by {@link useNotifications}.
 */
export interface UseNotificationsReturnType {
  /** Buffered notifications, newest first, capped at `limit`. */
  notifications: Notification[];
  /** The most recent notification, or `null`. */
  latest: Notification | null;
  /** Live connection status of the underlying socket. */
  status: SocketStatus;
  /** The last transport/parse error, normalized, or `null`. */
  error: SymmioRequestError | null;
}

/**
 * Subscribe to live SYMMIO position/quote notifications for an account.
 *
 * Opens a reconnecting subscription via the SDK's `watchNotifications`, buffers
 * incoming messages newest-first (capped at `limit`), and surfaces the live
 * connection `status`. Pass `onNotification` to also react to each message
 * imperatively. The subscription is torn down on unmount or when `account` /
 * `chainId` / `enabled` change.
 *
 * @example
 * ```tsx
 * const { notifications, status } = useNotifications({ account });
 * return <Badge status={status} count={notifications.length} />;
 * ```
 */
export function useNotifications(parameters: UseNotificationsParameters = {}): UseNotificationsReturnType {
  const { account, chainId, onNotification, limit = DEFAULT_LIMIT, enabled = true } = parameters;
  const config = useSymmioConfig(parameters);
  const defaultChainId = useSymmioChainId();
  const resolvedChainId = chainId ?? defaultChainId;

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [status, setStatus] = useState<SocketStatus>("closed");
  const [error, setError] = useState<SymmioRequestError | null>(null);

  // Keep the latest callback/limit without forcing the subscription to re-open.
  const onNotificationRef = useRef(onNotification);
  onNotificationRef.current = onNotification;
  const limitRef = useRef(limit);
  limitRef.current = limit;

  const active = enabled && Boolean(account);

  useEffect(() => {
    if (!active || !account) {
      setStatus("closed");
      return;
    }

    setNotifications([]);
    setError(null);

    let unwatch: (() => void) | undefined;
    try {
      unwatch = watchNotifications(config, {
        account,
        chainId: resolvedChainId,
        onNotification: (notification) => {
          setNotifications((prev) => [notification, ...prev].slice(0, limitRef.current));
          onNotificationRef.current?.(notification);
        },
        onStatusChange: setStatus,
        onError: (err) => setError(normalizeSymmError(err)),
      });
    } catch (err) {
      setError(normalizeSymmError(err));
      setStatus("closed");
    }

    return () => unwatch?.();
  }, [active, account, config, resolvedChainId]);

  return {
    notifications,
    latest: notifications[0] ?? null,
    status,
    error,
  };
}
