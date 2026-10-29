"use client";

import type { TimelockAuthorization, ValidatedTimelockApproval } from "@symmio/trading-core";
import { useTimelockApprovalProvider } from "@symmio/trading-react";
import { useEffect, useRef, useState } from "react";
import type { Address } from "viem";
import {
  clearReviewedTimelockRecovery,
  readTimelockRecovery,
  recoveryTransactionHash,
  withTimelockAttemptLock,
} from "./timelock-recovery";
import type { TimelockContext } from "./use-timelock-context";

/** Browser-owned recovery journal shared with the timelock integration flow. */
export function useTimelockAttempt(context: TimelockContext, owner?: Address) {
  const provider = useTimelockApprovalProvider({ chainId: context.chainId, solverId: context.solverId });
  const key =
    owner && context.journalScope ? `symm:timelock-attempt:${context.journalScope}:${owner.toLowerCase()}` : undefined;
  const [recovery, setRecovery] = useState<string | null>(null);
  const [loadedKey, setLoadedKey] = useState<string>();
  const [error, setError] = useState<string>();
  const saved = useRef(new Map<string, string | null>());
  const currentKey = useRef(key);
  currentKey.current = key;
  const currentScope = useRef(context.scope);
  currentScope.current = context.scope;
  useEffect(() => {
    if (!key) return;
    currentKey.current = key;
    try {
      const value = readTimelockRecovery(key);
      saved.current.set(key, value);
      setRecovery(value);
      setLoadedKey(key);
    } catch {
      setError("Browser storage is unavailable; protected actions are disabled.");
    }
    function changed(event: StorageEvent) {
      if (event.key === key) {
        saved.current.set(key, event.newValue);
        setRecovery(event.newValue);
      }
    }
    window.addEventListener("storage", changed);
    return () => {
      window.removeEventListener("storage", changed);
      if (currentKey.current === key) currentKey.current = undefined;
    };
  }, [key]);

  function save(value: string | null) {
    if (!key) throw new Error("Connect an owner wallet before requesting an approval.");
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
    saved.current.set(key, value);
    if (currentKey.current === key) setRecovery(value);
  }

  async function begin(count: number): Promise<TimelockAuthorization[]> {
    const requestedScope = context.scope;
    if (
      !key ||
      loadedKey !== key ||
      recovery ||
      !context.capability ||
      !context.indexingAcknowledged ||
      context.policy.error ||
      context.info.error
    )
      throw new Error("Complete policy setup and reconcile earlier attempts before continuing.");
    if (readTimelockRecovery(key)) throw new Error("A previous operation needs reconciliation.");
    save("A protected operation is being prepared. Reconcile its outcome before trying again.");
    const block = await context.config.getClient({ chainId: context.chainId }).getBlock();
    if (currentKey.current !== key || currentScope.current !== requestedScope)
      throw new Error("The account changed. Reconcile the previous attempt before continuing.");
    const issued: ValidatedTimelockApproval[] = [];
    return Array.from({ length: count }, () => ({
      capability: context.capability!,
      provider,
      deadline: block.timestamp + 300n,
      onApproval: (approval: ValidatedTimelockApproval) => {
        issued.push(approval);
        save(JSON.stringify(issued, (_, value: unknown) => (typeof value === "bigint" ? value.toString() : value), 2));
        if (currentKey.current !== key || currentScope.current !== requestedScope)
          throw new Error("The account changed after approval. Reconcile the saved approval before execution.");
      },
    }));
  }
  function submitted(hash: string) {
    const value = key ? saved.current.get(key) : undefined;
    if (!value) return;
    let previous: unknown = value;
    try {
      previous = JSON.parse(value);
    } catch {
      /* Preserve the pending record. */
    }
    save(JSON.stringify({ approval: previous, transactionHash: hash }, null, 2));
  }
  return {
    begin,
    recovery: context.chainUnsupported ? null : recovery,
    error: context.chainUnsupported ? undefined : (error ?? context.rootError?.message),
    loaded: context.chainUnsupported || !owner || Boolean(key && loadedKey === key),
    clear: () => save(null),
    clearReviewed: async () => {
      if (!key || !recovery) return;
      try {
        await clearReviewedTimelockRecovery(key, recovery);
        saved.current.set(key, null);
        if (currentKey.current === key) setRecovery(null);
      } catch (failure) {
        setError(failure instanceof Error ? failure.message : String(failure));
      }
    },
    submitted,
    failed: (failure: unknown) => {
      const hash = recoveryTransactionHash(failure);
      if (hash) submitted(hash);
    },
    run: <T>(action: () => Promise<T>) => {
      if (!key) throw new Error("Connect the owner wallet.");
      return withTimelockAttemptLock(key, action);
    },
  };
}
