"use client";

import type { Deployment, MarketFamily } from "@/config/deployments";
import { isCrossMargin } from "@/features/accounts/account-math";
import { useFundingAccounts, type FundingAccount } from "@/features/accounts/account-provider";
import { usePrismMode } from "@/features/mode/mode-provider";
import {
  keyQuotePerQuote,
  supportsQuoteGrouping,
  type QuoteGroup,
  type QuoteGroupingStrategy,
  type SocketStatus,
  type UnifiedQuote,
} from "@symmio/trading-core";
import { useGroupedQuotes } from "@symmio/trading-react";
import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

/**
 * The opt-out fold: one single-child group per quote.
 *
 * Module-level because `useGroupedQuotes` recomputes its groups whenever the
 * strategy object changes identity, and a fresh `{ keyOf }` per render would do
 * that on every render.
 */
const PER_QUOTE: QuoteGroupingStrategy = { keyOf: keyQuotePerQuote };

/** A reconciled quote, tagged with the account and deployment it belongs to. */
export interface PrismQuote {
  quote: UnifiedQuote;
  deployment: Deployment;
  family: MarketFamily;
  /** The sub-account that owns it — a wallet can hold several per chain. */
  account: FundingAccount;
  /** Unique across the merged set — `key` alone can repeat across chains. */
  rowKey: string;
}

/**
 * A grouped position — the SDK's fold over several quotes that share a market,
 * a direction and a Virtual Account — tagged the same way a flat row is.
 */
export interface PrismGroup {
  /** The SDK's `QuoteGroup`: child quotes, resolved VA, and pure aggregated metrics. */
  group: QuoteGroup;
  deployment: Deployment;
  family: MarketFamily;
  account: FundingAccount;
  /** The group's child quotes, each tagged like a flat row so a child renders as one. */
  children: PrismQuote[];
  /** Unique across the merged set — a group key repeats across accounts and chains. */
  rowKey: string;
  /**
   * `true` when this account's isolation actually folds positions on-chain, so
   * the children really do share one Virtual Account. `false` for a cross-margin
   * account, where the fold is the per-quote opt-out and every group holds one.
   */
  isGrouped: boolean;
}

interface Slice {
  quotes: readonly UnifiedQuote[];
  /** Active positions, folded under this account's isolation. */
  groups: readonly QuoteGroup[];
  /** Resting orders, never grouped. */
  pending: readonly UnifiedQuote[];
  /** Whether this account's isolation is the one that folds positions on-chain. */
  isGrouped: boolean;
  isLoading: boolean;
  error: Error | null;
  socketStatus: SocketStatus;
  refetch: () => void;
}

interface PositionsContextValue {
  /** Every reconciled quote across every in-scope account, newest first. */
  quotes: readonly PrismQuote[];
  /** Active positions as grouped rows, newest first — the blotter's positions tab. */
  groups: readonly PrismGroup[];
  /** Resting orders, flat and newest first — the blotter's orders tab. */
  orders: readonly PrismQuote[];
  isLoading: boolean;
  /** The first failure any feed reported. A failed read is not "no positions". */
  error: Error | null;
  /** True when at least one deployment's notification socket is live. */
  isLive: boolean;
  /** Force every feed to refetch. */
  refetch: () => void;
}

const PositionsContext = createContext<PositionsContextValue | undefined>(undefined);

/**
 * Reconciled positions and orders across every in-scope account.
 *
 * Scope follows the palette mode, like every other data surface: `unified` fans
 * out over both deployments, a family mode narrows to one. A lowcap screen that
 * lists a majors position — under the lowcap palette, next to a lowcap chart and
 * a lowcap ticket — is offering an action the rest of the screen cannot honour.
 *
 * `useGroupedQuotes` is a stateful pipeline (on-chain reads + hedger feeds + a
 * live notification socket), not a plain fetch, so it cannot go through
 * `useDeploymentQueries` — and a hook cannot be called in a loop. One subscriber
 * *component* per account is how it gets mounted N times.
 *
 * The unit is the **account**, not the deployment. Reading only the selected
 * account meant a wallet with two sub-accounts on a chain saw one account's rows
 * and an unqualified "no open positions" for the other, while the portfolio
 * counted both — two screens disagreeing about the same wallet.
 *
 * For a VA-isolated account the reconciler fans out again internally, across the
 * sub-account's Virtual Accounts, because lowcap positions are owned by a VA
 * rather than by the sub-account. A cross-margin account has no VAs at all, so
 * that leg is switched off rather than left to resolve addresses no trade will
 * ever land in.
 */
