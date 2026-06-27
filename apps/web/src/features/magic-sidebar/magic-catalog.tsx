"use client";

import {
  useAccountBalanceInfo,
  useInstantOpens,
  usePartyAOpenPositions,
  usePartyAPendingQuotes,
} from "@symm-frontier/react";
import { GroupedQuotesMagicPanel } from "../quotes/grouped-quotes-magic-panel";
import { QuoteHistoryMagicPanel } from "../quotes/quote-history-magic-panel";
import { QuotesMagicPanel } from "../quotes/quotes-magic-panel";
import type { LiveQueryLike } from "./live-result";
import type { MagicMethod } from "./magic-types";
import { makePartyALivePanel, type PartyALiveArgs } from "./make-partya-panel";
import { MarketsLivePanel } from "./markets-panel";
import { NotificationsSocketPanel } from "./notifications-socket-panel";
import { PricesSocketPanel } from "./prices-socket-panel";
import { QuoteLivePanel } from "./quote-panel";

/** Build TanStack `query` overrides for a polled live source. */
function pollOptions(active: boolean, intervalMs: number) {
  return { enabled: active, refetchInterval: active ? intervalMs : false, refetchIntervalInBackground: true } as const;
}

function useInstantOpensLive({ partyA, active, intervalMs }: PartyALiveArgs): LiveQueryLike {
  const q = useInstantOpens({ partyA, query: pollOptions(active, intervalMs) });
  return { data: q.data, dataUpdatedAt: q.dataUpdatedAt, isFetching: q.isFetching, error: q.error };
}

function useOpenPositionsLive({ partyA, active, intervalMs }: PartyALiveArgs): LiveQueryLike {
  const q = usePartyAOpenPositions({ partyA, start: 0n, size: 200n, query: pollOptions(active, intervalMs) });
  return { data: q.data, dataUpdatedAt: q.dataUpdatedAt, isFetching: q.isFetching, error: q.error };
}

function usePendingQuotesLive({ partyA, active, intervalMs }: PartyALiveArgs): LiveQueryLike {
  const q = usePartyAPendingQuotes({ partyA, query: pollOptions(active, intervalMs) });
  return { data: q.data, dataUpdatedAt: q.dataUpdatedAt, isFetching: q.isFetching, error: q.error };
}

function useBalanceInfoLive({ partyA, active, intervalMs }: PartyALiveArgs): LiveQueryLike {
  const q = useAccountBalanceInfo({ account: partyA, query: pollOptions(active, intervalMs) });
  return { data: q.data, dataUpdatedAt: q.dataUpdatedAt, isFetching: q.isFetching, error: q.error };
}

const InstantOpensPanel = makePartyALivePanel({
  idPrefix: "magic-instant-opens",
  label: "partyA (subaccount or VA address)",
  useLiveQuery: useInstantOpensLive,
});

const OpenPositionsPanel = makePartyALivePanel({
  idPrefix: "magic-open-positions",
  label: "partyA (subaccount or VA address)",
  useLiveQuery: useOpenPositionsLive,
});

const PendingQuotesPanel = makePartyALivePanel({
  idPrefix: "magic-pending-quotes",
  label: "partyA (subaccount or VA address)",
  useLiveQuery: usePendingQuotesLive,
});

const BalanceInfoPanel = makePartyALivePanel({
  idPrefix: "magic-balance-info",
  label: "account (subaccount or VA address)",
  useLiveQuery: useBalanceInfoLive,
});

/**
 * Browsable, pinnable SDK methods. Add an entry here (and a matching
 * `magicMethodId` on the method's read card) to make it live-monitorable in the
 * magic sidebar. `source: "socket"` is reserved for live WebSocket feeds.
 */
