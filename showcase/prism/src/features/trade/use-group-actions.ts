"use client";

import { useToast } from "@/components/toast";
import type { PrismMarket } from "@/features/markets/types";
import { useMarkTick } from "@/features/prices/price-provider";
import { useDescribeRequestError } from "@/features/sdk/describe-request-error";
import { useChainGate } from "@/features/wallet/use-chain-gate";
import { useTradingDelegation } from "@/features/wallet/use-trading-delegation";
import { marketLabel } from "@/lib/format";
import { QuoteLifecycle, toGroupCloseCandidates, type PlanGroupCloseFailureReason } from "@symmio/trading-core";
import { useCloseQuoteGroup } from "@symmio/trading-react";
import { useMemo } from "react";
import { parseUnits } from "viem";
import type { PrismGroup } from "./positions-provider";

/** Decimals every `UnifiedQuote` amount is denominated in. */
const WEI_DECIMALS = 18;

/** Stages before a quote has an on-chain id — the planner has nothing to name. */
const OPENING: readonly QuoteLifecycle[] = [
  QuoteLifecycle.OPTIMISTIC,
  QuoteLifecycle.PRICE_FILLED,
  QuoteLifecycle.WRITE_ONCHAIN,
];

/** Stages where a close is already in flight. */
const CLOSING: readonly QuoteLifecycle[] = [
  QuoteLifecycle.OPTIMISTIC_CLOSE,
  QuoteLifecycle.CLOSE_PRICE_FILLED,
  QuoteLifecycle.WRITE_ONCHAIN_CLOSE,
];

export interface GroupActions {
  /** Chain-switch state for the group's deployment. */
  gate: ReturnType<typeof useChainGate>;
  /** Session-key delegation state for the group's account. */
  delegation: ReturnType<typeof useTradingDelegation>;
  /** Every child is still being opened — there is nothing on-chain to close. */
  isOpening: boolean;
  /** A close is in flight, either this run's or one already reported on a child. */
  isClosing: boolean;
  /**
   * Σ open size across the children a close order can actually name, wei — not
   * the group's whole open size. See {@link useGroupActions}.
   */
  closeableQuantity: bigint;
  /** `true` when part of the group cannot be closed in this run and will be left open. */
  isPartialClose: boolean;
  /** Quantity-weighted completion of the run in flight, `0`–`100`. */
  progressPercent: number;
  /** Close the whole group at market, child by child, in one bulk request. */
  close: () => void;
}

/**
 * Everything a grouped position row can *do*, in one place.
 *
 * A group close is not a loop of single closes. `useCloseQuoteGroup` first plans
 * the allocation across children — largest first, and every partially closed
 * child keeps at least the symbol's `minAcceptableQuoteValue` so the plan cannot
 * leave dust the solver would refuse — and only then submits **every** child in
 * one bulk request. A plan that cannot hit the target exactly fails without
 * closing anything, which is the behaviour worth having: half a closed position
 * is worse than a refused one, because the trader believes they are flat.
 *
 * The gates are the ones the single-row ladder already resolves, and for the
 * same reasons: a close is signed by the session key and relayed by the solver
 * over HTTP, so it never touches the browser wallet and needs no chain switch.
 * Only the grant that authorises the key is a transaction.
 */
