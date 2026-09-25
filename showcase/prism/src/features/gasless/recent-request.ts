import type { GaslessAcceptedRequest, GaslessService } from "@symmio/trading-core";

const STORAGE_KEY = "prism.gasless.recent-request.v1";

/** The recoverable portion of an accepted relay workflow. */
export interface RecentGaslessRequest {
  requestId: string;
  service: GaslessService;
  protocolInstance: string | null;
  owner: `0x${string}`;
  walletIds: readonly string[];
  idempotencyKey: string;
}

/** Persist an acceptance immediately; the gateway has no request-list endpoint. */
export function saveRecentGaslessRequest(accepted: GaslessAcceptedRequest): RecentGaslessRequest {
  const value: RecentGaslessRequest = {
    requestId: accepted.requestId,
    service: accepted.service,
    protocolInstance: accepted.protocolInstance,
    owner: accepted.owner,
    walletIds: accepted.walletIds.map(String),
    idempotencyKey: accepted.idempotencyKey,
  };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  return value;
}

/** Restore the most recently accepted workflow after a reload. */
export function loadRecentGaslessRequest(): RecentGaslessRequest | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as RecentGaslessRequest) : null;
  } catch {
    return null;
  }
}
