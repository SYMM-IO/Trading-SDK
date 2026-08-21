"use client";

import { cn } from "@/lib/cn";
import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useMemo, useState } from "react";

export type ToastTone = "pending" | "long" | "short" | "warn" | "error";

export interface Toast {
  id: number;
  title: string;
  body?: string;
  tone: ToastTone;
}

interface ToastContextValue {
  /** Push a toast. Returns its id so a pending toast can be replaced. */
  push: (toast: Omit<Toast, "id">) => number;
  /** Replace a toast in place — pending → outcome without a flicker. */
  update: (id: number, toast: Omit<Toast, "id">) => void;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const TONES: Record<ToastTone, { color: string; background: string }> = {
  /* Pending states use the accent — the platform is working. Outcomes use
     directional or warning color. */
  pending: { color: "var(--accent)", background: "var(--accent-bg)" },
  long: { color: "var(--long-500)", background: "var(--long-bg)" },
  short: { color: "var(--short-500)", background: "var(--short-bg)" },
  warn: { color: "var(--warn-500)", background: "var(--warn-bg)" },
  error: { color: "var(--short-500)", background: "var(--short-bg)" },
};

/** Hosts the toast stack. Mount once, near the root. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (toast: Omit<Toast, "id">) => {
      const id = Date.now() + Math.floor(Math.random() * 1000);
      setToasts((current) => [...current, { ...toast, id }]);
      if (toast.tone !== "pending") {
        window.setTimeout(() => dismiss(id), 6000);
      }
      return id;
    },
    [dismiss],
  );

  const update = useCallback(
    (id: number, toast: Omit<Toast, "id">) => {
      setToasts((current) => current.map((existing) => (existing.id === id ? { ...existing, ...toast } : existing)));
      if (toast.tone !== "pending") {
        window.setTimeout(() => dismiss(id), 6000);
      }
    },
    [dismiss],
  );

  const value = useMemo(() => ({ push, update, dismiss }), [push, update, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-5 bottom-5 z-50 flex flex-col gap-2">
        {toasts.map((toast) => (
          <ToastCard key={toast.id} toast={toast} onDismiss={() => dismiss(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/** Push and update toasts from anywhere under the provider. */
export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used inside <ToastProvider>.");
  }
  return context;
}

function ToastCard({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const tone = TONES[toast.tone];

  return (
    <div
      className={cn(
        "prism-rise pointer-events-auto flex w-[336px] cursor-pointer items-start gap-3 rounded-lg border border-line bg-bg-1 p-3.5",
        "shadow-[var(--shadow-pop)]",
      )}
      onClick={onDismiss}
    >
      <span
        aria-hidden
        className={cn("mt-1 size-2 shrink-0 rounded-full", toast.tone === "pending" && "prism-pulse")}
        style={{ background: tone.color }}
      />
      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-md font-semibold" style={{ color: tone.color }}>
          {toast.title}
        </p>
        {toast.body ? <p className="text-sm break-words text-fg-2">{toast.body}</p> : null}
      </div>
    </div>
  );
}
