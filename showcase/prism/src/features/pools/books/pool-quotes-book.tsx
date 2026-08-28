"use client";

import { MicroLabel } from "@/components/panel";
import { DataRow, DataTable } from "@/components/table";
import { Numeric } from "@/components/value";
import { formatPrice, formatRelativeTime, formatSize } from "@/lib/format";
import { POOL_OPEN_QUOTE_STATUSES } from "@symmio/trading-core";
import { usePoolQuotes } from "@symmio/trading-react";
import {
  IdCell,
  protocolNumber,
  SideCell,
  sideFromOrdinal,
  SUBGRAPH_PAGE_SIZE,
  TableFoot,
  TableStates,
} from "../pool-table-cells";
import { POOLS_CHAIN_ID, usePoolsSupported } from "../pools-deployment";

/** The open-quote book: quote, side, size, requested, opened, closed, when. */
const POOL_QUOTE_COLUMNS =
  "minmax(152px,1.2fr) minmax(74px,0.5fr) minmax(128px,0.95fr) minmax(116px,0.9fr) minmax(116px,0.9fr) minmax(116px,0.9fr) minmax(104px,0.8fr)";

export interface PoolQuotesBookProps {
  /** The pool's solver market, or `null` while it has none — the read's key. */
  symbolId: number | null;
  /** The pool token's ticker, printed after a size. Absent until detail lands. */
  ticker?: string;
}

/**
 * Every live position on the market, one row each.
 *
 * Filtered to status `4` (opened) rather than to the SDK's default pending
 * statuses: a pending quote is accepted within seconds, so the default filter
 * renders an empty table on a busy pool and reads as "nobody is trading this".
 */
export function PoolQuotesBook({ symbolId, ticker }: PoolQuotesBookProps) {
  const supported = usePoolsSupported();

  /* This book is mounted only while its own tab is on screen, so the tab half
     of the gate is the mount itself. What is left is the pair a mount cannot
     answer for: a chain carrying no listing backend, and a pool with no market
     yet — the detail read is still in flight when `symbolId` is null here. */
  const quotes = usePoolQuotes({
    symbolId,
    quoteStatuses: POOL_OPEN_QUOTE_STATUSES,
    first: SUBGRAPH_PAGE_SIZE,
    chainId: POOLS_CHAIN_ID,
    query: { enabled: supported && symbolId !== null },
  });

  const rows = quotes.data?.quotes ?? [];

  return (
    <>
      <DataTable
        columns={POOL_QUOTE_COLUMNS}
        head={
          <>
            <MicroLabel>Quote</MicroLabel>
            <MicroLabel>Side</MicroLabel>
            <MicroLabel className="text-right">Size</MicroLabel>
            <MicroLabel className="text-right">Requested</MicroLabel>
            <MicroLabel className="text-right">Opened</MicroLabel>
            <MicroLabel className="text-right">Closed</MicroLabel>
            <MicroLabel className="text-right">Updated</MicroLabel>
          </>
        }
      >
        <TableStates
          columns={POOL_QUOTE_COLUMNS}
          cells={7}
          isPending={quotes.isPending}
          error={quotes.error}
          isEmpty={rows.length === 0}
          book="this pool's open quotes"
          emptyTitle="No open positions on this pool"
          emptyBody="Every quote the subgraph holds at status opened would be listed here, whoever opened it. Nothing is open right now."
        />

        {rows.map((row) => (
          <DataRow key={row.id} columns={POOL_QUOTE_COLUMNS}>
            <IdCell id={`#${row.quoteId.toString()}`} address={row.partyA} addressLabel="partyA" />

            <SideCell side={sideFromOrdinal(row.positionType)} />

            <div className="truncate text-right">
              <Numeric size="sm" tone="strong">
                {formatSize(protocolNumber(row.quantity), ticker)}
              </Numeric>
            </div>

            <div className="text-right">
              <Numeric size="sm" tone="muted">
                {formatPrice(protocolNumber(row.requestedOpenPrice))}
              </Numeric>
            </div>

            <div className="text-right">
              <Numeric size="sm">{formatPrice(protocolNumber(row.openedPrice))}</Numeric>
            </div>

            <div className="text-right">
              <Numeric size="sm" tone="muted">
                {formatSize(protocolNumber(row.closedAmount))}
              </Numeric>
            </div>

            <div className="text-right">
              <Numeric size="sm" tone="muted">
                {formatRelativeTime(row.timestamp)}
              </Numeric>
            </div>
          </DataRow>
        ))}
      </DataTable>

      <TableFoot>
        The pool’s whole book, not yours — the address under each quote id is the account that opened it. Sizes and
        prices here are on the protocol’s own 18-decimal scale, not the listing service’s. Newest {SUBGRAPH_PAGE_SIZE}{" "}
        first.
      </TableFoot>
    </>
  );
}
