"use client";

import { Button } from "@/components/button";
import { MicroLabel, Panel, PanelHeader } from "@/components/panel";
import { Pill } from "@/components/pill";
import { Segmented } from "@/components/segmented";
import { DataTable, EmptyState, SkeletonRows } from "@/components/table";
import { usePrismMode } from "@/features/mode/mode-provider";
import { useState } from "react";
import { BlotterRow, ORDER_COLUMNS, POSITION_COLUMNS } from "./blotter-row";
import { PositionGroupRow } from "./position-group-row";
import { usePrismPositions } from "./positions-provider";

const TABS = [
  { value: "positions" as const, label: "Positions" },
  { value: "orders" as const, label: "Open orders" },
];

/**
 * Grouped positions and pending orders from every in-scope account, in one blotter.
 *
 * The rows are interleaved and sorted by recency, not grouped by solver — the
 * merged book is the product. Provenance never gets lost because every row
 * carries its family color, its solver pill and its owning account.
 *
 * ## Why the positions tab is grouped
 *
 * A lowcap account trades under `MARKET_DIRECTION` isolation, where the
 * AccountLayer allocates **one Virtual Account per market per direction**. Two
 * `sendQuote` calls on the same market and the same side therefore land in the
 * same VA, share one pot of margin and one liquidation price, and are closed
 * against the same account. Listing them as two independent rows — as this tab
 * did — describes the quote ledger rather than the position: it showed two SYMM
 * longs at 1× and 2×, with two P&L figures neither of which was what the trader
 * was carrying, and two Margin buttons pointed at the same VA.
 *
 * So the tab folds them with the SDK's `useGroupedQuotes` and expands to the
 * quotes underneath, which is where the per-quote facts still belong — each
 * child keeps its own id, its own fill price, its own exits and its own close.
 * Majors are not an exception to this, they are the degenerate case of it: a
 * cross-margin account has no VAs to share, so it folds through the SDK's own
 * `keyQuotePerQuote` opt-out and every group holds exactly one quote, rendering
 * as the flat row it always was.
 *
 * Resting orders are never folded. A limit order that has not opened has no
 * position to be part of.
 */
export function PositionsBlotter() {
  const [tab, setTab] = useState<"positions" | "orders">("positions");
  const { deployments, isUnified } = usePrismMode();
  const { groups, orders, isLoading, error, isLive, refetch } = usePrismPositions();

  /* An empty blotter in a family mode is ambiguous — flat everywhere, or flat
     only here? The book is scoped to the mode, so the empty state says so. */
  const scopeLabel = isUnified ? undefined : deployments[0]?.label;

  const isOrders = tab === "orders";
  const columns = isOrders ? ORDER_COLUMNS : POSITION_COLUMNS;
  const rowCount = isOrders ? orders.length : groups.length;

  return (
    <Panel className="flex h-full min-h-0 flex-col overflow-hidden xl:min-h-0">
      <PanelHeader
        title={
          <Segmented
            options={TABS.map((entry) => ({
              ...entry,
              label: `${entry.label} ${entry.value === "positions" ? groups.length : orders.length}`,
            }))}
            value={tab}
            onChange={setTab}
            size="sm"
          />
        }
        actions={<FeedTag isLive={isLive} onRefetch={refetch} />}
      />

      <DataTable
        stickyHead
        className="min-h-0 flex-1 overscroll-contain"
        columns={columns}
        head={
          isOrders ? (
            <>
              <MicroLabel>Market</MicroLabel>
              <MicroLabel>Side</MicroLabel>
              <MicroLabel>Size</MicroLabel>
              <MicroLabel>Limit price</MicroLabel>
              <MicroLabel>Placed</MicroLabel>
              <MicroLabel>State</MicroLabel>
              <MicroLabel className="text-right">Action</MicroLabel>
            </>
          ) : (
            <>
              <MicroLabel>Position</MicroLabel>
              <MicroLabel>Side</MicroLabel>
              <MicroLabel>Size</MicroLabel>
              <MicroLabel>Entry</MicroLabel>
              <MicroLabel>Unrealized P&amp;L</MicroLabel>
              <MicroLabel>Exits</MicroLabel>
              <MicroLabel>State</MicroLabel>
              <MicroLabel className="text-right">Action</MicroLabel>
            </>
          )
        }
      >
        {isLoading && rowCount === 0 ? (
          <SkeletonRows columns={columns} rows={3} cells={isOrders ? 7 : 8} />
        ) : error && rowCount === 0 ? (
          /* A failed read is not an empty book. Telling a trader they are flat
             when the app does not know is the worst possible wrong answer. */
          <EmptyState
            className="m-auto py-6"
            title="Couldn't load your positions"
            body={error.message}
            action={
              <Button size="sm" variant="secondary" onClick={refetch}>
                Retry
              </Button>
            }
          />
        ) : rowCount === 0 ? (
          <EmptyState
            className="m-auto py-6"
            title={isOrders ? "No resting orders" : "No open positions"}
            body={
              scopeLabel
                ? `Only ${scopeLabel} is in scope. Open a position from the ticket, or switch to Unified to see every deployment at once.`
                : "Open a position from the ticket and it appears here the moment the solver reports a fill — before the transaction confirms on-chain."
            }
          />
        ) : isOrders ? (
          orders.map((row) => <BlotterRow key={row.rowKey} row={row} variant="order" />)
        ) : (
          groups.map((row) =>
            /* A fold of one is not a fold. Rendering it as a grouped row would
               put a caret on something that has nothing underneath it and a
               "1 quotes" chip next to it — so a single-quote group renders as
               the position row it is, which is also every majors row. */
            row.group.isAggregate ? (
              <PositionGroupRow key={row.rowKey} row={row} />
            ) : row.children[0] ? (
              <BlotterRow key={row.rowKey} row={row.children[0]} />
            ) : null,
          )
        )}
      </DataTable>
    </Panel>
  );
}

/**
 * Where the rows are coming from right now.
 *
 * The reconciler is a live pipeline over a notification socket with an on-chain
 * poll underneath it, and those two states have different latencies. A trader
 * reading a stale row deserves to know which one they are looking at, and gets
 * the manual read as the remedy when the socket is down.
 */
function FeedTag({ isLive, onRefetch }: { isLive: boolean; onRefetch: () => void }) {
  return (
    <div className="flex items-center gap-1.5">
      <Pill
        dot
        color={isLive ? "var(--state-opened)" : "var(--fg-3)"}
        background={isLive ? "color-mix(in srgb, var(--state-opened) 12%, transparent)" : "var(--bg-2)"}
        border={isLive ? "color-mix(in srgb, var(--state-opened) 26%, transparent)" : "var(--border-default)"}
      >
        {isLive ? "Streaming" : "Polling"}
      </Pill>
      <Button size="sm" variant="ghost" onClick={onRefetch} title="Re-read every account's positions">
        <RefreshIcon />
      </Button>
    </div>
  );
}

function RefreshIcon() {
  return (
    <svg viewBox="0 0 14 14" width="12" height="12" fill="none" aria-hidden>
      <path
        d="M12 7a5 5 0 1 1-1.6-3.66M12 1.5V4.5H9"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
