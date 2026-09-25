import type { Notification, SocketStatus } from "@symmio/trading-core";
import { watchNotifications } from "@symmio/trading-core";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Address } from "viem";
import { useSdkScope } from "./use-sdk-scope.js";
import { useSubAccount } from "./use-sub-accounts.js";

const MAX_HISTORY = 300;

type NotificationListener = (notification: Notification) => void;

interface NotificationsContextValue {
  /**
   * A capped window of recent notifications in **arrival order (oldest first)** —
   * the order `reconcileQuotes` documents for its `notifications` input, so a
   * later frame always wins over an earlier one. Reversing this silently breaks
   * failure handling: an older success anchor would re-apply over a newer
   * `FAILED` and pin the row at "Confirming" forever.
   */
  notifications: Notification[];
  status: SocketStatus;
  /** Register a side-effect listener (e.g. toasts); returns an unsubscribe. */
  subscribe: (listener: NotificationListener) => () => void;
}

const NotificationsContext = createContext<NotificationsContextValue>({
  notifications: [],
  status: "closed",
  subscribe: () => () => undefined,
});

/**
 * Subscribes to the account's live notification socket — the authoritative
 * source for quote/close lifecycle transitions. It keeps a capped, de-duped
 * window in arrival order for reconciliation, and fans each frame out to
 * registered listeners for toasts.
 */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { config, chainId, solverId } = useSdkScope();
  const { subAccount } = useSubAccount();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [status, setStatus] = useState<SocketStatus>("closed");
  const listeners = useRef(new Set<NotificationListener>());

  useEffect(() => {
    setNotifications([]);
    if (!subAccount) {
      setStatus("closed");
      return;
    }
    let unwatch: (() => void) | undefined;
    try {
      unwatch = watchNotifications(config, {
        account: subAccount as Address,
        chainId,
        solverId,
        onNotification: (notification) => {
          /**
           * Append blindly — no de-duplication. `id` is not a usable identity
           * here: the service omits it on frames it does not apply to (an
           * `InstantRFQ` report carries none), and the SDK normalizes a missing
           * id to `""`, so keying on it collapses every id-less frame of the
           * lowcap instant flow onto a single slot and drops all but the last.
           * `reconcileQuotes` is idempotent over already-applied notifications,
           * which is why the SDK's own buffer appends without de-duping too.
           */
          setNotifications((prev) => [...prev, notification].slice(-MAX_HISTORY));
          for (const listener of listeners.current) listener(notification);
        },
        onStatusChange: setStatus,
        onError: () => setStatus("reconnecting"),
      });
    } catch {
      setStatus("closed");
    }
    return () => unwatch?.();
  }, [config, subAccount, chainId, solverId]);

  /**
   * Identity-stable so consumers can list it in effect dependencies without
   * re-subscribing on every inbound notification.
   */
  const subscribe = useCallback((listener: NotificationListener) => {
    listeners.current.add(listener);
    return () => {
      listeners.current.delete(listener);
    };
  }, []);

  const value = useMemo<NotificationsContextValue>(
    () => ({ notifications, status, subscribe }),
    [notifications, status, subscribe],
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

/** Live notifications, socket status, and a listener registration. */
export function useNotificationsFeed(): NotificationsContextValue {
  return useContext(NotificationsContext);
}
