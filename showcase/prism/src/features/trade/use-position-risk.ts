"use client";

import { isCrossMargin } from "@/features/accounts/account-math";
import { marketKey } from "@/features/markets/types";
import { useMergedMarkets } from "@/features/markets/use-merged-markets";
import { usePrismPrices, useTickSignal } from "@/features/prices/price-provider";
import { aggregateGroupUpnl, decimalPriceToWei, type MarginRiskMetrics, type UnifiedQuote } from "@symmio/trading-core";
import { useAccountLiquidationPrice, useAccountMarginRisk } from "@symmio/trading-react";
import { useMemo } from "react";
import type { Address } from "viem";
import { usePrismPositions, type PrismQuote } from "./positions-provider";

/** Which kind of account is the liquidation domain behind a position. */
export type RiskDomain = "virtual-account" | "sub-account";

export interface PositionRisk {
  /**
   * The account these figures describe — the one that gets liquidated.
   * `undefined` when the row has no resolved liquidation domain yet.
   */
  account?: Address;
  /**
   * A Virtual Account for an isolated position, the sub-account for a
   * cross-margin one, and `undefined` for an isolated row that has not been
   * assigned its Virtual Account yet.
   */
  domain?: RiskDomain;
  /** Margin & risk for {@link account}. `undefined` until the balance read lands. */
  metrics?: MarginRiskMetrics;
  /** Signed uPnL of the whole domain, wei. Positive = in profit. */
  upnl: bigint;
  /** `false` while any position in the domain is still unpriced — treat uPnL as unknown. */
  isUpnlComplete: boolean;
  /** Liquidation price of {@link account}, wei. `0n` when unavailable. */
  liquidationPrice: bigint;
  /** How many open positions share this liquidation domain, including this one. */
  positionCount: number;
  /** True when the domain holds positions in more than one market. */
  isMultiMarket: boolean;
  isLoading: boolean;
}

/**
 * Margin, equity and distance to liquidation for the account behind one position.
 *
 * ## Which account that is, is not a solver question
 *
 * A position is liquidated by whichever account holds its collateral, and the
 * quote itself says which: a row that carries a `vaAddress` lives in a Virtual
 * Account of its own, and one that does not is held directly by the sub-account.
 * That is the whole routing rule — the same one the blotter's Margin button
 * uses. Reading it off the deployment instead ("lowcaps are isolated") is the
 * classic majors-integration bug the SDK warns about, and it is wrong in both
 * directions: a cross-margin account on HyperEVM has no VA, and the isolation
 * type is a per-sub-account setting rather than a per-chain one.
 *
 * The consequence is that a cross-margin position's risk figures are **not
 * about the position** — they are about the whole book that shares its buffer.
 * The panel says so rather than implying the numbers are isolated to one trade.
 *
 * ## Why the uPnL is folded here rather than read
 *
 * `calculateMarginRisk` needs the uPnL of the *entire* domain: `equity =
 * allocatedBalance + upnl`, so feeding it one position's uPnL out of several
 * understates equity and every figure below it. The SDK offers `useAccountUpnl`
 * for that, but it mounts a second reconciliation pipeline (on-chain reads, a
 * notification socket) for an account Prism is already reconciling — so instead
 * this folds core's own `aggregateGroupUpnl` over the rows the positions
 * provider is already holding, bucketed by market so each is valued at its own
 * mark. Same arithmetic, from the sockets that are already open.
 */
export function usePositionRisk(row: PrismQuote): PositionRisk {
  const { quotes } = usePrismPositions();
  const { byKey } = useMergedMarkets({ scope: "all" });
  const { tickOf } = usePrismPrices();

  /* The fold reads prices imperatively, so it needs a reason to re-run. One
     throttled signal beats a subscription per market in the domain. */
  const tick = useTickSignal(1000);

  /**
   * The liquidation domain, or nothing.
   *
   * The third case is the one that matters: an **isolated** position that has
   * not anchored on-chain has no Virtual Account yet, and the obvious fallback
   * — `vaAddress ?? partyA` — silently reads the parent sub-account's pot. That
   * is a different liquidation domain with a different balance, and it renders
   * as a confident, wrong margin panel. So it resolves to `undefined` instead,
   * and the panel says the margin locks on anchoring.
   */
  const account = row.quote.vaAddress ?? (isCrossMargin(row.account) ? row.account.address : undefined);
  const domain: RiskDomain | undefined = account
    ? row.quote.vaAddress
      ? "virtual-account"
      : "sub-account"
    : undefined;

  /** Every row liquidated together with this one. */
  const siblings = useMemo(() => {
    if (!account) return [];
    const target = account.toLowerCase();
    return quotes.filter((entry) => (entry.quote.vaAddress ?? entry.quote.partyA).toLowerCase() === target);
  }, [quotes, account]);

  const fold = useMemo(() => {
    /* One bucket per market: `aggregateGroupUpnl` values a whole list against a
       single mark price, which is only meaningful within one market. A
       cross-margin domain routinely spans several. */
    const byMarket = new Map<string, UnifiedQuote[]>();
    for (const entry of siblings) {
      const id = String(entry.quote.symbolId);
      const bucket = byMarket.get(id);
      if (bucket) bucket.push(entry.quote);
      else byMarket.set(id, [entry.quote]);
    }

    let upnl = 0n;
    let valued = 0;
    let unvalued = 0;

    for (const [symbolId, bucket] of byMarket) {
      const market = byKey.get(marketKey(row.family, Number(symbolId)));
      /* The tick's own decimal string, never the store's `number`: a float
         round-trip on a sub-cent lowcap price loses digits that matter at
         18 decimals. */
      const price = market ? tickOf(row.family, market.market.name)?.markPrice : undefined;
      const aggregate = aggregateGroupUpnl(bucket, price ? decimalPriceToWei(price) : undefined);

      upnl += aggregate.upnl;
      valued += aggregate.valuedCount;
      unvalued += aggregate.unvaluedCount;
    }

    return {
      upnl,
      positionCount: valued + unvalued,
      isMultiMarket: byMarket.size > 1,
      /* A flat domain is complete at zero — the SDK's per-group `isComplete` is
         `false` there, because one empty group cannot tell "no PnL" from "PnL
         unknown". Across the whole domain it can: nothing is open. */
      isUpnlComplete: unvalued === 0,
    };
    /* `tick` is the dependency that makes this re-fold as prices move; it is
       read for its identity, not its value. */
  }, [siblings, byKey, tickOf, row.family, tick]);

  const risk = useAccountMarginRisk({
    account,
    upnl: fold.upnl,
    chainId: row.deployment.chainId,
  });

  const liquidation = useAccountLiquidationPrice({ account, chainId: row.deployment.chainId });

  return useMemo(
    () => ({
      account,
      domain,
      metrics: risk.metrics,
      upnl: fold.upnl,
      isUpnlComplete: fold.isUpnlComplete,
      liquidationPrice: liquidation.liquidationPrice,
      positionCount: fold.positionCount,
      isMultiMarket: fold.isMultiMarket,
      isLoading: risk.isLoading || liquidation.isLoading,
    }),
    [account, domain, risk.metrics, risk.isLoading, fold, liquidation.liquidationPrice, liquidation.isLoading],
  );
}
