"use client";

import { MicroLabel } from "@/components/panel";
import { DataRow, DataTable } from "@/components/table";
import { Numeric } from "@/components/value";
import { formatPrice, formatUsd } from "@/lib/format";
import { PoolPositionSide, toPoolPositions, type ListingMarketDetail } from "@symmio/trading-core";
import { useMemo } from "react";
import { listingAmount, listingNumber, listingUsd } from "../listing-values";
import { TableFoot, TableStates } from "../pool-table-cells";

/**
 * The inventory book: side, size, notional, entry, uPnL.
 *
 * Every track carries a `min-content` floor, like every other table in the app,
 * so a long ticker in the size cell cannot shift the numbers out from under
 * their own column heads.
 */
const POOL_INVENTORY_COLUMNS =
  "minmax(104px,0.7fr) minmax(140px,1.1fr) minmax(124px,1fr) minmax(124px,1fr) minmax(124px,1fr)";

export interface PoolInventoryBookProps {
  /** The pool detail read the parent already holds. Reshaped, never refetched. */
  detail?: ListingMarketDetail;
  /** Whether that read is still in flight — this book's only loading signal. */
  isDetailLoading: boolean;
}

/**
 * What the pool itself is carrying.
 *
 * Two rows at most: the listing service reports the book as one long aggregate
 * and one short aggregate, not as a list of trades. So a size here is every
 * trader's size on that side added up, and the entry price is the size-weighted
 * average of all of them.
 */
export function PoolInventoryBook({ detail, isDetailLoading }: PoolInventoryBookProps) {
  const ticker = detail?.tokenTicker ?? undefined;

  /* A pure reshape of the detail the parent already holds — long first, short
     second, absent sides dropped — so the default tab costs no request at all. */
  const rows = useMemo(() => (detail ? toPoolPositions(detail) : []), [detail]);

  return (
    <>
      <DataTable
        columns={POOL_INVENTORY_COLUMNS}
        head={
          <>
            <MicroLabel>Side</MicroLabel>
            <MicroLabel className="text-right">Size</MicroLabel>
            <MicroLabel className="text-right">Position value</MicroLabel>
            <MicroLabel className="text-right">Entry price</MicroLabel>
            <MicroLabel className="text-right">Unrealized P&amp;L</MicroLabel>
          </>
        }
      >
        <TableStates
          columns={POOL_INVENTORY_COLUMNS}
          cells={5}
          isPending={isDetailLoading && rows.length === 0}
          error={null}
          isEmpty={rows.length === 0}
          book="this pool's inventory"
          emptyTitle="Nothing open against this pool"
          emptyBody="The listing service reports neither a long nor a short aggregate. The first position a trader opens on this market puts a row here."
        />

        {rows.map((row) => {
          const isLong = row.side === PoolPositionSide.LONG;

          return (
            <DataRow key={row.side} columns={POOL_INVENTORY_COLUMNS}>
              <span className={isLong ? "text-sm font-semibold text-long" : "text-sm font-semibold text-short"}>
                {isLong ? "Longs" : "Shorts"}
              </span>

              <div className="truncate text-right">
                <Numeric size="sm" tone="strong">
                  {listingAmount(row.size)}
                </Numeric>
                {ticker ? <span className="ml-1 text-2xs text-fg-3">{ticker}</span> : null}
              </div>

              <div className="text-right">
                <Numeric size="sm">{listingUsd(row.value)}</Numeric>
              </div>

              {/* An entry price goes through the price formatter, not the money
                  one: a microcap opens at $0.0000284 and `formatUsd` rounds
                  every such pool's entry to `$0.00`. */}
              <div className="text-right">
                <Numeric size="sm">{formatPrice(listingNumber(row.avgOpenPrice))}</Numeric>
              </div>

              <div className="text-right">
                <Numeric size="sm" signed={listingNumber(row.upnl)}>
                  {formatUsd(listingNumber(row.upnl), { signed: true })}
                </Numeric>
              </div>
            </DataRow>
          );
        })}
      </DataTable>

      <TableFoot>
        Two aggregates, not a list of trades — one long total and one short total for the whole pool, reshaped from the
        detail read with no second request. Unrealized P&amp;L is the pool’s own and is the one figure here that is
        routinely negative.
      </TableFoot>
    </>
  );
}
