"use client";

import { isCrossMargin } from "@/features/accounts/account-math";
import type { PrismMarket } from "@/features/markets/types";
import { useMarkTick } from "@/features/prices/price-provider";
import { decimalPriceToWei } from "@symmio/trading-core";
import { useQuoteGroupMarginRisk } from "@symmio/trading-react";
import { useMemo } from "react";
import type { PrismGroup } from "./positions-provider";
import type { PositionRisk, RiskDomain } from "./use-position-risk";

/**
 * Margin, equity and distance to liquidation for a **grouped** position.
 *
 * The per-quote twin, `usePositionRisk`, has to fold its domain by hand: one
 * quote says nothing about the other positions liquidated with it, so it
 * gathers its siblings out of the positions provider first. A group already
 * *is* that set. Under `MARKET_DIRECTION` isolation the AccountLayer allocates
 * one Virtual Account per market per direction, which is exactly what the group
 * is keyed on — so the group's children are the whole book of its VA, and the
 * SDK's own `useQuoteGroupMarginRisk` can answer directly.
 *
 * Two things are handed to it that its defaults would get wrong here:
 *
 * - **The mark price**, pinned to the group's own market family. Left to
 *   resolve its own feed, the hook follows the *connected* chain — which in a
 *   two-deployment book values a lowcap position against a majors tick.
 * - **The chain**, for the same reason: the balance and liquidation reads have
 *   to land on the deployment the group settles on, not on the one the wallet
 *   happens to be sitting on.
 *
 * The result is shaped as the per-quote {@link PositionRisk} so both sheets
 * render through one `PositionRiskSection` — the group's figures and its
 * children's cannot drift apart if they are the same component.
 *
 * ## The domain is resolved here, not taken from the hook
 *
 * `useQuoteGroupMarginRisk` falls back to `partyA` when a group has no Virtual
 * Account yet. That is the parent sub-account: a different liquidation domain
 * with a different balance, rendered as a confident, wrong margin panel. An
 * all-optimistic group has not been assigned its VA, so this reports **no
 * domain** instead and the panel says the margin locks on anchoring.
 *
 * A cross-margin account never reaches here in practice — it folds through the
 * per-quote opt-out, so every one of its groups holds a single quote and renders
 * as a flat row. If it ever did, `equity` would cover only the group's own uPnL
 * against the whole account's balance, which is the caveat the SDK states.
 */
export function useGroupRisk(row: PrismGroup, market?: PrismMarket): PositionRisk {
  const tick = useMarkTick(row.family, market?.market.name ?? "");
  const markPrice = tick?.markPrice;

  /* `decimalPriceToWei` rather than a `Number` hop: a lowcap mark lands around
     1e-7, and the fold underneath is exact-bigint arithmetic that a float
     round-trip would quietly coarsen. */
  const markWei = markPrice === undefined ? undefined : decimalPriceToWei(markPrice);

  const account = row.group.vaAddress ?? (isCrossMargin(row.account) ? row.account.address : undefined);
  const domain: RiskDomain | undefined = account
    ? row.group.vaAddress
      ? "virtual-account"
      : "sub-account"
    : undefined;

  const risk = useQuoteGroupMarginRisk({
    group: row.group,
    account,
    markPrice: markWei,
    chainId: row.deployment.chainId,
  });

  return useMemo(
    () => ({
      account,
      domain,
      /* Withheld along with the domain: without a resolved account the hook has
         still read *something* — the parent sub-account — and that number
         describes a pot this position's margin is not in. */
      metrics: domain ? risk.metrics : undefined,
      upnl: risk.upnl.upnl,
      /* "Nothing valued" is not "complete at zero" for a group that holds
         positions — the same distinction the row's `partial` tag draws. */
      isUpnlComplete: risk.upnl.unvaluedCount === 0,
      liquidationPrice: risk.liquidationPrice,
      positionCount: risk.upnl.valuedCount + risk.upnl.unvaluedCount,
      /* A group is keyed on one market, so its liquidation price describes the
         direction it actually holds. */
      isMultiMarket: false,
      isLoading: risk.isLoading,
    }),
    [account, domain, risk.metrics, risk.upnl, risk.liquidationPrice, risk.isLoading],
  );
}