export function PositionsProvider({ children }: { children: ReactNode }) {
  const { deployments } = usePrismMode();
  const { accounts } = useFundingAccounts();
  const [slices, setSlices] = useState<Record<string, Slice>>({});

  /* Compared field by field, never by object identity. `useGroupedQuotes`
     returns a fresh `refetch` closure on most renders, so an identity check
     would store a new slice every render, re-render the provider, and loop
     forever — the classic subscriber-component footgun. */
  const report = useCallback((address: string, slice: Slice) => {
    setSlices((current) => {
      const previous = current[address];
      if (
        previous &&
        previous.quotes === slice.quotes &&
        previous.groups === slice.groups &&
        previous.pending === slice.pending &&
        previous.isGrouped === slice.isGrouped &&
        previous.isLoading === slice.isLoading &&
        previous.error === slice.error &&
        previous.socketStatus === slice.socketStatus
      ) {
        return current;
      }
      return { ...current, [address]: slice };
    });
  }, []);

  const forget = useCallback((address: string) => {
    setSlices((current) => {
      if (!(address in current)) return current;
      const next = { ...current };
      delete next[address];
      return next;
    });
  }, []);

  /* Scoping the merge alone would hide the out-of-scope rows while still
     paying for them: the reconciler is a live pipeline, so an unmounted-from-
     view account would keep an on-chain fan-out and a notification socket
     running for nothing. Narrowing the subscriber set is what actually stops
     the work — the same thing `useDeploymentQueries` does for plain reads. */
  const scopedAccounts = useMemo(
    () => accounts.filter((account) => deployments.some((deployment) => deployment.family === account.family)),
    [accounts, deployments],
  );

  const value = useMemo<PositionsContextValue>(() => {
    const mergedQuotes: PrismQuote[] = [];
    const mergedGroups: PrismGroup[] = [];
    const mergedOrders: PrismQuote[] = [];
    let error: Error | null = null;
    let isLoading = false;
    let isLive = false;

    for (const deployment of deployments) {
      for (const account of scopedAccounts) {
        if (account.family !== deployment.family) continue;
        const slice = slices[account.address];
        if (!slice) continue;

        isLoading ||= slice.isLoading;
        isLive ||= slice.socketStatus === "open";
        error ??= slice.error;

        for (const quote of slice.quotes) mergedQuotes.push(tagQuote(quote, deployment, account));
        for (const quote of slice.pending) mergedOrders.push(tagQuote(quote, deployment, account));

        for (const group of slice.groups) {
          mergedGroups.push({
            group,
            deployment,
            family: deployment.family,
            account,
            children: group.quotes.map((quote) => tagQuote(quote, deployment, account)),
            rowKey: `${account.address}:${group.key}`,
            isGrouped: slice.isGrouped,
          });
        }
      }
    }

    mergedQuotes.sort((a, b) => sortKey(b.quote) - sortKey(a.quote));
    mergedOrders.sort((a, b) => sortKey(b.quote) - sortKey(a.quote));
    /* By the group's newest child, matching `groupQuotes`' own default order —
       the merge across accounts is what re-sorting restores. */
    mergedGroups.sort((a, b) => groupSortKey(b.group) - groupSortKey(a.group));

    return {
      quotes: mergedQuotes,
      groups: mergedGroups,
      orders: mergedOrders,
      isLoading,
      error,
      isLive,
      refetch: () => {
        for (const slice of Object.values(slices)) slice.refetch();
      },
    };
  }, [slices, deployments, scopedAccounts]);

  console.log("value", value);
  return (
    <PositionsContext.Provider value={value}>
      {scopedAccounts.map((account) => (
        <AccountPositions key={account.address} account={account} onSlice={report} onUnmount={forget} />
      ))}
      {children}
    </PositionsContext.Provider>
  );
}

interface SliceProps {
  account: FundingAccount;
  onSlice: (address: string, slice: Slice) => void;
  onUnmount: (address: string) => void;
}

/**
 * One account's reconciled quote feed, folded into grouped positions.
 *
 * The fold follows the sub-account's **isolation type**, which is the only thing
 * that decides whether a market + side cohort is a real on-chain unit. Under
 * `MARKET_DIRECTION` the AccountLayer allocates one Virtual Account per market
 * per direction, so folding that cohort into one row aggregates values that
 * genuinely belong together — and a group close acts on quotes that really do
 * share a VA. Every other isolation gets the SDK's documented opt-out,
 * `keyQuotePerQuote`, which renders each position through the same `QuoteGroup`
 * shape without merging anything. That is why majors rows keep working: a
 * cross-margin account is not "grouping unsupported", it is a fold of one.
 */
function AccountPositions({ account, onSlice, onUnmount }: SliceProps) {
  const isGrouped = supportsQuoteGrouping(account.detail.isolationType);

  const { quotes, groups, pending, isLoading, error, socketStatus, refetch } = useGroupedQuotes({
    partyA: account.address,
    chainId: account.deployment.chainId,
    /* A cross-margin sub-account owns its positions directly. Asking for its
       Virtual Accounts anyway is a per-render on-chain read for an address the
       trade will never land in. */
    includeVirtualAccounts: !isCrossMargin(account),
    strategy: isGrouped ? account.detail.isolationType : PER_QUOTE,
  });

  const slice = useMemo(
    () => ({ quotes, groups, pending, isGrouped, isLoading, error, socketStatus, refetch }),
    [quotes, groups, pending, isGrouped, isLoading, error, socketStatus, refetch],
  );

  useEffect(() => {
    onSlice(account.address, slice);
  }, [account.address, slice, onSlice]);

  useEffect(() => () => onUnmount(account.address), [account.address, onUnmount]);

  return null;
}

/** Tag one reconciled quote with the account and deployment it settles on. */
function tagQuote(quote: UnifiedQuote, deployment: Deployment, account: FundingAccount): PrismQuote {
  return {
    quote,
    deployment,
    family: deployment.family,
    account,
    rowKey: `${account.address}:${quote.key}`,
  };
}

/** Newest activity first: last status change, falling back to creation. */
function sortKey(quote: UnifiedQuote): number {
  return Number(quote.statusModifyTimestamp ?? quote.createTimestamp ?? 0n);
}

/** A group is as recent as its newest child — `groupQuotes` sorts children first. */
function groupSortKey(group: QuoteGroup): number {
  return group.quotes[0] ? sortKey(group.quotes[0]) : 0;
}

/** Read the merged position/order set. */
export function usePrismPositions(): PositionsContextValue {
  const context = useContext(PositionsContext);
  if (!context) {
    throw new Error("usePrismPositions must be used inside <PositionsProvider>.");
  }
  return context;
}
