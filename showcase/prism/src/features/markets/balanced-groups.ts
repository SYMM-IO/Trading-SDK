import { DEPLOYMENTS, type MarketFamily } from "@/config/deployments";
import type { PrismMarket } from "./types";

/** One family's slice of a budgeted list. */
export interface FamilyGroup {
  family: MarketFamily;
  /** The deployment's product name, e.g. `Majors`. */
  label: string;
  /** The rows this family contributes to the visible list. */
  shown: readonly PrismMarket[];
  /** How many rows the family matched, before the budget was applied. */
  matched: number;
}

/**
 * Split a merged list into per-family groups that share a row budget fairly.
 *
 * The merged book is sorted by `maxNotionalValue`, which is a **per-solver**
 * tier and not a figure the two families can be ranked against each other by:
 * every lowcap listing carries a larger max notional than every majors listing,
 * so a flat "first N rows" slice of 897 markets is 60 lowcaps and no majors at
 * all — the unified book silently renders as one family.
 *
 * Budgeting instead round-robins across the families, one row at a time, so
 * both are always represented and a family with fewer matches than its share
 * hands the remainder back rather than padding the list with blanks. Each
 * family keeps its own incoming order, so the deepest majors (BTC, ETH) still
 * lead their group.
 *
 * @param markets Matched rows from the merged book, in display order.
 * @param budget How many rows may be shown in total across all families.
 * @returns One group per family present, in deployment-registry order.
 */
export function groupByFamily(markets: readonly PrismMarket[], budget: number): FamilyGroup[] {
  const buckets = new Map<MarketFamily, PrismMarket[]>();

  for (const entry of markets) {
    const bucket = buckets.get(entry.family);
    if (bucket) bucket.push(entry);
    else buckets.set(entry.family, [entry]);
  }

  const families = DEPLOYMENTS.filter((deployment) => buckets.has(deployment.family));
  const pools = families.map((deployment) => buckets.get(deployment.family) ?? []);
  const taken = pools.map(() => [] as PrismMarket[]);

  let remaining = budget;
  let drew = true;

  /* One pass per round: each family takes a single row, so a short family runs
     dry and the rest keep drawing until the budget is spent. */
  while (remaining > 0 && drew) {
    drew = false;
    for (let index = 0; index < pools.length && remaining > 0; index += 1) {
      const next = pools[index][taken[index].length];
      if (!next) continue;
      taken[index].push(next);
      remaining -= 1;
      drew = true;
    }
  }

  return families.map((deployment, index) => ({
    family: deployment.family,
    label: deployment.label,
    shown: taken[index],
    matched: pools[index].length,
  }));
}
