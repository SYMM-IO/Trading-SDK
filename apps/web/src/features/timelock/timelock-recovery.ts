import type { Hex } from "viem";

/** Browser-only journal format for this console, never an SDK persistence policy. */
export interface ScheduledRecovery {
  kind: "scheduled-operation";
  confirmed: boolean;
  callData: Hex;
  innerCallData: Hex;
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
  let current = error;
  for (let depth = 0; depth < 12 && current && typeof current === "object"; depth++) {
    if ("hash" in current && typeof current.hash === "string" && /^0x[\da-fA-F]{64}$/.test(current.hash))
      return current.hash;
    current = "cause" in current ? current.cause : undefined;
  }
  return undefined;
}

/** Serialize fresh approval attempts across browser tabs for one account scope. */
export async function withTimelockAttemptLock<T>(
  key: string,
  action: () => Promise<T>,
  expectedRecovery: string | null = null,
): Promise<T> {
  if (!navigator.locks) throw new Error("This browser cannot safely coordinate protected operations across tabs.");
  return navigator.locks.request(`symm:timelock-lock:${key}`, { ifAvailable: true }, async (lock) => {
    if (!lock) throw new Error("Another tab is already processing a protected operation for this account.");
    if (readTimelockRecovery(key) !== expectedRecovery)
      throw new Error("An earlier protected operation needs reconciliation.");
    return action();
  });
}

export function readScheduledRecovery(value: string | null): ScheduledRecovery | undefined {
  if (!value) return undefined;
  try {
    const data: unknown = JSON.parse(value);
    if (!data || typeof data !== "object" || !("kind" in data) || data.kind !== "scheduled-operation") return undefined;
    if (
      !("confirmed" in data) ||
      typeof data.confirmed !== "boolean" ||
      !("callData" in data) ||
      !("innerCallData" in data)
    )
      return undefined;
    if (
      typeof data.callData !== "string" ||
      typeof data.innerCallData !== "string" ||
      !/^0x(?:[\da-fA-F]{2}){4,}$/.test(data.callData) ||
      !/^0x(?:[\da-fA-F]{2}){4,}$/.test(data.innerCallData)
    )
      return undefined;
    return {
      kind: data.kind,
      confirmed: data.confirmed,
      callData: data.callData as Hex,
      innerCallData: data.innerCallData as Hex,
    };
  } catch {
    return undefined;
  }
}
