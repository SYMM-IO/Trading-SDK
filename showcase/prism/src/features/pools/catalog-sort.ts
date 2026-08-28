import type { ListingMarketSortField, ListingSortDirection } from "@symmio/trading-core";

/**
 * The catalog columns the listing service can order by.
 *
 * Written as `Extract` over the SDK's wire union rather than as a free string
 * union: these seven are snake_case **wire literals**, not the SDK's camelCase
 * field names, and a typo would otherwise reach the service as an unknown
 * `sort_by` and come back as an unsorted page. The compiler proves each one is
 * a key the service actually accepts.
 */
export type CatalogSortField = Extract<
  ListingMarketSortField,
  "tvl" | "market_cap" | "vol24h" | "liquidity" | "open_interest" | "apr" | "listing_time"
>;

/**
 * Column heads for the sortable fields.
 *
 * `apr` reads as **APY** because that is what the catalog calls its headline
 * yield everywhere else; the field behind it is the service's `apr`, and its
 * descaled value is already a percentage.
 */
export const CATALOG_SORT_LABELS: Record<CatalogSortField, string> = {
  tvl: "TVL",
  vol24h: "24h vol",
  liquidity: "Liquidity",
  market_cap: "Mkt cap",
  open_interest: "Open int.",
  apr: "APY",
  listing_time: "Listed",
};

/** Which column the catalog is ordered by, and in which direction. */
export interface CatalogSort {
  field: CatalogSortField;
  /** Passed to the service as `orderBy` — this sort is never applied client-side. */
  direction: ListingSortDirection;
}

/** The catalog's opening order: deepest pools first. */
export const DEFAULT_CATALOG_SORT: CatalogSort = { field: "tvl", direction: "desc" };

/**
 * The sort a click on `field` should produce.
 *
 * Clicking the active column flips its direction; any other column starts at
 * `desc`. Every sortable column here is a magnitude — money, a rate, or a
 * listing date — and biggest-or-newest-first is the question being asked of all
 * of them, so no column needs its own opening direction.
 *
 * @param current The sort currently in effect.
 * @param field The clicked column.
 * @returns The next sort. Never mutates `current`.
 */
export function nextCatalogSort(current: CatalogSort, field: CatalogSortField): CatalogSort {
  if (current.field !== field) return { field, direction: "desc" };
  return { field, direction: current.direction === "desc" ? "asc" : "desc" };
}
