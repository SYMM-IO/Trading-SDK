"use client";

import { STAGING_CHAIN_OVERRIDES } from "@/config/symmio-presets";
import type { TimelockAuthorization, ValidatedTimelockApproval } from "@symmio/trading-core";
import { useTimelockApprovalProvider } from "@symmio/trading-react";
import { useEffect, useRef, useState } from "react";
import type { Address } from "viem";
import {
  clearReviewedTimelockRecovery,
  hasTimelockHistory,
  mayHaveTimelockRecovery,
  notifyTimelockRecoveryChanged,
  readTimelockRecovery,
  recoveryTransactionHash,
  rememberTimelockHistory,
  subscribeTimelockRecoveryChanged,
  timelockHistoryKey,
  withTimelockAttemptLock,
  withTimelockHistoryLock,
} from "./timelock-recovery";
import type { TimelockContext } from "./use-timelock-context";

const PREPARING = "A protected operation is being prepared. Reconcile its outcome before trying again.";
function isUnavailableApproval(error: unknown): boolean {
  let current = error;
  for (let depth = 0; depth < 12 && current && typeof current === "object"; depth++) {
    if (
      "name" in current &&
      current.name === "TimelockApprovalHttpError" &&
      "status" in current &&
      typeof current.status === "number" &&
      (current.status === 0 || current.status >= 500)
    )
      return true;
    current = "cause" in current ? current.cause : undefined;
  }
  return false;
}

function isUnavailableRecovery(recovery: string | null): boolean {
  if (!recovery) return false;
  try {
    const parsed: unknown = JSON.parse(recovery);
    return Boolean(
      parsed && typeof parsed === "object" && "kind" in parsed && parsed.kind === "approval-service-unavailable",
    );
  } catch {
    return false;
  }
}

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
    const activeKey = key;
    currentKey.current = key;
    try {
      const value = readTimelockRecovery(key);
      saved.current.set(key, value);
      setRecovery(value);
      setLoadedKey(key);
      setError(undefined);
    } catch {
      setError("Browser storage is unavailable; protected actions are disabled.");
    }
    function changed() {
      try {
        const value = readTimelockRecovery(activeKey);
        saved.current.set(activeKey, value);
        setRecovery(value);
        setLoadedKey(activeKey);
        setError(undefined);
      } catch {
        setError("Browser storage is unavailable; protected actions are disabled.");
      }
    }
    const unsubscribe = subscribeTimelockRecoveryChanged(changed);
    return () => {
      unsubscribe();
      if (currentKey.current === key) currentKey.current = undefined;
    };
  }, [key]);

  function save(value: string | null) {
    if (!key) throw new Error("Connect an owner wallet before requesting an approval.");
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
    setError(undefined);
    notifyTimelockRecoveryChanged();
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
    save(PREPARING);
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
  /** Recheck at submission in case another tab just wrote a recovery record. */
  function canProceed() {
    if (!owner) return true;
    try {
      if (key && loadedKey === key) return !readTimelockRecovery(key);
      return !mayHaveTimelockRecovery(
        context.chainId,
        context.config.getChainConfig(context.chainId).addresses.accountLayerAddress,
        owner,
      );
    } catch {
      return false;
    }
  }
  return {
    begin,
    storageKey: key,
    saveScheduledRecovery: save,
    recovery: key && loadedKey === key ? recovery : null,
    approvalServiceUnavailable: isUnavailableRecovery(recovery),
    error: context.checkRecovery ? (error ?? context.rootError?.message) : undefined,
    loaded: !context.checkRecovery || !owner || Boolean(key && loadedKey === key),
    canProceed,
    runNormal: <T>(action: () => Promise<T>) => {
      if (!owner) return action();
      const accountLayer = context.config.getChainConfig(context.chainId).addresses.accountLayerAddress;
      const historyKey = timelockHistoryKey(context.chainId, accountLayer, owner);
      const possibleRecovery = mayHaveTimelockRecovery(context.chainId, accountLayer, owner);
      const isStaging =
        context.chainId === 42161 &&
        accountLayer.toLowerCase() === STAGING_CHAIN_OVERRIDES[42161].addresses.accountLayerAddress.toLowerCase();
      if (!context.timelockEnabled && !isStaging && !possibleRecovery && !hasTimelockHistory(historyKey))
        return action();
      if (possibleRecovery) rememberTimelockHistory(historyKey);
      return withTimelockHistoryLock(historyKey, async () => {
        if (!canProceed()) throw new Error("An earlier protected operation needs reconciliation.");
        return action();
      });
    },
    clear: () => save(null),
    clearReviewed: async () => {
      if (!key || !recovery) return false;
      try {
        await clearReviewedTimelockRecovery(key, recovery);
        saved.current.set(key, null);
        if (currentKey.current === key) setRecovery(null);
        setError(undefined);
        return true;
      } catch (failure) {
        setError(failure instanceof Error ? failure.message : String(failure));
        return false;
      }
    },
    submitted,
    failed: (failure: unknown) => {
      const hash = recoveryTransactionHash(failure);
      if (hash) submitted(hash);
    },
    run: <T>(action: () => Promise<T>) => {
      if (!key) throw new Error("Connect the owner wallet.");
      return withTimelockAttemptLock(key, async () => {
        try {
          return await action();
        } catch (failure) {
          const marker = PREPARING;
          if (
            saved.current.get(key) === marker &&
            readTimelockRecovery(key) === marker &&
            failure &&
            typeof failure === "object" &&
            "kind" in failure &&
            failure.kind === "api" &&
            "timelock" in failure &&
            failure.timelock &&
            typeof failure.timelock === "object" &&
            "knownCode" in failure.timelock &&
            (failure.timelock.knownCode === 3703 || failure.timelock.knownCode === 3704)
          )
            save(null);
          else if (isUnavailableApproval(failure)) {
            const previous = saved.current.get(key);
            if (previous && readTimelockRecovery(key) === previous)
              save(
                JSON.stringify({
                  kind: "approval-service-unavailable",
                  message: "Reconcile every previous approval and transaction before delayed recovery.",
                  previous,
                }),
              );
          }
          throw failure;
        }
      });
    },
  };
}
