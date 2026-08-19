import type { GroupCloseAllocation, GroupCloseCandidate, PlanGroupCloseResult } from "../types";

/**
 * Execution order for the greedy pass: largest open size first — consuming the
 * biggest quotes reaches the target with the fewest quotes touched. Equal sizes
 * tie-break on `key` for determinism.
 */
function compareCandidates(a: GroupCloseCandidate, b: GroupCloseCandidate): number {
  if (a.openQuantity === b.openQuantity) return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
  return a.openQuantity > b.openQuantity ? -1 : 1;
}

/**
 * Plan an **exact** partial close of `targetQuantity` across a group's child
 * quotes, touching as few quotes as reasonably possible.
 *
 * Greedy single pass over candidates ordered by {@link compareCandidates}
 * (largest first). Per candidate:
 *
 * - amount left ≥ its open size → close it **fully**;
 * - otherwise close the largest **partial** that leaves no dust
 *   (`openQuantity − minRemainingQuantity`), and spill any excess to the next
 *   candidate.
 *
 * The plan either sums to the target exactly or fails — it never closes more
 * or less than asked. Failure reasons: `exceeds-open` (target above the
 * group's open size), `nothing-to-close` (no candidates / non-positive
 * target), `dust-locked` (every remaining child is at its dust cap; the
 * failure carries `closeableQuantity`, the largest amount that would have
 * worked). Pure and deterministic; input order does not matter.
 *
 * @param candidates - Closable children (see `toGroupCloseCandidates`).
 * @param targetQuantity - Exact amount to close, wei.
 * @returns The allocation plan, or a typed failure.
 *
 * @example
 * ```ts
 * const plan = planGroupClose(candidates, 2_800000000000000000n);
 * if (plan.feasible) await executeAllocations(plan.allocations);
 * ```
 */
export function planGroupClose(
  candidates: readonly GroupCloseCandidate[],
  targetQuantity: bigint,
): PlanGroupCloseResult {
  const open = candidates.filter((candidate) => candidate.openQuantity > 0n);
  const totalOpen = open.reduce((sum, candidate) => sum + candidate.openQuantity, 0n);

  if (targetQuantity <= 0n || open.length === 0) {
    return { feasible: false, reason: "nothing-to-close", totalOpen, closeableQuantity: 0n };
  }
  if (targetQuantity > totalOpen) {
    return { feasible: false, reason: "exceeds-open", totalOpen, closeableQuantity: totalOpen };
  }
  if (targetQuantity === totalOpen) {
    return {
      feasible: true,
      allocations: open.map((candidate) => ({
        key: candidate.key,
        closeQuantity: candidate.openQuantity,
        kind: "full",
      })),
    };
  }

  const sorted = [...open].sort(compareCandidates);
  const allocations: GroupCloseAllocation[] = [];
  let remaining = targetQuantity;

  for (const candidate of sorted) {
    if (remaining === 0n) break;
    if (remaining >= candidate.openQuantity) {
      allocations.push({ key: candidate.key, closeQuantity: candidate.openQuantity, kind: "full" });
      remaining -= candidate.openQuantity;
      continue;
    }
    // Largest partial that leaves an acceptable remainder; ≤ 0 ⇒ full-close-only child, skip.
    const cap = candidate.openQuantity - candidate.minRemainingQuantity;
    if (cap <= 0n) continue;
    const take = remaining < cap ? remaining : cap;
    allocations.push({ key: candidate.key, closeQuantity: take, kind: "partial" });
    remaining -= take;
  }

  if (remaining > 0n) {
    return {
      feasible: false,
      reason: "dust-locked",
      totalOpen,
      closeableQuantity: targetQuantity - remaining,
    };
  }
  return { feasible: true, allocations };
}
