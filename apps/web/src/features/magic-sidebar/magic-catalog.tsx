"use client";

import {
  useAccountBalanceInfo,
  useInstantOpens,
  usePartyAOpenPositions,
  usePartyAPendingQuotes,
} from "@symm-frontier/react";
import type { LiveQueryLike } from "./live-result";
import type { MagicMethod } from "./magic-types";
import { makePartyALivePanel, type PartyALiveArgs } from "./make-partya-panel";
import { MarketsLivePanel } from "./markets-panel";
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
    id: "account-balance-info",
    label: "Balance info",
    description: "A sub-account's allocated/locked balance breakdown.",
    group: "onchain",
    source: "poll",
    keywords: ["balance", "margin", "allocated", "locked", "account"],
    Panel: BalanceInfoPanel,
  },
];

/** Look up a catalog method by id. */
export function findMagicMethod(id: string): MagicMethod | undefined {
  return MAGIC_CATALOG.find((method) => method.id === id);
}
