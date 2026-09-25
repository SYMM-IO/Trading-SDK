import type { Notification } from "@symmio/trading-core";
import { NotificationType } from "@symmio/trading-core";
import { Box, Text } from "ink";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { glyph, theme } from "../config/theme.js";
import { useNotificationsFeed } from "../sdk/use-notifications.js";

export type ToastKind = "info" | "success" | "error" | "pending";

interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

/**
 * The imperative toast controls.
 *
 * This object's identity MUST stay stable for the life of the provider. Callers
 * raise toasts from effects that list it as a dependency
 * (`useEffect(() => { if (x.isSuccess) toast.push(…) }, [x.isSuccess, toast])`),
 * so if pushing changed this identity the effect would re-run, push again, and
 * loop until React bails with "Maximum update depth exceeded". That is why the
 * live toast list lives in a separate context instead of on this object.
 */
export interface ToastApi {
  push: (kind: ToastKind, message: string) => number;
  dismiss: (id: number) => void;
}

const ToastApiContext = createContext<ToastApi | null>(null);
const ToastListContext = createContext<readonly Toast[]>([]);

const MAX_TOASTS = 4;
const AUTO_DISMISS_MS = 4200;

/** Turn a solver `lastSeenAction` into a human sentence. */
function describeAction(notification: Notification): string {
  const action = (notification.lastSeenAction ?? "").toLowerCase();
  if (action.includes("close")) return "Position closed";
  if (action.includes("open") || action.includes("sendquote")) return "Position opened";
  if (action.includes("cancel")) return "Order canceled";
  if (action.includes("margin")) return "Margin updated";
  if (action.includes("liquidat")) return "Position liquidated";
  return "Order updated";
}

/**
 * Renders transient toasts. Subscribes to the live notification feed and raises
 * a toast on every success/failure transition, and exposes an imperative `push`
 * for local action feedback (submitting, sent, rejected).
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const { subscribe } = useNotificationsFeed();

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (kind: ToastKind, message: string) => {
      const id = nextId.current++;
      setToasts((prev) => [...prev.slice(-(MAX_TOASTS - 1)), { id, kind, message }]);
      if (kind !== "pending") setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
      return id;
    },
    [dismiss],
  );

  // Stable for the provider's lifetime: `push`/`dismiss` never change identity.
  const api = useMemo<ToastApi>(() => ({ push, dismiss }), [push, dismiss]);

  useEffect(() => {
    return subscribe((notification) => {
      if (notification.type === NotificationType.SEEN) return;
      if (notification.type === NotificationType.FAILED) {
        push("error", notification.failureMessage ?? `${describeAction(notification)} failed`);
      } else {
        push("success", describeAction(notification));
      }
    });
  }, [subscribe, push]);

  return (
    <ToastApiContext.Provider value={api}>
      <ToastListContext.Provider value={toasts}>{children}</ToastListContext.Provider>
    </ToastApiContext.Provider>
  );
}

/** Imperative toast controls. Identity-stable — safe in effect dependencies. */
export function useToast(): ToastApi {
  const value = useContext(ToastApiContext);
  if (!value) throw new Error("useToast must be used within ToastProvider.");
  return value;
}

const TONES: Record<ToastKind, { color: string; icon: string }> = {
  info: { color: theme.info, icon: glyph.bullet },
  success: { color: theme.positive, icon: glyph.check },
  error: { color: theme.negative, icon: glyph.cross },
  pending: { color: theme.warning, icon: glyph.dot },
};

/** The stacked toast display, rendered just above the status bar. */
export function ToastHost() {
  const toasts = useContext(ToastListContext);
  if (toasts.length === 0) return null;
  return (
    <Box flexDirection="column" paddingX={1}>
      {toasts.map((toast) => {
        const tone = TONES[toast.kind];
        return (
          <Text key={toast.id} color={tone.color}>
            {tone.icon} {toast.message}
          </Text>
        );
      })}
    </Box>
  );
}
