import { GaslessRequestStatus, isGaslessRequestTerminal, type GaslessRequest } from "./types";

/**
 * How far along the lifecycle a status is. Terminal statuses share the top rank
 * — none of them can be superseded by another.
 */
function statusRank(status: GaslessRequestStatus): number {
  if (isGaslessRequestTerminal(status)) return 2;
  return status === GaslessRequestStatus.SUBMITTED ? 1 : 0;
}

/** The record's `updatedAt` as epoch ms, or `null` when it is missing or unparseable. */
function updatedAtMs(request: GaslessRequest): number | null {
  if (!request.updatedAt) return null;
  const parsed = Date.parse(request.updatedAt);
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Whether `next` is a later view of a request than `prev` — the stale-response
 * guard for anything that writes a polled record somewhere shared (a query
 * cache, a progress state, a stored row).
 *
 * Status reads are concurrent by construction: a poll, a retry after a
 * transient failure and a stream snapshot can all be in flight at once, and
 * they do not answer in the order they were sent. Without this guard a slow
 * `queued` response that lands after the `succeeded` one repaints a finished
 * workflow as pending, which is exactly the "it looks stuck, submit it again"
 * bug the lifecycle contract forbids.
 *
 * The order is the lifecycle first — `queued` < `submitted` < terminal, with
 * **terminal sticky**: a terminal record is immutable, so nothing non-terminal
 * ever replaces one. Within the same rank, `updatedAt` decides; when either
 * record does not carry one, `next` wins, because a record with no timestamp
 * cannot be proven stale and the newer fetch is the better guess.
 *
 * @param prev - The record currently held, or `undefined` when there is none.
 * @param next - The record that just arrived.
 * @returns `true` when `next` should replace `prev`.
 *
 * @example
 * ```ts
 * queryClient.setQueryData(key, (prev?: GaslessRequest) =>
 *   isNewerGaslessRequest(prev, incoming) ? incoming : prev,
 * );
 * ```
 */
export function isNewerGaslessRequest(prev: GaslessRequest | undefined, next: GaslessRequest): boolean {
  if (!prev) return true;
  if (prev.requestId !== next.requestId) return true;

  const prevRank = statusRank(prev.status);
  const nextRank = statusRank(next.status);
  if (nextRank !== prevRank) return nextRank > prevRank;

  const prevAt = updatedAtMs(prev);
  const nextAt = updatedAtMs(next);
  if (prevAt === null || nextAt === null) return true;
  return nextAt >= prevAt;
}
