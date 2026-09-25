import type { GaslessSubmitPath, GaslessUnconfirmedSubmit } from "@symmio/trading-core";

const STORAGE_KEY = "prism:gasless:unconfirmed-submit";
const SUBMIT_PATHS: ReadonlySet<string> = new Set<GaslessSubmitPath>([
  "/gateway/relay-instant",
  "/deposit-settlements/new-account",
  "/deposit-settlements/existing-account",
]);

/** Persist the exact SDK recovery record locally without rebuilding its signed body. */
export function savePendingGaslessSubmit(submit: GaslessUnconfirmedSubmit): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(submit));
    return true;
  } catch {
    return false;
  }
}

/** Restore the last inconclusive submit, rejecting stale or malformed local data. */
export function loadPendingGaslessSubmit(): GaslessUnconfirmedSubmit | null {
  if (typeof window === "undefined") return null;
  try {
    const raw: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null");
    if (!isRecord(raw)) return null;
    if (typeof raw.chainId !== "number") return null;
    if (raw.service !== "operations" && raw.service !== "deposits") return null;
    if (typeof raw.path !== "string" || !SUBMIT_PATHS.has(raw.path)) return null;
    if (typeof raw.idempotencyKey !== "string" || raw.idempotencyKey.length === 0) return null;
    if (!isRecord(raw.body)) return null;
    return raw as unknown as GaslessUnconfirmedSubmit;
  } catch {
    return null;
  }
}

/** Remove a recovery record only after the workflow is reconciled or explicitly abandoned. */
export function clearPendingGaslessSubmit(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
