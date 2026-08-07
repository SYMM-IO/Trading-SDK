"use client";

import {
  aggregateGroupUpnl,
  decimalPriceToWei,
  type ConfigParameter,
  type MarginRiskMetrics,
  type QuoteGroup,
  type QuoteGroupUpnl,
} from "@symmio/trading-core";
import { useMemo } from "react";
import type { Address } from "viem";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useAccountMarginRisk } from "../margin/use-account-margin-risk";
import { useEnigmaPriceByMarketId } from "../price-service/use-enigma-price-by-market-id";
import { useAccountLiquidationPrice } from "./use-account-liquidation-price";

/**
 * Parameters for {@link useQuoteGroupMarginRisk}.
 */
export interface UseQuoteGroupMarginRiskParameters extends ConfigParameter {
  /** The merged position to describe. */
  group: QuoteGroup;
  /**
   * Mark price override, 18-decimal wei. Omit to subscribe to the group's
   * market. Pass it when the surrounding screen already holds the price, so the
   * two do not open separate subscriptions or disagree by a tick.
   */
  markPrice?: bigint;
  /**
   * Account override; defaults to the group's resolved Virtual Account. The uPnL
   * fold narrows to this account's children too, so `equity` stays consistent.
   */
  account?: Address;
  /**
   * Refetch the balance when an open/close settles on-chain.
   * @default true
   */
  live?: boolean;
  /** Optional override; defaults to the connected chain. */
  chainId?: number;
  /**
   * Run the underlying reads only when `true` — gate a panel that is collapsed.
   * @default true
   */
  enabled?: boolean;
}

/**
 * Return type of {@link useQuoteGroupMarginRisk}.
 */
export interface UseQuoteGroupMarginRiskReturnType {
  /**
   * Margin & risk for the group's liquidation domain. `undefined` while the
   * balance read is in flight, **or** whenever the group spans several accounts
   * ({@link isMultiAccount}) — blending liquidation domains is never correct.
   */
  metrics?: MarginRiskMetrics;
  /**
   * The group's aggregated unrealized PnL at {@link markPrice}. Check
   * `upnl.isComplete` before presenting anything derived from it as final.
   */
  upnl: QuoteGroupUpnl;
  /** Liquidation price of the resolved account, wei. `0n` when unavailable. */
  liquidationPrice: bigint;
  /** The mark price actually used, wei; `undefined` before the first tick. */
  markPrice?: bigint;
  /** The account {@link metrics} and {@link liquidationPrice} describe. */
  account?: Address;
  /** Distinct liquidation domains among the group's children (`vaAddress ?? partyA`). */
  accounts: Address[];
  /**
   * `true` when the group's children live in more than one account. Each is
   * liquidated independently, so {@link metrics} is suppressed — fan out with
   * `useAccountMarginRisk` over {@link accounts} instead.
   */
  isMultiAccount: boolean;
  /** `true` while the balance, positions, or price reads are loading. */
  isLoading: boolean;
  /** Normalized request error, when one occurred. */
  error: SymmioRequestError | null;
}

/**
 * Margin and liquidation-risk state of a merged position — the group-level
 * counterpart of `useAccountMarginRisk`.
 *
 * Resolves the group's Virtual Account, folds its children's unrealized PnL
 * against the mark price with core's `aggregateGroupUpnl`, and runs both through
 * `calculateMarginRisk`. The account's liquidation price comes from the existing
 * `useAccountLiquidationPrice`. All arithmetic lives in core; this hook only
 * wires the reads to the folds.
 *
 * **Mark price**: injected wins. Pass `markPrice` (wei) and no price
 * subscription is opened; omit it and the hook subscribes to the group's market.
 *
 * **One liquidation domain per result.** A group normally maps 1:1 to a Virtual
 * Account, because the built-in grouping strategies mirror the sub-account's
 * on-chain isolation type. When it does not — a custom `keyOf`, or grouping by
 * `MARKET` an account isolated by `MARKET_DIRECTION` — `isMultiAccount` is `true`
 * and `metrics` is withheld rather than blended: an account at 2% buffer averaged
 * with one at 200% reads as safe while the first is about to be liquidated.
 *
 * **Equity is exact only when the group covers the account's whole book.**
 * `equity = allocatedBalance + upnl` mixes an account-wide balance with the
 * group's uPnL. That is the same figure the reference app shows, and it is exact
 * whenever the grouping strategy matches the sub-account's isolation type. Group
 * a `MARKET`-isolated account by `MARKET_DIRECTION` and each group is a *subset*
 * of its account, which understates equity — the hook cannot detect that without
 * a second read, so it is stated rather than guessed at.
 *
 * @param parameters - The group, plus optional price/account/chain/config overrides.
 * @returns The group's metrics, uPnL, liquidation price, and query state.
 *
 * @example
 * ```tsx
 * function GroupRisk({ group }: { group: QuoteGroup }) {
 *   const { metrics, upnl, liquidationPrice } = useQuoteGroupMarginRisk({ group });
 *   if (!metrics) return <Skeleton />;
 *   // The three margin rows are uPnL-independent — render them even while
 *   // `upnl.isComplete` is false; gate only equity and the buffer on it.
 *   return <MarginRows metrics={metrics} live={upnl.isComplete} liq={liquidationPrice} />;
 * }
 * ```
 */
