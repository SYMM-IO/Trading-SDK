import type { QueryKey } from "@tanstack/react-query";

/** Structural query-client boundary so separately installed compatible TanStack versions interoperate. */
export interface PoolOptimisticClient {
  getQueryCache(): {
    find(filters: { queryKey: QueryKey; exact: true }): { queryHash: string; state: { data: unknown } } | undefined;
  };
  getQueryData(key: QueryKey): unknown;
  setQueryData(key: QueryKey, value: unknown): unknown;
}

/** One query projection seeded from the variables of an in-flight pool operation. */
export interface PoolOptimisticPatch {
  queryKey: QueryKey;
  apply: (current: unknown) => unknown;
}

/** Handles for one operation only. Neither handle restores another operation's snapshot. */
export interface PoolOptimisticUpdate {
  commit: () => void;
  rollback: () => void;
}

interface Layer {
  id: symbol;
  apply: PoolOptimisticPatch["apply"];
  accepted: boolean;
}
interface Entry {
  base: unknown;
  projected: unknown;
  layers: Layer[];
  queryKey: QueryKey;
}
const ledgers = new WeakMap<PoolOptimisticClient, Map<string, Entry>>();

/**
 * Apply composable optimistic projections to existing query data. Each operation
 * can roll back independently. A later server result wins over the old projection.
 * Call after cancelling affected reads; commit on submission acceptance, then
 * refetch the affected queries. This does not imply on-chain settlement.
 */
export function beginPoolOptimisticUpdate(
  client: PoolOptimisticClient,
  patches: readonly PoolOptimisticPatch[],
): PoolOptimisticUpdate {
  const ledger = ledgers.get(client) ?? new Map<string, Entry>();
  ledgers.set(client, ledger);
  const id = Symbol("pool-operation");
  const entries: [string, Entry][] = [];
  for (const patch of patches) {
    const query = client.getQueryCache().find({ queryKey: patch.queryKey, exact: true });
    if (!query || query.state.data === undefined) continue;
    let entry = ledger.get(query.queryHash);
    if (!entry || query.state.data !== entry.projected) {
      entry = { base: query.state.data, projected: query.state.data, layers: [], queryKey: patch.queryKey };
      ledger.set(query.queryHash, entry);
    }
    entry.layers.push({ id, apply: patch.apply, accepted: false });
    project(client, entry);
    entries.push([query.queryHash, entry]);
  }
  let finished = false;
  function finish(accepted: boolean) {
    if (finished) return;
    finished = true;
    for (const [hash, entry] of entries) {
      if (ledger.get(hash) !== entry) continue;
      if (client.getQueryData(entry.queryKey) !== entry.projected) {
        ledger.delete(hash);
        continue;
      }
      const layer = entry.layers.find((layer) => layer.id === id);
      if (!layer) continue;
      if (accepted) layer.accepted = true;
      else entry.layers = entry.layers.filter((layer) => layer.id !== id);
      // Accepted layers stay composed while older operations are unresolved.
      while (entry.layers[0]?.accepted) {
        entry.base = entry.layers.shift()!.apply(entry.base);
      }
      project(client, entry);
      if (!entry.layers.length) ledger.delete(hash);
    }
  }
  return { commit: () => finish(true), rollback: () => finish(false) };
}

function project(client: PoolOptimisticClient, entry: Entry) {
  const value = entry.layers.reduce((current, layer) => layer.apply(current), entry.base);
  client.setQueryData(entry.queryKey, value);
  // React Query may structurally share the object; retain its actual reference.
  entry.projected = client.getQueryData(entry.queryKey);
}
