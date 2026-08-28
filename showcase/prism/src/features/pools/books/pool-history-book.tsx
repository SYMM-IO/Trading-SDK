"use client";

import { MicroLabel } from "@/components/panel";
import { DataRow, DataTable } from "@/components/table";
import { Numeric } from "@/components/value";
import { formatPrice, formatRelativeTime, formatSize } from "@/lib/format";
import { QuoteCloseEventType } from "@symmio/trading-core";
import { usePoolTradeHistory } from "@symmio/trading-react";
import { LifecyclePill } from "../listing-chips";
import {
  IdCell,
  protocolNumber,
  SideCell,
  SUBGRAPH_PAGE_SIZE,
  TableFoot,
  TableStates,
  type TonedLabel,
} from "../pool-table-cells";
import { POOLS_CHAIN_ID, usePoolsSupported } from "../pools-deployment";

/** The history book: quote, side, event, closed size, open, close, closed at. */
const POOL_HISTORY_COLUMNS =
  "minmax(152px,1.1fr) minmax(74px,0.5fr) minmax(156px,1fr) minmax(128px,0.95fr) minmax(116px,0.9fr) minmax(116px,0.9fr) minmax(104px,0.8fr)";

/**
 * How each close event reads in the history book.
 *
 * The event type is what makes a history row distinct, not the quote it belongs
 * to: a quote closed in three parts produces three rows, and whether the last
 * one was a fill or a liquidation is the whole story of that position. So the
 * liquidations take the short color rather than a neutral one.
 */
const CLOSE_EVENT_DISPLAY: Record<QuoteCloseEventType, TonedLabel> = {
  [QuoteCloseEventType.FillClose]: { label: "Close", color: "var(--state-closed)" },
  [QuoteCloseEventType.ForceClose]: { label: "Force close", color: "var(--state-close-pending)" },
  [QuoteCloseEventType.EmergencyClose]: { label: "Emergency close", color: "var(--state-close-pending)" },
  [QuoteCloseEventType.AdlClose]: { label: "Deleveraged", color: "var(--state-locked)" },
  [QuoteCloseEventType.LiquidatePartyA]: { label: "Liquidated · trader", color: "var(--state-liquidated)" },
  [QuoteCloseEventType.LiquidatePartyB]: { label: "Liquidated · solver", color: "var(--state-liquidated)" },
  [QuoteCloseEventType.LiquidateClearingHouse]: {
    label: "Liquidated · clearing house",
    color: "var(--state-liquidated)",
  },
};

/** Display for a close event, tolerating an event type the subgraph added later. */
function closeEventDisplay(type: QuoteCloseEventType | string): TonedLabel {
  return CLOSE_EVENT_DISPLAY[type as QuoteCloseEventType] ?? { label: String(type), color: "var(--fg-3)" };
}

export interface PoolHistoryBookProps {
  /** The pool's solver market, or `null` while it has none — the read's key. */
  symbolId: number | null;
  /** The pool token's ticker, printed after a closed size. */
  ticker?: string;
}

/**
 * One row per close event, not per quote.
 *
 * A quote closed in three parts appears three times, each row carrying that
 * event's own frozen snapshot rather than the quote's final state. Summing the
 * rows is the right way to read them; treating any one of them as "the quote" is
 * not, and it is the mistake the shape invites.
 */
export function PoolHistoryBook({ symbolId, ticker }: PoolHistoryBookProps) {
  const supported = usePoolsSupported();

  /* Mounted only while its own tab is on screen, so the tab half of the gate is
     the mount itself. What is left is the pair a mount cannot answer for: a
     chain carrying no listing backend, and a pool with no market yet — the
     detail read is still in flight when `symbolId` is null here. */
  const history = usePoolTradeHistory({
    symbolId,
    first: SUBGRAPH_PAGE_SIZE,
    chainId: POOLS_CHAIN_ID,
    query: { enabled: supported && symbolId !== null },
  });

  const rows = history.data?.rows ?? [];

  return (
    <>
      <DataTable
        columns={POOL_HISTORY_COLUMNS}
        head={
          <>
            <MicroLabel>Quote</MicroLabel>
            <MicroLabel>Side</MicroLabel>
            <MicroLabel>Event</MicroLabel>
            <MicroLabel className="text-right">Closed size</MicroLabel>
            <MicroLabel className="text-right">Open price</MicroLabel>
            <MicroLabel className="text-right">Close price</MicroLabel>
            <MicroLabel className="text-right">Closed</MicroLabel>
          </>
        }
      >
        <TableStates
          columns={POOL_HISTORY_COLUMNS}
          cells={7}
          isPending={history.isPending}
          error={history.error}
          isEmpty={rows.length === 0}
          book="this pool's trade history"
          emptyTitle="Nothing has closed yet"
          emptyBody="Every close and every liquidation on this market lands here, whoever it belonged to. Open positions stay in the quote book until they do."
        />

        {rows.map((row) => (
          <DataRow key={row.eventId} columns={POOL_HISTORY_COLUMNS}>
            {/* A lowcap quote's `partyA` is its Virtual Account, so the parent
                SubAccount is the address a reader can actually recognise —
                the VA only stands in when the subgraph has no parent for it. */}
            <IdCell
              id={`#${row.quoteId.toString()}`}
              address={row.subAccount ?? row.partyA}
              addressLabel={row.subAccount ? "SubAccount" : "partyA (virtual account)"}
            />

            <SideCell side={row.positionType} />

            <LifecyclePill {...closeEventDisplay(row.closeEventType)} />

            <div className="truncate text-right">
              <Numeric size="sm" tone="strong">
                {formatSize(protocolNumber(row.closedAmount), ticker)}
              </Numeric>
            </div>

            <div className="text-right">
              <Numeric size="sm" tone="muted">
                {formatPrice(protocolNumber(row.openedPrice))}
              </Numeric>
            </div>

            <div className="text-right">
              <Numeric size="sm">{formatPrice(protocolNumber(row.avgClosedPrice))}</Numeric>
            </div>

            <div className="text-right">
              <Numeric size="sm" tone="muted">
                {formatRelativeTime(row.closedAt)}
              </Numeric>
            </div>
          </DataRow>
        ))}
      </DataTable>

      <TableFoot>
        One row per close event, so a quote closed in three parts is three rows — each with that close’s own size and
        price, never the quote’s final state. Newest {SUBGRAPH_PAGE_SIZE} first, across every trader on this market.
      </TableFoot>
    </>
  );
}