export const MAGIC_CATALOG: MagicMethod[] = [
  {
    id: "instant-opens",
    label: "Instant opens",
    description: "Pending off-chain instant-open orders for a sub-account, straight from the solver.",
    group: "solver",
    source: "poll",
    keywords: ["instant", "open", "solver", "hedger", "pending", "temp quote"],
    Panel: InstantOpensPanel,
  },
  {
    id: "markets",
    label: "Markets",
    description: "Tradable solver markets — symbols, leverage, fees, and state.",
    group: "solver",
    source: "poll",
    keywords: ["markets", "symbols", "contract symbols", "leverage", "fees"],
    Panel: MarketsLivePanel,
  },
  {
    id: "party-a-open-positions",
    label: "Open positions",
    description: "A partyA's open positions (full Quote structs) on the diamond.",
    group: "onchain",
    source: "poll",
    keywords: ["positions", "open", "quotes", "partyA", "onchain", "diamond"],
    bodyMaxHeight: 460,
    Panel: OpenPositionsPanel,
  },
  {
    id: "party-a-pending-quotes",
    label: "Pending quotes",
    description: "A partyA's pending quote ids (PENDING / LOCKED / CANCEL_PENDING).",
    group: "onchain",
    source: "poll",
    keywords: ["pending", "quotes", "ids", "partyA", "onchain"],
    Panel: PendingQuotesPanel,
  },
  {
    id: "quote",
    label: "Quote by id",
    description: "A single quote (getQuote) hydrated from its id.",
    group: "onchain",
    source: "poll",
    keywords: ["quote", "getQuote", "id", "onchain"],
    Panel: QuoteLivePanel,
  },
  {
    id: "managed-quotes",
    label: "Quotes",
    description:
      "A partyA's full quote feed — on-chain positions, pending instant-opens, and instant-closes reconciled into one lifecycle-tagged list, polled and socket-accelerated.",
    group: "onchain",
    source: "hybrid",
    keywords: ["quotes", "managed", "unified", "positions", "instant", "lifecycle", "reconcile", "partyA", "feed"],
    /** Socket-accelerated feed: default to no idle polling; the notifications socket keeps it live. */
    defaultIntervalMs: 0,
    bodyMaxHeight: 480,
    Panel: QuotesMagicPanel,
  },
  {
    id: "grouped-quotes",
    label: "Grouped positions",
    description:
      "A partyA's managed quotes folded into one row per market + side, with aggregated size, weighted open price, margin, and leverage; each row expands to its underlying quotes.",
    group: "onchain",
    source: "hybrid",
    keywords: ["grouped", "positions", "aggregate", "market", "direction", "leverage", "size", "quotes", "partyA"],
    /** Socket-accelerated feed: default to no idle polling; the notifications socket keeps it live. */
    defaultIntervalMs: 0,
    bodyMaxHeight: 480,
    Panel: GroupedQuotesMagicPanel,
  },
  {
    id: "quote-history",
    label: "History",
    description:
      "A partyA's closed and liquidated quotes from the analytics subgraph — one row per close/liquidation event with its immutable snapshot, filterable by close type.",
    group: "onchain",
    source: "poll",
    keywords: ["history", "closed", "liquidated", "quotes", "subgraph", "events", "close", "partyA", "past"],
    bodyMaxHeight: 480,
    Panel: QuoteHistoryMagicPanel,
  },
  {
    id: "account-balance-info",
    label: "Balance info",
    description: "A sub-account's allocated/locked balance breakdown.",
    group: "onchain",
    source: "poll",
    keywords: ["balance", "margin", "allocated", "locked", "account"],
    Panel: BalanceInfoPanel,
  },
  {
    id: "notifications",
    label: "Notifications",
    description: "Live position & quote state events for a sub-account, pushed over the solver WebSocket.",
    group: "socket",
    source: "socket",
    keywords: ["notifications", "socket", "websocket", "live", "stream", "events", "position state", "instant"],
    bodyMaxHeight: 460,
    Panel: NotificationsSocketPanel,
  },
  {
    id: "prices",
    label: "Prices",
    description:
      "Live mark-price ticks from the Enigma lowcap price WebSocket — every connected client receives the same broadcast.",
    group: "socket",
    source: "socket",
    keywords: ["prices", "price", "mark", "socket", "websocket", "live", "stream", "ticks", "enigma"],
    bodyMaxHeight: 460,
    Panel: PricesSocketPanel,
  },
];

/** Look up a catalog method by id. */
export function findMagicMethod(id: string): MagicMethod | undefined {
  return MAGIC_CATALOG.find((method) => method.id === id);
}