export function useGroupActions(row: PrismGroup, market?: PrismMarket): GroupActions {
  const toast = useToast();
  const { deployment, account, group } = row;
  const gate = useChainGate(deployment);
  const delegation = useTradingDelegation(account);
  const describeError = useDescribeRequestError(deployment);
  const run = useCloseQuoteGroup();

  const tick = useMarkTick(row.family, market?.market.name ?? "");
  const name = market ? marketLabel(market.market.symbol, market.market.name) : `#${group.by.symbolId}`;

  const isOpening = group.quotes.every((quote) => OPENING.includes(quote.lifecycle));
  const isClosing = run.isClosing || group.quotes.some((quote) => CLOSING.includes(quote.lifecycle));

  /**
   * The size this run can actually close — deliberately **not**
   * `metrics.openQuantity`.
   *
   * `toGroupCloseCandidates` is the same filter the planner runs, and it is
   * stricter than "has open size": a child has to be anchored on-chain and sitting
   * at `OPENED` to receive a close order, so a sibling that is still opening, or
   * that already has a close in flight, is not addressable. Asking for the group's
   * full open size when one leg is unaddressable makes the plan infeasible
   * (`exceeds-open`) and closes **nothing** — a Close button that reliably does
   * nothing on exactly the rows a trader is most anxious about.
   */
  const closeableQuantity = useMemo(() => {
    if (!market) return 0n;
    const candidates = toGroupCloseCandidates(
      group.quotes,
      parseUnits(market.market.minAcceptableQuoteValue, WEI_DECIMALS),
    );
    return candidates.reduce((total, candidate) => total + candidate.openQuantity, 0n);
  }, [group.quotes, market]);

  const isPartialClose = closeableQuantity > 0n && closeableQuantity < group.metrics.openQuantity;

  function close() {
    if (!market) {
      toast.push({
        title: "Market not loaded",
        body: `This position's market (#${group.by.symbolId}) is not in the merged book yet. Try again in a moment.`,
        tone: "error",
      });
      return;
    }
    if (!delegation.sessionKey) return;

    if (closeableQuantity <= 0n) return;

    const pending = toast.push({
      title: `Closing ${name}…`,
      body: `${group.metrics.quoteCount} quotes · ${deployment.solverTag} on ${deployment.chainName}`,
      tone: "pending",
    });

    void run
      .close({
        group,
        targetQuantity: closeableQuantity,
        /* The dust floor every partially closed child has to clear. The market
           reports it as a decimal string in the same 18-decimal unit the planner
           works in. */
        minAcceptableQuoteValue: parseUnits(market.market.minAcceptableQuoteValue, WEI_DECIMALS),
        slippage: row.family === "lowcaps" ? 5 : 1,
        markPrice: tick?.markPrice,
        from: delegation.sessionKey,
        /* The handler publishes close fills on the **sub-account's** stream, not
           on the VA that owns the quote, so the run would never see its own
           confirmations if it watched the VA. */
        notificationsAccount: account.address,
        chainId: deployment.chainId,
      })
      .then((summary) => {
        if (summary.ok) {
          toast.update(pending, {
            title: `Close submitted · ${name}`,
            body: `${summary.steps.length} quotes are with the solver. The rows advance as each close is reported.`,
            tone: "warn",
          });
          return;
        }

        /* A plan that never ran is a different failure from one that ran and was
           rejected: nothing was submitted, so the position is exactly as it was. */
        if (summary.planFailure) {
          toast.update(pending, {
            title: "Close not possible",
            body: describePlanFailure(summary.planFailure.reason),
            tone: "error",
          });
          return;
        }

        const described = describeError(summary.error, "Close rejected");
        if (described.isSilent) {
          toast.dismiss(pending);
          return;
        }
        toast.update(pending, { title: described.title, body: described.body, tone: "error" });
      });
  }

  return {
    gate,
    delegation,
    isOpening,
    isClosing,
    closeableQuantity,
    isPartialClose,
    progressPercent: run.progressPercent,
    close,
  };
}

/** The one thing a grouped position row offers right now. */
export type GroupIntent =
  | { kind: "opening" }
  | { kind: "closing"; progressPercent: number }
  /** Anchoring on-chain; there is no quote id to name yet. */
  | { kind: "pending" }
  /** The wallet has to move to this deployment's chain before the grant can be sent. */
  | { kind: "switch" }
  /** The session key is not authorised for this account yet. */
  | { kind: "enable" }
  | { kind: "close" };

/**
 * Which rung of the ladder a grouped row is on.
 *
 * The single-row twin, `resolvePositionIntent`, also has to decide between a
 * close and a cancel. This one does not: a group only ever holds active
 * positions — `partitionQuotes` sends resting orders to the orders tab before
 * anything is folded — so the cancel branch has no way to reach here.
 */
export function resolveGroupIntent(actions: GroupActions): GroupIntent {
  if (actions.isClosing) return { kind: "closing", progressPercent: actions.progressPercent };
  if (actions.isOpening) return { kind: "opening" };
  /* Nothing in the group is addressable by a close order yet — the market may
     also still be loading, which is what leaves `closeableQuantity` at zero. */
  if (actions.closeableQuantity <= 0n) return { kind: "pending" };

  /* The grant that authorises the key *is* a wallet transaction, so the chain
     rung belongs here — in front of `enable`, never in front of the close. */
  if (!actions.delegation.isActive) {
    return actions.gate.ready ? { kind: "enable" } : { kind: "switch" };
  }

  return { kind: "close" };
}

/** Why the planner refused, in the row's own voice. Nothing was closed either way. */
function describePlanFailure(reason: PlanGroupCloseFailureReason): string {
  if (reason === "exceeds-open") {
    return "The group's open size shrank while the plan was being built. Refresh and try again.";
  }
  if (reason === "dust-locked") {
    return "Closing every quote at once would leave one of them under the market's minimum. Close them one at a time from the expanded rows.";
  }
  return "There is no open size left in this group to close.";
}
