import type { MarketFamily } from "@/config/deployments";
import type { PrismMarket } from "./types";

/** How many of a book's newest listings wear the `NEW` badge. */
export const NEW_LISTING_COUNT = 12;

/**
 * Families whose books are new-listing-driven.
 *
 * A fresh listing is the whole story on a microcap book and no story at all on
 * BTC, so majors deliberately never carry the badge. Adding a third family that
 * behaves like lowcaps means adding it here and nowhere else.
 */
const NEW_LISTING_FAMILIES: ReadonlySet<MarketFamily> = new Set<MarketFamily>(["lowcaps"]);

/**
 * The row keys that should wear a `NEW` badge.
 *
 * Neither solver publishes a listing timestamp, but `symbolId` is assigned in
 * listing order — so the highest ids in a book are its newest markets. This
 * takes the top {@link NEW_LISTING_COUNT} ids per new-listing family, which
 * keeps the badge scarce enough to still mean something.
 *
 * @param markets The merged book, in any order.
 * @returns Keys (`family:symbolId`) that should render the badge.
 */
export function newListingKeys(markets: readonly PrismMarket[]): ReadonlySet<string> {
  const byFamily = new Map<MarketFamily, PrismMarket[]>();

  for (const entry of markets) {
    if (!NEW_LISTING_FAMILIES.has(entry.family)) continue;
    const bucket = byFamily.get(entry.family);
    if (bucket) bucket.push(entry);
    else byFamily.set(entry.family, [entry]);
  }

  const keys = new Set<string>();
  for (const bucket of byFamily.values()) {
    const newest = [...bucket].sort((a, b) => b.market.symbolId - a.market.symbolId);
    for (const entry of newest.slice(0, NEW_LISTING_COUNT)) keys.add(entry.key);
  }

  return keys;
}
