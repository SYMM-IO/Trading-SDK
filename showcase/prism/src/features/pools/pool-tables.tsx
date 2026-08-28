"use client";

import { Button } from "@/components/button";
import { Panel, PanelHeader } from "@/components/panel";
import { Segmented } from "@/components/segmented";
import { EmptyState } from "@/components/table";
import type { ListingDepositChainId, ListingMarketDetail } from "@symmio/trading-core";
import { useState } from "react";
import { PoolHistoryBook } from "./books/pool-history-book";
import { PoolInventoryBook } from "./books/pool-inventory-book";
import { PoolQuotesBook } from "./books/pool-quotes-book";
import { PoolTransfersBook } from "./books/pool-transfers-book";
import { PoolTriggersBook } from "./books/pool-triggers-book";
import { usePoolsSupported } from "./pools-deployment";

/** Which book is on screen. Only this one is allowed to fetch. */
type PoolTableTab = "inventory" | "quotes" | "triggers" | "history" | "transactions";

const TABS: readonly { value: PoolTableTab; label: string }[] = [
  { value: "inventory", label: "Inventory" },
  { value: "quotes", label: "Open quotes" },
  { value: "triggers", label: "Triggers" },
  { value: "history", label: "Trade history" },
  { value: "transactions", label: "Transfers" },
];

/**
 * Which service answers the active tab.
 *
 * Four different backends sit behind these five tables and they disagree about
 * almost everything — scale, paging, whether a missing figure is `null` or `0`.
 * Naming the one in play is what keeps the panel honest about being a seam
 * rather than a single product surface.
 */
const TAB_SOURCES: Record<PoolTableTab, string> = {
  inventory: "listing service · market detail · reshaped locally, no extra request",
  quotes: "analytics subgraph · quotes, quoteStatus 4",
  triggers: "tp/sl handler · POST /api/v5/search/",
  history: "analytics subgraph · quoteEvents",
  transactions: "listing service · paged /{start}/{size}",
};

export interface PoolTablesProps {
  /** The pool's token contract address — base58 on Solana, `0x…` elsewhere. */
  address: string;
  /** The token's own deposit chain, which is not the chain the perp settles on. */
  chainId: ListingDepositChainId;
  /** The pool's solver market, or `null` while it has none. */
  symbolId: number | null;
  /** The pool detail read, which the inventory tab renders without refetching. */
  detail?: ListingMarketDetail;
  isDetailLoading: boolean;
}

/**
 * The pool's five books.
 *
 * Every one of them is **pool-wide**: the inventory is the pool's own aggregate,
 * and the other four are every trader's rows on this market rather than the
 * connected wallet's. That is why each row carries somebody's address, and it is
 * the reason none of these reads takes an account — a pool page is a public
 * ledger, and it renders identically with no wallet attached.
 *
 * This component is only the shell. Each book owns its own columns, read, rows
 * and caveats in `./books/`, and only the open tab is mounted — so switching
 * tabs costs one request rather than five, and a pool page opens with none of
 * them in flight but the detail read the parent already made.
 */
export function PoolTables({ address, chainId, symbolId, detail, isDetailLoading }: PoolTablesProps) {
  const supported = usePoolsSupported();
  const [tab, setTab] = useState<PoolTableTab>("inventory");

  const ticker = detail?.tokenTicker ?? undefined;

  /* Three tabs are market-scoped and one is not. While the detail read is still
     in flight `symbolId` is null for a reason that has nothing to do with the
     pool, so the "no market" note waits for the answer rather than flashing. */
  const marketMissing =
    !isDetailLoading && symbolId === null && (tab === "quotes" || tab === "triggers" || tab === "history");

  return (
    <Panel>
      <PanelHeader eyebrow="Pool activity" title="Books" />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line-subtle px-4 py-2.5">
        <Segmented className="shrink-0" options={TABS} value={tab} onChange={setTab} size="sm" />
        <p className="min-w-0 font-mono text-2xs text-fg-3">{TAB_SOURCES[tab]}</p>
      </div>

      {!supported ? (
        <EmptyState
          title="No listing backend on this chain"
          body="The pools chain carries no listing block in the SDK's chain registry, so none of these books can be read. Nothing here is erroring — every query is idle."
        />
      ) : marketMissing ? (
        <NoMarketNote onShowTransfers={() => setTab("transactions")} />
      ) : tab === "inventory" ? (
        <PoolInventoryBook detail={detail} isDetailLoading={isDetailLoading} />
      ) : tab === "quotes" ? (
        <PoolQuotesBook symbolId={symbolId} ticker={ticker} />
      ) : tab === "triggers" ? (
        <PoolTriggersBook symbolId={symbolId} ticker={ticker} />
      ) : tab === "history" ? (
        <PoolHistoryBook symbolId={symbolId} ticker={ticker} />
      ) : (
        <PoolTransfersBook address={address} chainId={chainId} ticker={ticker} />
      )}
    </Panel>
  );
}

/**
 * The pool has no solver market yet.
 *
 * Three of the five books are keyed by `symbolId`, so a pool still waiting on
 * its listing has nothing to put in them — but its deposits and withdrawals are
 * already real, which is where the reader is sent.
 */
function NoMarketNote({ onShowTransfers }: { onShowTransfers: () => void }) {
  return (
    <EmptyState
      title="No solver market yet"
      body="This pool has no symbolId, so it has no book, no trigger orders and no trade history — nothing has ever traded against it. Its deposits and withdrawals exist from the moment it was created."
      action={
        <Button size="sm" variant="secondary" onClick={onShowTransfers}>
          Show transfers
        </Button>
      }
    />
  );
}