export function useQuoteGroupMarginRisk(
  parameters: UseQuoteGroupMarginRiskParameters,
): UseQuoteGroupMarginRiskReturnType {
  const { group, markPrice: markPriceOverride, live = true, chainId, enabled = true, config } = parameters;
  const quotes = group.quotes;

  /** One entry per liquidation domain the children live in, in first-appearance order. */
  const accounts = useMemo(() => {
    const seen = new Set<string>();
    const result: Address[] = [];
    for (const quote of quotes) {
      const address = quote.vaAddress ?? quote.partyA;
      const key = address.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(address);
    }
    return result;
  }, [quotes]);

  const isMultiAccount = accounts.length > 1;
  const account = parameters.account ?? group.vaAddress ?? accounts[0];

  /**
   * Narrowing to the resolved account is what keeps `equity` honest: without it
   * an `account` override would fold every child's uPnL against one account's
   * balance.
   */
  const children = useMemo(() => {
    if (account === undefined) return quotes;
    const target = account.toLowerCase();
    return quotes.filter((quote) => (quote.vaAddress ?? quote.partyA).toLowerCase() === target);
  }, [quotes, account]);

  /** `by.symbolId` is unset under a custom `keyOf`; the children still carry the market. */
  const symbolId = group.by.symbolId ?? quotes[0]?.symbolId;

  const priceQuery = useEnigmaPriceByMarketId({
    marketId: symbolId ?? 0n,
    enabled: enabled && markPriceOverride === undefined && symbolId !== undefined,
    chainId,
    config,
  });

  /**
   * `decimalPriceToWei` returns `undefined` rather than `0n` for a feed that has
   * not ticked — a fabricated `0n` would report a total loss.
   */
  const markPrice = markPriceOverride ?? decimalPriceToWei(priceQuery.markPrice ?? "");

  const upnl = useMemo(() => aggregateGroupUpnl(children, markPrice), [children, markPrice]);

  const risk = useAccountMarginRisk({
    /** A blended multi-account figure would be misleading, so do not even read for it. */
    account: isMultiAccount ? undefined : account,
    upnl: upnl.upnl,
    live,
    chainId,
    config,
  });

  const liquidation = useAccountLiquidationPrice({ account, chainId, config });

  const isPriceLoading = markPriceOverride === undefined && priceQuery.isLoading;

  return useMemo(
    () => ({
      /**
       * Withheld explicitly, not merely by leaving the read idle: suppressing a
       * blended cross-account figure is this hook's contract, so it must not
       * depend on how the account hook happens to behave without an account.
       */
      metrics: isMultiAccount ? undefined : risk.metrics,
      upnl,
      liquidationPrice: liquidation.liquidationPrice,
      markPrice,
      account,
      accounts,
      isMultiAccount,
      isLoading: risk.isLoading || liquidation.isLoading || isPriceLoading,
      error: risk.error,
    }),
    [
      risk.metrics,
      risk.isLoading,
      risk.error,
      upnl,
      liquidation.liquidationPrice,
      liquidation.isLoading,
      markPrice,
      account,
      accounts,
      isMultiAccount,
      isPriceLoading,
    ],
  );
}
