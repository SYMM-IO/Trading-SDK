"use client";

import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { Address } from "viem";

/** Whether the session key may trade for one account, as its row last saw it. */
export type TradingAccessState = "ready" | "missing" | "checking";

/** One account's live figures, as reported by its ledger row. */
export interface AccountMetrics {
  /**
   * Signed uPnL in 18-decimal wei. `undefined` while any open position is still
   * unpriced — the SDK deliberately withholds a half-priced sum, and this screen
   * propagates that rather than showing a wrong total.
   */
  upnl?: bigint;
  openPositionCount: number;
  /** Whether the session key is authorised to trade for this account. */
  access: TradingAccessState;
}

/** Aggregated figures over a set of accounts. */
export interface PortfolioTotals {
  /** Σ uPnL, or `undefined` when any contributing account is still unpriced. */
  upnl?: bigint;
  openPositions: number;
  /** True once every account in the set has reported. */
  complete: boolean;
}

/** How many of a set of accounts have authorised the session key. */
export interface TradingAccessTally {
  ready: number;
  /** Accounts still probing, or whose row has not reported yet. */
  checking: number;
  total: number;
}

interface PortfolioMetricsValue {
  byAccount: Readonly<Record<string, AccountMetrics>>;
  report: (account: Address, metrics: AccountMetrics) => void;
  forget: (account: Address) => void;
}

const PortfolioMetricsContext = createContext<PortfolioMetricsValue | undefined>(undefined);

/**
 * Collects per-account figures so the page's summaries can total them.
 *
 * `useAccountUpnl` and the delegation probes are hooks, and a hook cannot be
 * called in a loop — so the only way to read N accounts is to mount N
 * components. Each ledger row calls its hooks once for itself and reports the
 * result here; the header reads the uPnL sum and the session-key strip reads
 * the access tally. That keeps exactly one pipeline per account and no
 * duplicate reads.
 */
export function PortfolioMetricsProvider({ children }: { children: ReactNode }) {
  const [byAccount, setByAccount] = useState<Record<string, AccountMetrics>>({});

  const report = useCallback((account: Address, metrics: AccountMetrics) => {
    setByAccount((current) => {
      const existing = current[account];
      if (
        existing &&
        existing.upnl === metrics.upnl &&
        existing.openPositionCount === metrics.openPositionCount &&
        existing.access === metrics.access
      ) {
        return current;
      }
      return { ...current, [account]: metrics };
    });
  }, []);

  const forget = useCallback((account: Address) => {
    setByAccount((current) => {
      if (!(account in current)) return current;
      const next = { ...current };
      delete next[account];
      return next;
    });
  }, []);

  const value = useMemo<PortfolioMetricsValue>(() => ({ byAccount, report, forget }), [byAccount, report, forget]);

  return <PortfolioMetricsContext.Provider value={value}>{children}</PortfolioMetricsContext.Provider>;
}

function useMetricsContext(): PortfolioMetricsValue {
  const context = useContext(PortfolioMetricsContext);
  if (!context) {
    throw new Error("Portfolio metrics must be used inside <PortfolioMetricsProvider>.");
  }
  return context;
}

/** Register this account's figures with the page's summaries. */
export function usePortfolioMetricsRegistry(): Pick<PortfolioMetricsValue, "report" | "forget"> {
  return useMetricsContext();
}

/**
 * Total uPnL and open-position count over a set of accounts.
 *
 * Summing uPnL across accounts is safe — it is a plain signed figure. Summing
 * *margin risk* is not, which is why that stays per-account (see
 * `margin-risk-meter.tsx`).
 */
export function usePortfolioTotals(addresses: readonly Address[]): PortfolioTotals {
  const { byAccount } = useMetricsContext();

  return useMemo(() => {
    let upnl: bigint | undefined = 0n;
    let openPositions = 0;
    let complete = true;

    for (const address of addresses) {
      const entry = byAccount[address];
      if (!entry) {
        complete = false;
        continue;
      }
      openPositions += entry.openPositionCount;
      if (entry.upnl === undefined) upnl = undefined;
      else if (upnl !== undefined) upnl += entry.upnl;
    }

    return { upnl, openPositions, complete };
  }, [addresses, byAccount]);
}

/**
 * How many of these accounts the session key may already trade for.
 *
 * Read by the session-key strip, which cannot probe the accounts itself — the
 * probes are hooks, one set per account, and they live in the rows.
 */
export function useTradingAccessTally(addresses: readonly Address[]): TradingAccessTally {
  const { byAccount } = useMetricsContext();

  return useMemo(() => {
    let ready = 0;
    let checking = 0;

    for (const address of addresses) {
      const entry = byAccount[address];
      if (!entry || entry.access === "checking") checking += 1;
      else if (entry.access === "ready") ready += 1;
    }

    return { ready, checking, total: addresses.length };
  }, [addresses, byAccount]);
}
