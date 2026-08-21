"use client";

import { useToast, type ToastTone } from "@/components/toast";
import { useCallback } from "react";

export interface WriteToastOptions {
  /** Shown while the transaction is in flight. */
  pending: string;
  /** Shown once it lands. */
  success: string;
  /** Optional detail line on the success toast. */
  body?: string;
  /** Outcome tone. Funding moves are neutral-positive, so `long` by default. */
  tone?: ToastTone;
}

/** Runs one write with pending → outcome toast feedback. Resolves `true` on success. */
export type RunWrite = (options: WriteToastOptions, run: () => Promise<unknown>) => Promise<boolean>;

/**
 * Wrap every write on this screen in the same pending → outcome toast.
 *
 * The SDK's write hooks resolve after the receipt (`waitForReceipt` defaults to
 * true), so a single pending toast updated in place is an honest progress
 * signal: it is up for exactly as long as the chain has not confirmed.
 */
export function useWriteToast(): RunWrite {
  const { push, update } = useToast();

  return useCallback<RunWrite>(
    async (options, run) => {
      const id = push({ title: options.pending, tone: "pending" });
      try {
        await run();
        update(id, { title: options.success, body: options.body, tone: options.tone ?? "long" });
        return true;
      } catch (error) {
        update(id, { title: "Transaction failed", body: describeError(error), tone: "error" });
        return false;
      }
    },
    [push, update],
  );
}

/**
 * Best-effort human text for a failed write.
 *
 * The SDK normalizes everything to `SymmioRequestError`, which carries a
 * `message` — but a wallet rejection can also arrive as a bare `Error`, so this
 * reads the field structurally instead of instance-checking.
 */
export function describeError(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    const message = String((error as { message: unknown }).message).split("\n")[0] ?? "";
    if (message) return message.length > 180 ? `${message.slice(0, 180)}…` : message;
  }
  return "The wallet or the network rejected the transaction.";
}
