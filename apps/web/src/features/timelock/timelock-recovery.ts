import {
  getTimelockRecoveryTransactionHash,
  isDefiniteGaslessSimulationRejection as isDefiniteGaslessSimulationRejectionCore,
  isDefiniteTimelockApprovalRejection,
  isUnsubmittedTimelockWalletRejection,
} from "@symmio/trading-react";
import type { Address } from "viem";
export { readScheduledRecovery, type ScheduledRecovery } from "./timelock-recovery-codec";

const RECOVERY_CHANGED = "symm:timelock-recovery-changed";
const HISTORY_PREFIX = "symm:timelock-history:v1:";

/** Permanent deployment/owner history scopes coordination across root accounts and configuration changes. */
export function timelockHistoryKey(chainId: number, accountLayer: Address, owner: Address): string {
  return `${HISTORY_PREFIX}${chainId}:${accountLayer.toLowerCase()}:${owner.toLowerCase()}`;
}

function historyKeyFromJournal(key: string): string {
  const parts = key.split(":");
  if (parts.length !== 7 || parts[0] !== "symm" || parts[1] !== "timelock-attempt" || parts[2] !== "v2")
    throw new Error("Cannot safely coordinate an unknown timelock journal scope.");
  return `${HISTORY_PREFIX}${parts[3]}:${parts[4]}:${parts[6]}`.toLowerCase();
}

/** Mark history before beginning the first protected operation. */
export function rememberTimelockHistory(key: string): void {
  localStorage.setItem(key, "1");
  notifyTimelockRecoveryChanged();
}

/** A deployment without recorded timelock history keeps its legacy write behavior. */
export function hasTimelockHistory(key: string): boolean {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

async function withOwnerTimelockLock<T>(historyKey: string, action: () => Promise<T>): Promise<T> {
  if (!navigator.locks) throw new Error("This browser cannot safely coordinate protected operations across tabs.");
  return navigator.locks.request(`symm:timelock-owner-lock:${historyKey}`, { ifAvailable: true }, async (lock) => {
    if (!lock) throw new Error("Another tab is already processing an operation for this owner and deployment.");
    return action();
  });
}

/** Ordinary writes share the lock; protected writes take it exclusively. */
export async function withTimelockHistoryLock<T>(historyKey: string, action: () => Promise<T>): Promise<T> {
  // Legacy writes continue to work in browsers without Web Locks. Protected
  // writes fail closed in that environment and therefore cannot race them.
  if (!navigator.locks) return action();
  return navigator.locks.request(
    `symm:timelock-owner-lock:${historyKey}`,
    { ifAvailable: true, mode: "shared" },
    async (lock) => {
      if (!lock) throw new Error("Another tab is already processing an operation for this owner and deployment.");
      return action();
    },
  );
}

/** Wake same-tab consumers as well as the other tabs notified by the storage event. */
export function notifyTimelockRecoveryChanged(): void {
  window.dispatchEvent(new Event(RECOVERY_CHANGED));
}

export function subscribeTimelockRecoveryChanged(listener: () => void): () => void {
  window.addEventListener("storage", listener);
  window.addEventListener(RECOVERY_CHANGED, listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener(RECOVERY_CHANGED, listener);
  };
}

/** A root is unknown until read on chain. Conservatively include legacy owner records. */
export function mayHaveTimelockRecovery(chainId: number, accountLayer: Address, owner?: Address): boolean {
  if (!owner || typeof window === "undefined") return false;
  const prefix = `symm:timelock-attempt:v2:${chainId}:${accountLayer.toLowerCase()}:`;
  const legacy = "symm:timelock-attempt:";
  const suffix = `:${owner.toLowerCase()}`;
  try {
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index)?.toLowerCase();
      if (
        key?.endsWith(suffix) &&
        (key.startsWith(prefix) || (key.startsWith(legacy) && !key.startsWith(`${legacy}v2:`)))
      )
        return true;
    }
    return false;
  } catch {
    // A deployment without timelock keeps its legacy behavior when browser
    // storage is unavailable. In that situation prior recovery is unknowable.
    return false;
  }
}

