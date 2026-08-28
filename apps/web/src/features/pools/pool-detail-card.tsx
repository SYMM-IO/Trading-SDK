"use client";

import { ResultError, ResultNote } from "@/components/result";
import { POOL_OPEN_QUOTE_STATUSES, TpSlSearchOrderType, type ListingDepositChainId } from "@symmio/trading-core";
import {
  useListingMarketDetail,
  usePoolQuotes,
  usePoolTradeHistory,
  usePoolTransactions,
  useSearchTpSlOrders,
} from "@symmio/trading-react";
import { useState } from "react";
import { MethodCard } from "../inspector/method-card";
import { Segmented, type SegmentedOption } from "../integration/segmented";
import { PoolLimitOrdersTable } from "./detail-tables/pool-limit-orders-table";
import { PoolPositionsTable } from "./detail-tables/pool-positions-table";
import { PoolQuotesTable } from "./detail-tables/pool-quotes-table";
import { PoolTradeHistoryTable } from "./detail-tables/pool-trade-history-table";
import { PoolTransactionsTable } from "./detail-tables/pool-transactions-table";
import { usePoolScope } from "./pool-scope";

/** The tabs of a pool's detail section, each backed by a different SDK read. */
type DetailTab = "positions" | "openQuotes" | "limitOrders" | "tradeHistory" | "transactions";

/**
 * Tab labels carry the hook that fills them, so the page stays honest about
 * which of the three backends each table came from.
 */
const TABS: readonly SegmentedOption<DetailTab>[] = [
  { value: "positions", label: "Positions" },
  { value: "openQuotes", label: "Open quotes" },
  { value: "limitOrders", label: "Limit orders" },
  { value: "tradeHistory", label: "Trade history" },
  { value: "transactions", label: "Deposits & withdrawals" },
];

/** Which SDK hook backs each tab — rendered under the tab strip. */
const TAB_SOURCE: Record<DetailTab, string> = {
  positions: "useListingMarketDetail + toPoolPositions · listing backend",
  openQuotes: "usePoolQuotes · analytics subgraph",
  limitOrders: "useSearchTpSlOrders · TP/SL handler",
  tradeHistory: "usePoolTradeHistory · analytics subgraph",
  transactions: "usePoolTransactions · listing backend",
};

/**
 * One pool's detail tables.
 *
 * The pool comes from the section's shared picker ({@link usePoolScope}), and
 * the five tables below it come from **three** different
 * backends — the listing service holds the inventory and the cash movements, the
 * analytics subgraph holds the quote book and realized history, and the TP/SL
 * handler holds the pending trigger-to-open orders. The strip under the tabs
 * names the source for whichever one is open.
 *
 * Every table here is pool-wide rather than account-scoped: these are all
 * traders' rows on the market, which is why no wallet connection is required and
 * why the account columns are shown at all.
 */
export function PoolDetailCard() {
  const { contractAddress, market, hasPool } = usePoolScope();
  const [tab, setTab] = useState<DetailTab>("positions");

  const symbolId = market?.symbolId ?? null;

  const detail = useListingMarketDetail({
    tokenContractAddress: contractAddress,
    depositChain: (market?.chainId ?? 0) as ListingDepositChainId,
    query: { enabled: hasPool },
  });

  const openQuotes = usePoolQuotes({
    symbolId,
    /**
     * Opened quotes — every live position on the market, one row each. The
     * Positions tab is the *aggregate* of these per side; this is the list. A
     * pending quote is accepted within seconds, so filtering to pending here
     * would show an empty tab against a busy market.
     */
    quoteStatuses: POOL_OPEN_QUOTE_STATUSES,
    query: { enabled: hasPool && tab === "openQuotes" },
  });

  const limitOrders = useSearchTpSlOrders({
    symbolId: symbolId ?? undefined,
    conditionalOrderType: TpSlSearchOrderType.SEND_QUOTE,
    query: { enabled: hasPool && symbolId !== null && tab === "limitOrders" },
  });

  const tradeHistory = usePoolTradeHistory({
    symbolId,
    query: { enabled: hasPool && tab === "tradeHistory" },
  });

  const transactions = usePoolTransactions({
    marketAddress: contractAddress,
    size: 100,
    query: { enabled: hasPool && tab === "transactions" },
  });

  const error = detail.error ?? openQuotes.error ?? limitOrders.error ?? tradeHistory.error ?? transactions.error;

  return (
    <MethodCard
      testId="pool-detail"
      name="Pool detail"
      mutability="view"
      description="One pool's inventory, quote book, pending orders, realized history and cash movements — five reads across three backends."
      wide
    >
      <div className="flex flex-col gap-4">
        {!hasPool ? (
          <ResultNote testId="pool-detail-idle">Pick a pool above to see its tables.</ResultNote>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              <Segmented groups={[TABS]} value={tab} onChange={setTab} aria-label="Pool detail tables" />
              <p className="text-muted-foreground font-mono text-xs" data-testid="pool-detail-source">
                {TAB_SOURCE[tab]}
              </p>
            </div>

            {symbolId === null && tab !== "transactions" ? (
              <ResultNote testId="pool-detail-unlisted">
                This pool has no solver market yet, so it has no book, orders or history — only its deposits and
                withdrawals exist.
              </ResultNote>
            ) : error ? (
              <ResultError kind={error.kind} message={error.message} testId="pool-detail-error" />
            ) : (
              <>
                {tab === "positions" ? <PoolPositionsTable detail={detail.data} isPending={detail.isPending} /> : null}
                {tab === "openQuotes" ? (
                  <PoolQuotesTable
                    testId="pool-open-quotes-table"
                    quotes={openQuotes.data?.quotes ?? []}
                    isPending={openQuotes.isPending}
                    emptyMessage="No open quotes on this pool."
                  />
                ) : null}
                {tab === "limitOrders" ? (
                  <PoolLimitOrdersTable orders={limitOrders.data?.orders ?? []} isPending={limitOrders.isPending} />
                ) : null}
                {tab === "tradeHistory" ? (
                  <PoolTradeHistoryTable rows={tradeHistory.data?.rows ?? []} isPending={tradeHistory.isPending} />
                ) : null}
                {tab === "transactions" ? (
                  <PoolTransactionsTable
                    transactions={transactions.data?.items ?? []}
                    isPending={transactions.isPending}
                  />
                ) : null}
              </>
            )}
          </>
        )}
      </div>
    </MethodCard>
  );
}
