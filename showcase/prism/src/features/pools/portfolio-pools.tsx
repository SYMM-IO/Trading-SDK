import { YourPoolsPanel } from "./your-pools-panel";

/**
 * "Your liquidity → Pools": the pools this wallet has a door into.
 *
 * One panel and the footnote that keeps its numbers honest. The panel was a
 * cramped block on the pools index before it had a page — a fixed 25 rows, no
 * search, no filters, no pager — and everything it gained here is the listing
 * service's own: the same `search-user` endpoint the catalog's `search` sits
 * on, with the same server-side narrowing, ordering and paging. Nothing on this
 * page filters or re-sorts an array the service already answered.
 */
export function PortfolioPools() {
  return (
    <>
      <YourPoolsPanel />

      <p className="max-w-[104ch] px-1 text-2xs text-fg-3">
        A row is a pool that has minted this wallet a deposit address, not a pool holding this wallet’s money — the
        status column is what separates the two, which is why the status filter opens unnarrowed. A dash is the service
        reporting nothing and never means <span className="tnum">$0</span>. Claimable is a second read, taken per pool,
        so it can be blank for a moment while the row beside it is already whole; it is shown to four decimals because a
        few days of yield on a small deposit is worth fractions of a dollar, and a rounded{" "}
        <span className="tnum">$0.00</span> beside a live Claim button would contradict the button.
      </p>
    </>
  );
}