function legacyTimelockKeys(key: string): string[] {
  const suffix = key.split(":").slice(-2).join(":");
  const prefix = "symm:timelock-attempt:";
  return Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index))
    .filter(
      (candidate): candidate is string =>
        candidate !== null &&
        candidate.startsWith(prefix) &&
        !candidate.startsWith(`${prefix}v2:`) &&
        candidate.endsWith(`:${suffix}`),
    )
    .sort();
}

/** Surface older unresolved records without guessing their deployment or modifying them. */
export function readTimelockRecovery(key: string): string | null {
  const current = localStorage.getItem(key);
  const legacy = legacyTimelockKeys(key).map((legacyKey) => ({
    key: legacyKey,
    value: localStorage.getItem(legacyKey),
  }));
  return legacy.length ? JSON.stringify({ current, legacyRecoveryRecords: legacy }, null, 2) : current;
}

/** Clear only the records the user explicitly reconciled, while holding the account lock. */
export async function clearReviewedTimelockRecovery(key: string, expectedRecovery: string): Promise<void> {
  await withTimelockAttemptLock(
    key,
    async () => {
      const legacyKeys = legacyTimelockKeys(key);
      async function clearWithLegacyLocks(index: number): Promise<void> {
        if (index === legacyKeys.length) {
          if (readTimelockRecovery(key) !== expectedRecovery)
            throw new Error("Recovery records changed; review them again before clearing.");
          for (const legacyKey of legacyKeys) localStorage.removeItem(legacyKey);
          localStorage.removeItem(key);
          notifyTimelockRecoveryChanged();
          return;
        }
        await navigator.locks.request(
          `symm:timelock-lock:${legacyKeys[index]}`,
          { ifAvailable: true },
          async (lock) => {
            if (!lock)
              throw new Error("An older tab is processing a protected operation; reconcile it before clearing.");
            await clearWithLegacyLocks(index + 1);
          },
        );
      }
      await clearWithLegacyLocks(0);
    },
    expectedRecovery,
  );
}

/** Find a submitted transaction in nested SDK/receipt errors without assuming an error class. */
export function recoveryTransactionHash(error: unknown): string | undefined {
  return getTimelockRecoveryTransactionHash(error);
}

/** Only documented responses that explicitly reject approval before issuance are definitive. */
export function isDefiniteApprovalRejection(error: unknown): boolean {
  return isDefiniteTimelockApprovalRejection(error);
}

/** Wallet rejection is definite only when no submitted transaction hash was retained. */
export function isUnsubmittedWalletRejection(error: unknown): boolean {
  return isUnsubmittedTimelockWalletRejection(error);
}

/** Clear only this attempt's unchanged record after a definite non-submission. */
export async function clearRejectedApprovalAttempt(
  key: string,
  marker: string,
  failure: unknown,
  approvalIssued: boolean,
  saveRecovery: (value: string | null) => void,
): Promise<void> {
  if (
    recoveryTransactionHash(failure) ||
    (!isUnsubmittedWalletRejection(failure) && (approvalIssued || !isDefiniteApprovalRejection(failure)))
  )
    return;
  try {
    await withTimelockAttemptLock(
      key,
      async () => {
        if (readTimelockRecovery(key) === marker) saveRecovery(null);
      },
      marker,
    );
  } catch {
    // Keep the record if another tab changed it or the lock is unavailable.
  }
}

/** A rejected relay simulation with no transaction hash did not submit a transaction. */
export function isDefiniteGaslessSimulationRejection(error: unknown): boolean {
  return isDefiniteGaslessSimulationRejectionCore(error);
}

/** Serialize fresh approval attempts across browser tabs for one account scope. */
export async function withTimelockAttemptLock<T>(
  key: string,
  action: () => Promise<T>,
  expectedRecovery: string | null = null,
): Promise<T> {
  if (!navigator.locks) throw new Error("This browser cannot safely coordinate protected operations across tabs.");
  const historyKey = historyKeyFromJournal(key);
  rememberTimelockHistory(historyKey);
  return withOwnerTimelockLock(historyKey, () =>
    navigator.locks.request(`symm:timelock-lock:${key}`, { ifAvailable: true }, async (lock) => {
      if (!lock) throw new Error("Another tab is already processing a protected operation for this account.");
      if (readTimelockRecovery(key) !== expectedRecovery)
        throw new Error("An earlier protected operation needs reconciliation.");
      return action();
    }),
  );
}
