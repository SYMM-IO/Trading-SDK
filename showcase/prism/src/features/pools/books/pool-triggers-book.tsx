"use client";

import { MicroLabel } from "@/components/panel";
import { DataRow, DataTable } from "@/components/table";
import { Numeric } from "@/components/value";
import { formatPrice, formatRelativeTime, formatSize } from "@/lib/format";
import { TpSlSearchOrderType } from "@symmio/trading-core";
import { useSearchTpSlOrders, useTpSlSupported } from "@symmio/trading-react";
import { IdCell, SideCell, sideFromOrdinal, TableFoot, TableStates } from "../pool-table-cells";
import { POOLS_CHAIN_ID, POOLS_DEPLOYMENT, usePoolsSupported } from "../pools-deployment";

/** The trigger book: order, side, quantity, trigger, price, state, created. */
const POOL_TRIGGER_COLUMNS =
  "minmax(164px,1.2fr) minmax(74px,0.5fr) minmax(128px,0.95fr) minmax(116px,0.9fr) minmax(116px,0.9fr) minmax(128px,0.8fr) minmax(104px,0.8fr)";

export interface PoolTriggersBookProps {
  /** The pool's solver market, or `null` while it has none — the read's key. */
  symbolId: number | null;
  /** The pool token's ticker, printed after a quantity. */
  ticker?: string;
}

/**
 * Orders waiting off-chain for a price to print.
 *
 * These are `send_quote` conditional orders held by the TP/SL handler — a
 * trigger that *opens* a position — and they are a different mechanism from a
 * protocol limit order, which the lowcap solver does not support. Nothing here
 * exists on-chain until its trigger fires, which is why none of it appears in
 * the quote book.
 */
export function PoolTriggersBook({ symbolId, ticker }: PoolTriggersBookProps) {
  const supported = usePoolsSupported();

  /* This book is the one that does NOT come from the listing backend, so the
     listing gate is the wrong question for it: the handler is resolved from the
     chain's own `tpsl` block and throws `TPSL_NOT_CONFIGURED` on a chain
     without one. The SDK ships a gate for exactly that, and it is what the rest
     of Prism uses before touching a conditional order. */
  const tpslSupported = useTpSlSupported({
    chainId: POOLS_CHAIN_ID,
    solverId: POOLS_DEPLOYMENT.solverId,
  });

  /* Mounted only while its own tab is on screen, so the tab half of the gate is
     the mount itself. `symbolId !== null` is load-bearing here in a way it is
     not for the other reads: the handler treats every filter as optional, so a
     search that lost its `symbolId` would come back with every market's trigger
     orders rather than with nothing. The other two short-circuit inside the SDK. */
  const triggers = useSearchTpSlOrders({
    symbolId: symbolId ?? undefined,
    conditionalOrderType: TpSlSearchOrderType.SEND_QUOTE,
    chainId: POOLS_CHAIN_ID,
    query: { enabled: supported && tpslSupported && symbolId !== null },
  });

  const rows = triggers.data?.orders ?? [];

  return (
    <>
      <DataTable
        columns={POOL_TRIGGER_COLUMNS}
        head={
          <>
            <MicroLabel>Order</MicroLabel>
            <MicroLabel>Side</MicroLabel>
            <MicroLabel className="text-right">Quantity</MicroLabel>
            <MicroLabel className="text-right">Trigger</MicroLabel>
            <MicroLabel className="text-right">Price</MicroLabel>
            <MicroLabel>State</MicroLabel>
            <MicroLabel className="text-right">Created</MicroLabel>
          </>
        }
      >
        <TableStates
          columns={POOL_TRIGGER_COLUMNS}
          cells={7}
          isPending={triggers.isPending}
          error={triggers.error}
          isEmpty={rows.length === 0}
          book="this pool's trigger orders"
          emptyTitle="Nothing waiting on a trigger"
          emptyBody="No trader is holding a trigger-to-open order on this market. One appears the moment somebody arms a price the market has not reached yet."
        />

        {rows.map((row) => (
          <DataRow key={row.coh_quote_id} columns={POOL_TRIGGER_COLUMNS}>
            <IdCell id={row.coh_quote_id} address={row.party_a_address} addressLabel="partyA" />

            <SideCell side={sideFromOrdinal(row.position_type)} />

            {/* Handler rows are plain JS numbers, not fixed point. Running
                `fromWei` over one would divide a real quantity into dust. */}
            <div className="truncate text-right">
              <Numeric size="sm" tone="strong">
                {formatSize(row.quantity, ticker)}
              </Numeric>
            </div>

            <div className="text-right">
              <Numeric size="sm" tone="accent">
                {formatPrice(row.conditional_order_price)}
              </Numeric>
            </div>

            <div className="text-right">
              <Numeric size="sm" tone="muted">
                {formatPrice(row.price)}
              </Numeric>
            </div>

            {/* The handler's own word for the state, passed through unmapped —
                Prism has no lifecycle of its own to claim for these. */}
            <span className="truncate font-mono text-2xs text-fg-2">{row.state}</span>

            <div className="text-right">
              <Numeric size="sm" tone="muted">
                {formatRelativeTime(row.create_time)}
              </Numeric>
            </div>
          </DataRow>
        ))}
      </DataTable>

      <TableFoot>
        Trigger-to-open orders held by the TP/SL handler, across every trader on this market — not protocol limit
        orders, which this solver does not support. Quantities and prices arrive as plain numbers rather than fixed
        point, and the state column is the handler’s own vocabulary.
      </TableFoot>
    </>
  );
}
