"use client";

import { calculateQuoteUpnlWei, isActivePosition, type ConfigParameter, type SolverId } from "@symmio/trading-core";
import { useCallback, useMemo } from "react";
import type { Address } from "viem";
import { parseUnits } from "viem";
import { useMarkets } from "../markets/use-markets";
import { usePrices } from "../price-service/use-prices";
import { useManagedQuotes } from "./use-managed-quotes";

/**
 * Parameters for {@link useAccountUpnl}.
 */
export interface UseAccountUpnlParameters extends ConfigParameter {
  /** The partyA whose open positions are summed. Disabled while undefined. */
  account?: Address;
  /** Target chain id. Defaults to the SDK's active chain. */
  chainId?: number;
  /** Solver whose markets + price provider value the positions. Defaults to the chain's default solver. */
  solverId?: SolverId;
  /** Compute only when `true`. Default `true`. */
  enabled?: boolean;
  /**
   * Subscribe to the account's live notifications so the position set tracks
   * opens/closes (and off-chain quotes anchoring on-chain) without a manual
   * refresh. Mark prices are always live via the price socket.
   * @default false
   */
  live?: boolean;
}

/**
 * Value returned by {@link useAccountUpnl}.
 */
export interface UseAccountUpnlReturnType {
  /**
   * Σ unrealized PnL across the account's open positions — on-chain **and**
   * off-chain (optimistic instant-opens) — signed wei. `undefined` until every
   * priced position has a live mark price, so a half-priced sum is never
   * mistaken for the real figure.
   */
  upnl: bigint | undefined;
  /** Number of open positions contributing to the sum (`0` ⇒ `upnl` is `0n`). */
  openPositionCount: number;
  /** True while positions or markets are still loading. */
  isLoading: boolean;
  /** Refetch the underlying position + market reads (prices are a live socket). */
  refetch: () => Promise<void>;
}

/**
 * The account-level unrealized PnL, computed **inside the SDK** — no oracle
 * round-trip: each open position's uPnL is `openQuantity × (mark − open)`
 * (sign by side, via `calculateQuoteUpnlWei`) against the live mark price of
 * whichever provider serves the resolved solver, and the account total is the
 * sum. Positions come from the **managed (unified) pipeline**, so off-chain
 * optimistic opens count from the moment they exist and hand over seamlessly
 * once they anchor on-chain. Feed `upnl` to `calculateAvailableForOrder` for
 * the spendable balance of a cross-margin account.
 *
 * A position without any price reference, with nothing left open, or whose
 * market has no live tick yet keeps `upnl` at `undefined` until it is priced;
 * an optimistic open is valued at its settled fill price when known, else its
 * requested price.
 *
 * @example
 * ```tsx
 * const { upnl } = useAccountUpnl({ account: subAccount, live: true });
 * const available =
 *   balanceInfo && upnl !== undefined
 *     ? calculateAvailableForOrder({ balanceInfo, upnl })
 *     : undefined;
 * ```
 */
export function useAccountUpnl(parameters: UseAccountUpnlParameters = {}): UseAccountUpnlReturnType {
  const { account, chainId, solverId, enabled = true, live = false, ...rest } = parameters;

  // The unified pipeline: on-chain reads + off-chain instant-ops + live
  // notifications reconciled into one lifecycle-tagged list. It owns the
  // "off-chain quote became on-chain" transition this hook relies on.
  const managed = useManagedQuotes({
    partyA: account,
    chainId,
    live,
    enabled: enabled && Boolean(account),
  });
  const marketsQuery = useMarkets({ ...rest, chainId, solverId });

  const { refetch: refetchManaged } = managed;
  const { refetch: refetchMarkets } = marketsQuery;
  const refetch = useCallback(async () => {
    refetchManaged();
    await refetchMarkets();
  }, [refetchManaged, refetchMarkets]);

  /** Open positions (both origins) that can carry uPnL: open size + a price reference. */
  const openPositions = useMemo(
    () =>
      managed.quotes.filter(
        (quote) =>
          isActivePosition(quote) && quote.openQuantity > 0n && (quote.openedPrice ?? quote.requestedOpenPrice) > 0n,
      ),
    [managed.quotes],
  );

  const nameBySymbolId = useMemo(() => {
    const map = new Map<string, string>();
    for (const market of marketsQuery.data ?? []) {
      if (market.symbolId !== undefined && market.name) map.set(String(market.symbolId), market.name);
    }
    return map;
  }, [marketsQuery.data]);

  const names = useMemo(() => {
    const unique = new Set<string>();
    for (const position of openPositions) {
      const name = nameBySymbolId.get(String(position.symbolId));
      if (name) unique.add(name);
    }
    return [...unique];
  }, [openPositions, nameBySymbolId]);

  const { ticks } = usePrices({
    ...rest,
    chainId,
    solverId,
    names,
    enabled: enabled && names.length > 0,
  });

  const upnl = useMemo<bigint | undefined>(() => {
    if (openPositions.length === 0) return 0n;
    let total = 0n;
    for (const position of openPositions) {
      const name = nameBySymbolId.get(String(position.symbolId));
      const markPriceDecimal = name ? ticks[name]?.markPrice : undefined;
      if (markPriceDecimal === undefined) return undefined;
      let markPrice: bigint;
      try {
        markPrice = parseUnits(markPriceDecimal, 18);
      } catch {
        return undefined;
      }
      total += calculateQuoteUpnlWei({
        positionType: position.positionType,
        openQuantity: position.openQuantity,
        // Settled fill price when known; an unfilled optimistic open is valued at its requested price.
        openedPrice: position.openedPrice ?? position.requestedOpenPrice,
        markPrice,
      });
    }
    return total;
  }, [openPositions, nameBySymbolId, ticks]);

  return {
    upnl,
    openPositionCount: openPositions.length,
    isLoading: managed.isLoading || marketsQuery.isLoading,
    refetch,
  };
}
