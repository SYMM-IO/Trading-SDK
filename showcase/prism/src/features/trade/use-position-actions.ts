"use client";

import { useToast } from "@/components/toast";
import type { PrismMarket } from "@/features/markets/types";
import { useDescribeRequestError } from "@/features/sdk/describe-request-error";
import { useChainGate } from "@/features/wallet/use-chain-gate";
import { useTradingDelegation } from "@/features/wallet/use-trading-delegation";
import { marketLabel } from "@/lib/format";
import {
  isPendingOrder,
  OrderType,
  PositionType,
  QuoteLifecycle,
  QuoteStatus,
  validateInstantCloseAgainstMarket,
  type UnifiedQuote,
} from "@symmio/trading-core";
import {
  useCoolDownsOfMA,
  useForceCancelCloseRequest,
  useForceCancelQuote,
  useInstantCloseAuto,
  useRequestToCancelCloseRequest,
  useRequestToCancelQuote,
  useSupportsLimitOrder,
} from "@symmio/trading-react";
import { useEffect, useMemo, useState } from "react";
import { formatUnits } from "viem";
import type { PrismQuote } from "./positions-provider";
import { useCloseCancelChase } from "./use-close-cancel-chase";

/** Stages before the quote has an on-chain id — nothing can act on it yet. */
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

export interface PositionActions {
  /** Chain-switch state for the row's deployment. */
  gate: ReturnType<typeof useChainGate>;
  /** Session-key delegation state for the row's account. */
  delegation: ReturnType<typeof useTradingDelegation>;
  /** The row is still being opened — it has no on-chain id to act on. */
  isOpening: boolean;
  /** A close is already in flight. */
  isClosing: boolean;
  /** The quote exists on-chain, so writes can name it. */
  isAnchored: boolean;
  /** PartyA already asked to cancel and the quote is sitting in `CANCEL_PENDING`. */
  isCancelRequested: boolean;
  /** The quote is `CANCEL_PENDING` *and* the cooldown has elapsed, so the cancel can be forced. */
  canForce: boolean;
  /**
   * Seconds left on the solver's cancel cooldown before {@link forceCancel}
   * stops reverting. `0` once the wait is over, and `undefined` while the
   * cooldown itself is still being read.
   */
  forceAvailableIn?: number;
  /**
   * The resolved solver accepts resting orders, so a close can rest at a price
   * too. Only majors declare it; a lowcap row never offers a limit close.
   */
  supportsLimitClose: boolean;
  /**
   * A close request is resting on-chain (`CLOSE_PENDING`): a limit close
   * waiting for its price, or a market close the solver accepted and has not
   * filled. Either way the position is still open and the request can be
   * cancelled.
   */
  isCloseRequested: boolean;
  /** PartyA already asked to cancel the close and the quote sits in `CANCEL_CLOSE_PENDING`. */
  isCancelCloseRequested: boolean;
  /** The quote is `CANCEL_CLOSE_PENDING` *and* the cooldown has elapsed, so the cancel can be forced. */
  canForceCancelClose: boolean;
  /** Seconds left before {@link forceCancelClose} stops reverting; `undefined` while the cooldown is unread. */
  forceCancelCloseAvailableIn?: number;
  /**
   * A close-cancel transaction is mined and the chain has not shown the result
   * yet — see {@link useCloseCancelChase}. The row is still rendering the state
   * the cancel just left, so it must not offer the same write a second time.
   */
  isSettlingCancelClose: boolean;
  /**
   * Seconds until the resting close's own deadline. `0` once it has passed —
   * at which point cancelling it expires it outright rather than asking the
   * solver — and `undefined` when there is no resting close or no deadline.
   */
  closeExpiresIn?: number;
  /** True when the market's own rules reject closing this size. */
  closeBlocked: boolean;
  isClosePending: boolean;
  isCancelPending: boolean;
  isCancelClosePending: boolean;
  /** Close the whole position at market. Signed by the session key, relayed by the solver. */
  close: () => void;
  /** Ask the solver to release a resting order — an on-chain `AccountLayer._call` the wallet sends. */
  cancel: () => void;
  /** Cancel it unilaterally once the solver's cooldown has run out. Also a wallet transaction. */
  forceCancel: () => void;
  /** Ask the solver to release a resting close — an on-chain `AccountLayer._call` the wallet sends. */
  cancelClose: () => void;
  /** Take the close off the position unilaterally once the solver's cooldown has run out. */
  forceCancelClose: () => void;
}

/**
 * Everything a position row can *do*, in one place.
 *
 * Shared by the blotter row and the details sheet, and that sharing is the
 * point: these are money-moving writes with four independent gates in front of
 * them (the market's own close rules, the chain the wallet sits on, the session
 * key's delegation, and the on-chain id the row may not have yet), and a second
 * copy of that ladder is a second chance to get one of them wrong. A Close
 * button that is correct in the blotter and lenient in the sheet is the failure
 * mode this avoids — the sheet is the surface a trader reaches for when they are
 * unsure, so it is the last place a gate should be missing.
 *
 * Which gate applies to which action is not uniform, and {@link resolvePositionIntent}
 * is where that is decided once for every surface.
 *
 * ## The close side has a cancel ladder of its own
 *
 * A limit close does not close anything when it is placed: it writes a close
 * *request* that rests on-chain at the trader's price, and the position stays
 * open — still priced, still funding — until the solver fills it. The contract
 * mirrors the open side's escape hatch exactly: `requestToCancelCloseRequest`
 * asks the solver to release the request, `CANCEL_CLOSE_PENDING` is the wait,
 * and `forceCancelCloseRequest` takes it off unilaterally once the
 * force-cancel-close cooldown (`coolDownsOfMA()[2]`) has passed. The same
 * request past its own deadline is simply expired by the cancel call, with no
 * cooldown at all, which is why the ladder tracks the deadline too.
 */
export function usePositionActions(row: PrismQuote, market?: PrismMarket): PositionActions {
  const toast = useToast();
  const gate = useChainGate(row.deployment);
  const delegation = useTradingDelegation(row.account);
  const describeError = useDescribeRequestError(row.deployment);
  const closeMutation = useInstantCloseAuto();
  const cancelMutation = useRequestToCancelQuote();
  const forceCancelMutation = useForceCancelQuote();
  const cancelCloseMutation = useRequestToCancelCloseRequest();
  const forceCancelCloseMutation = useForceCancelCloseRequest();

  /* Neither close-cancel is announced by the solver and the reconciler does not
     poll at idle, so the write hook's single post-receipt invalidation is the
     only re-read this row would ever get. That one shot races RPC lag. */
  const settleChase = useCloseCancelChase(row.quote);

  /* A capability probe, not a solver id: the row's own deployment declares
     whether resting orders exist there. Asked per row, because the connected
     chain is the wrong default in a two-deployment book. */
  const supportsLimitClose = useSupportsLimitOrder({
    chainId: row.deployment.chainId,
    solverId: row.deployment.solverId,
  });

  /* Index 1 is the cancel cooldown and index 2 the cancel-*close* cooldown, in
     unix seconds. Each force path only opens once its own has elapsed since the
     request. */
  const cooldowns = useCoolDownsOfMA({
    chainId: row.deployment.chainId,
    query: { staleTime: 60 * 60_000 },
  });

  /** Unix seconds, ticked below for as long as a cancel is waiting on the solver. */
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));

  const name = market ? marketLabel(market.market.symbol, market.market.name) : `#${row.quote.symbolId}`;

  /* `UnifiedQuote` amounts are 18-decimal bigints. A `Number()` hop loses
     precision on a large position, and the same value is re-stringified into
     the close request — so the exact string goes end to end. */
  const quantity = formatUnits(row.quote.openQuantity, 18);

  const isOpening = OPENING.includes(row.quote.lifecycle);
  const isClosing = CLOSING.includes(row.quote.lifecycle);
  const isAnchored = row.quote.quoteId !== undefined && row.quote.quoteId > 0n;

  /* A close has to clear the market's own rules too — a leftover under the lot
     size or under the minimum quote value is rejected by the solver, not by the
     SDK, which clamps precision but does not validate. */
  const closeViolations = useMemo(() => {
    if (!market) return [];
    return validateInstantCloseAgainstMarket({
      market: market.market,
      originalQuantity: quantity,
      closeQuantity: quantity,
      cva: formatUnits(row.quote.lockedValues.cva, 18),
      lf: formatUnits(row.quote.lockedValues.lf, 18),
      partyAmm: formatUnits(row.quote.lockedValues.partyAmm, 18),
    }).violations;
  }, [market, quantity, row.quote.lockedValues]);

  /* `forceCancelQuote` reverts with "Invalid state" on anything that is not
     already `CANCEL_PENDING`, and reverts again until the cooldown has run out.
     A `LOCKED` order therefore has exactly one move — `requestToCancelQuote`,
     which puts it into `CANCEL_PENDING` — and the force path only opens after
     the solver has had its window and ignored it. Both halves are the
     contract's rule, so both are checked here rather than discovered as a
     revert. */
  const cancelCooldown = cooldowns.data?.[1];
  const cancelCloseCooldown = cooldowns.data?.[2];
  const requestedAt = Number(row.quote.statusModifyTimestamp ?? 0n);
  const isOnchain = row.quote.lifecycle === QuoteLifecycle.ONCHAIN;
  const isCancelRequested = isOnchain && row.quote.quoteStatus === QuoteStatus.CANCEL_PENDING;
  const isCloseRequested = isOnchain && row.quote.quoteStatus === QuoteStatus.CLOSE_PENDING;
  const isCancelCloseRequested = isOnchain && row.quote.quoteStatus === QuoteStatus.CANCEL_CLOSE_PENDING;

  /* An unread cooldown is not a cooldown of zero. Defaulting it to `0n` while
     the contract read was still in flight offered `Force cancel` the instant a
     cancel was requested, and the transaction reverted with "Cooldown not
     reached" — so an unknown cooldown holds the row on the waiting rung. */
  const forceAt =
    isCancelRequested && requestedAt > 0 && cancelCooldown !== undefined
      ? requestedAt + Number(cancelCooldown)
      : undefined;
  const canForce = forceAt !== undefined && now > forceAt;
  const forceAvailableIn = forceAt === undefined ? undefined : Math.max(0, forceAt - now);

  /* The close side's twin, on its own cooldown: `forceCancelCloseRequest`
     reverts with "Cooldown not reached" until `statusModifyTimestamp +
     coolDownsOfMA()[2]` is behind us. */
  const forceCloseAt =
    isCancelCloseRequested && requestedAt > 0 && cancelCloseCooldown !== undefined
      ? requestedAt + Number(cancelCloseCooldown)
      : undefined;
  const canForceCancelClose = forceCloseAt !== undefined && now > forceCloseAt;
  const forceCancelCloseAvailableIn = forceCloseAt === undefined ? undefined : Math.max(0, forceCloseAt - now);

  /* A resting close carries the deadline it was placed with. Past it the
     contract's cancel call expires the request on the spot instead of opening
     a cooldown, so the surface can promise the right thing. */
  const resting = restingCloseOf(row.quote);
  const closeExpiresIn =
    isCloseRequested && resting?.deadline !== undefined ? Math.max(0, resting.deadline - now) : undefined;

  /* The cooldown expiring is not an event anything else re-renders on: the
     order stops changing the moment partyA requests the cancel — that is the
     whole complaint — so the notification feed goes quiet and the on-chain poll
     reads back the same `CANCEL_PENDING` row it read before. Without a clock of
     its own the row would sit on "cancelling…" until the trader clicked
     something, which is precisely when they need the escape hatch to appear by
     itself. It ticks only while something on this row is actually waiting on
     the clock: a cancel, a close-cancel, or a resting close's own deadline. */
  const isWaitingToForce = isCancelRequested && !canForce;
  const isWaitingToForceClose = isCancelCloseRequested && !canForceCancelClose;
  const isWaitingToExpire = closeExpiresIn !== undefined && closeExpiresIn > 0;
  const isTicking = isWaitingToForce || isWaitingToForceClose || isWaitingToExpire;
  useEffect(() => {
    if (!isTicking) return;
    const timer = window.setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [isTicking]);

  function reportError(error: unknown, id: number, fallback: string) {
    const described = describeError(error, fallback);
    if (described.isSilent) {
      toast.dismiss(id);
      return;
    }
    toast.update(id, { title: described.title, body: described.body, tone: "error" });
  }

  function close() {
    if (!market) {
      toast.push({
        title: "Market not loaded",
        body: `This position's market (#${row.quote.symbolId}) is not in the merged book yet. Try again in a moment.`,
        tone: "error",
      });
      return;
    }
    if (!delegation.sessionKey) return;

    const pending = toast.push({
      title: `Closing ${name}…`,
      body: `${row.deployment.solverTag} on ${row.deployment.chainName}`,
      tone: "pending",
    });

    closeMutation.mutate(
      {
        chainId: row.deployment.chainId,
        solverId: row.deployment.solverId,
        from: delegation.sessionKey,
        /* PartyA for a close is whichever account holds the position — the
           Virtual Account on an isolated market, the sub-account itself on a
           cross-margin one. The reconciler already resolved that. */
        partyA: row.quote.vaAddress ?? row.quote.partyA,
        market: {
          id: Number(row.quote.symbolId),
          name: market.market.name,
          pricePrecision: market.market.pricePrecision,
          quantityPrecision: market.market.quantityPrecision,
        },
        positionType: row.quote.positionType,
        quoteId: row.quote.quoteId ?? 0n,
        quantityToClose: quantity,
        slippage: row.family === "lowcaps" ? 5 : 1,
      },
      {
        onSuccess: () =>
          toast.update(pending, {
            title: `Close submitted · ${name}`,
            body: "The solver has it. The row advances when the close is reported.",
            tone: "warn",
          }),
        onError: (error) => reportError(error, pending, "Close rejected"),
      },
    );
  }

  function cancel() {
    if (!isAnchored) return;
    const pending = toast.push({ title: `Cancelling ${name}…`, tone: "pending" });

    cancelMutation.mutate(
      { quoteId: row.quote.quoteId ?? 0n, account: row.account.address, chainId: row.deployment.chainId },
      {
        onSuccess: () =>
          toast.update(pending, {
            title: "Cancellation requested",
            body: "The solver has a cooldown to respond before you can force it.",
            tone: "warn",
          }),
        onError: (error) => reportError(error, pending, "Cancel rejected"),
      },
    );
  }

  function forceCancel() {
    if (!isAnchored) return;
    const pending = toast.push({ title: `Force-cancelling ${name}…`, tone: "pending" });

    forceCancelMutation.mutate(
      { quoteId: row.quote.quoteId ?? 0n, account: row.account.address, chainId: row.deployment.chainId },
      {
        onSuccess: () => toast.update(pending, { title: "Order cancelled", tone: "warn" }),
        onError: (error) => reportError(error, pending, "Force cancel rejected"),
      },
    );
  }

  function cancelClose() {
    if (!isAnchored) return;
    /* Past its deadline the same call expires the request outright — no
       solver, no cooldown — so the pending toast should not promise a wait. */
    const isExpired = closeExpiresIn === 0;
    const pending = toast.push({
      title: isExpired ? `Releasing the close on ${name}…` : `Cancelling the close on ${name}…`,
      tone: "pending",
    });

    cancelCloseMutation.mutate(
      /* The sub-account, never the VA: `_call` is proxied through the account
         the wallet owns, and the contract attributes the cancel to it. */
      { quoteId: row.quote.quoteId ?? 0n, account: row.account.address, chainId: row.deployment.chainId },
      {
        onSuccess: () => {
          settleChase.start();
          toast.update(
            pending,
            isExpired
              ? {
                  title: `Close released · ${name}`,
                  body: "The request had already expired, so the position is simply open again.",
                  tone: "warn",
                }
              : {
                  title: `Close cancellation requested · ${name}`,
                  body: "The solver has a cooldown to answer. If it never does, you can take the close off the position yourself — the button appears on the row.",
                  tone: "warn",
                },
          );
        },
        onError: (error) => reportError(error, pending, "Cancel close rejected"),
      },
    );
  }

  function forceCancelClose() {
    if (!isAnchored) return;
    const pending = toast.push({ title: `Force-cancelling the close on ${name}…`, tone: "pending" });

    forceCancelCloseMutation.mutate(
      { quoteId: row.quote.quoteId ?? 0n, account: row.account.address, chainId: row.deployment.chainId },
      {
        onSuccess: () => {
          settleChase.start();
          toast.update(pending, {
            title: `Close cancelled · ${name}`,
            body: "The position is open again at its full remaining size.",
            tone: "warn",
          });
        },
        onError: (error) => reportError(error, pending, "Force cancel close rejected"),
      },
    );
  }

  return {
    gate,
    delegation,
    isOpening,
    isClosing,
    isAnchored,
    isCancelRequested,
    canForce,
    forceAvailableIn,
    supportsLimitClose,
    isCloseRequested,
    isCancelCloseRequested,
    canForceCancelClose,
    forceCancelCloseAvailableIn,
    isSettlingCancelClose: settleChase.isChasing,
    closeExpiresIn,
    closeBlocked: closeViolations.length > 0,
    isClosePending: closeMutation.isPending,
    isCancelPending: cancelMutation.isPending || forceCancelMutation.isPending,
    isCancelClosePending: cancelCloseMutation.isPending || forceCancelCloseMutation.isPending,
    close,
    cancel,
    forceCancel,
    cancelClose,
    forceCancelClose,
  };
}

/** Which wallet transaction a network switch is waiting on. */
export type SwitchReason = "cancel" | "cancel-close" | "grant";

/** The one thing a position row offers right now. */
export type PositionIntent =
  | { kind: "opening" }
  | { kind: "closing" }
  /** Anchoring on-chain; there is no quote id to name yet. */
  | { kind: "pending" }
  /**
   * The wallet has to move to this deployment's chain before the write can be
   * sent. `reason` names which wallet transaction is waiting on it, so the
   * remedy can say why rather than just what.
   */
  | { kind: "switch"; reason: SwitchReason }
  /** The session key is not authorised for this account yet. */
  | { kind: "enable" }
  /**
   * The cancel is already requested and the solver's cooldown has not run out.
   * There is nothing to offer yet: `forceCancelQuote` would revert. `remaining`
   * is the wait in seconds, so the surface can count down to the moment the
   * force path opens instead of leaving the trader guessing whether it ever
   * will — `undefined` while the cooldown itself is still being read.
   */
  | { kind: "awaiting-cancel"; remaining?: number }
  | { kind: "cancel"; force: boolean }
  /**
   * The close-cancel is requested and the solver's cooldown has not run out —
   * the close-side twin of `awaiting-cancel`, on its own cooldown.
   */
  | { kind: "awaiting-cancel-close"; remaining?: number }
  /**
   * A close-cancel is mined and the chain has not caught up. Nothing is offered:
   * the same write again would revert on a quote that has already left the
   * status it names.
   */
  | { kind: "settling-cancel-close" }
  /**
   * A close request is resting on the position and can be taken off it.
   * `force` once the solver has ignored the cancel past its cooldown;
   * `expired` when the request is past its own deadline, so the cancel call
   * expires it on the spot instead of asking the solver at all.
   */
  | { kind: "cancel-close"; force: boolean; expired: boolean }
  | { kind: "close" };

/**
 * Which rung of the ladder this row is on — resolved once, rendered by each
 * surface at its own size.
 *
 * The chain rung is **not** a blanket precondition, and treating it as one is
 * what this function exists to prevent. A close is signed by the session key and
 * relayed by the solver over HTTP, so it never touches the browser wallet and
 * works from whichever chain the wallet happens to sit on. A cancel is an
 * `AccountLayer._call` transaction the wallet itself broadcasts, so it does need
 * the wallet on this deployment's chain — and it needs no delegation, because
 * `requestToCancelQuote` is not one of the selectors the session key holds.
 *
 * So the two branches carry opposite requirements, and a shared gate in front of
 * both would be wrong for whichever branch it was not written for: it used to
 * block a HyperEVM close from a wallet parked on Base — precisely the case the
 * session key exists to serve — while also demanding a delegation the cancel
 * never uses.
 *
 * Which of the two branches a row takes is the SDK's call, not a local guess.
 * `isPendingOrder` reads the on-chain `QuoteStatus`, which is the only field
 * that actually says whether a quote became a position. Deriving it from
 * `openQuantity` instead is what put a `LOCKED` limit order in the positions
 * tab behind a Close button: `openQuantity` is `quantity − closedAmount`, so a
 * quote that never opened still reports its full size.
 *
 * A position with a close *resting* on it is a third case, and it sits ahead of
 * the close rung on purpose: `CLOSE_PENDING` is still an open position — it is
 * priced, it pays funding, it can be liquidated — but the contract refuses a
 * second close on it, so the only move the row can offer is to take the first
 * one off. That cancel is a wallet transaction, like the open side's, so it
 * takes the chain rung and none of the delegation.
 */
export function resolvePositionIntent(row: PrismQuote, actions: PositionActions): PositionIntent {
  if (actions.isOpening) return { kind: "opening" };
  if (actions.isClosing) return { kind: "closing" };

  /* A resting order was never opened, so there is nothing to close — it is
     cancelled instead, and a locked one is force-cancelled after the wait. */
  if (isPendingOrder(row.quote)) {
    if (!actions.isAnchored) return { kind: "pending" };
    /* Ahead of the chain rung on purpose: with the cooldown still running
       there is no transaction to send, so asking for a network switch would be
       asking for nothing. */
    if (actions.isCancelRequested && !actions.canForce) {
      return { kind: "awaiting-cancel", remaining: actions.forceAvailableIn };
    }
    if (!actions.gate.ready) return { kind: "switch", reason: "cancel" };
    return { kind: "cancel", force: actions.canForce };
  }

  /* The cancel is mined and the row is still rendering the status it left.
     Ahead of both close-cancel rungs, because each of them would otherwise
     re-offer the write that is already through — and the contract answers a
     second one with "Invalid state". */
  if (actions.isSettlingCancelClose) return { kind: "settling-cancel-close" };

  /* A close-cancel already asked for: nothing to send until the cooldown runs
     out, then a force that the wallet broadcasts. */
  if (actions.isCancelCloseRequested) {
    if (!actions.canForceCancelClose) {
      return { kind: "awaiting-cancel-close", remaining: actions.forceCancelCloseAvailableIn };
    }
    if (!actions.gate.ready) return { kind: "switch", reason: "cancel-close" };
    return { kind: "cancel-close", force: true, expired: false };
  }

  /* A close resting on the position. The contract will not take a second one,
     so the row's only move is to release the first. */
  if (actions.isCloseRequested) {
    if (!actions.gate.ready) return { kind: "switch", reason: "cancel-close" };
    return { kind: "cancel-close", force: false, expired: actions.closeExpiresIn === 0 };
  }

  /* The grant that authorises the key *is* a wallet transaction, so the chain
     rung belongs here — in front of `enable`, never in front of the close. */
  if (!actions.delegation.isActive) {
    return actions.gate.ready ? { kind: "enable" } : { kind: "switch", reason: "grant" };
  }

  return { kind: "close" };
}

/**
 * Why the wallet has to move, phrased for a tooltip.
 *
 * Worth saying out loud, because the asymmetry looks arbitrary otherwise: on
 * this same row a close needs no switch and a cancel does.
 */
export function switchReasonHint(reason: SwitchReason, chainName: string): string {
  if (reason === "cancel") {
    return `Cancelling is an on-chain transaction your wallet sends, so it has to be on ${chainName}. Closing a position does not — the session key signs that one.`;
  }
  if (reason === "cancel-close") {
    return `Taking a resting close off the position is an on-chain transaction your wallet sends, so it has to be on ${chainName}. Placing the close did not need this — the session key signed that one.`;
  }
  return `Authorising the session key is an on-chain transaction your wallet sends, so it has to be on ${chainName}.`;
}

/** Why a close is refused, phrased for a tooltip. */
export const CLOSE_BLOCKED_REASON = "Closing this size would leave a position the market cannot hold.";

/** Why a requested cancel cannot be forced yet, phrased for a tooltip. */
export const AWAITING_CANCEL_REASON =
  "The solver has a cooldown to answer the cancel request. Once it runs out without an answer, you can force the cancellation through yourself — the button appears here.";

/** Why a requested close-cancel cannot be forced yet, phrased for a tooltip. */
export const AWAITING_CANCEL_CLOSE_REASON =
  "The solver has a cooldown to release the close. Once it runs out without an answer, you can take the close off the position yourself — the button appears here. The position stays open throughout.";

/** Why the limit-close entry point is offered, phrased for a tooltip. */
export const LIMIT_CLOSE_HINT =
  "Close at a price you set. The request rests with the solver until the market reaches it — the position stays open until then.";

/** The direction a quote is trading, as a boolean the UI can branch on. */
export function isLongQuote(row: PrismQuote): boolean {
  return row.quote.positionType === PositionType.LONG;
}

/** A close request resting on an open position, as the chain reports it. */
export interface RestingClose {
  /** The price the close rests at, wei. */
  price: bigint;
  /** The size the close targets, wei — the whole position or part of it. */
  quantity: bigint;
  /**
   * A limit close waits for its price; a market close is one the solver
   * accepted and has not filled on-chain yet. Same status, different promise.
   */
  isLimit: boolean;
  /** Unix seconds the request expires, when the chain reports one. */
  deadline?: number;
}

/**
 * The close resting on a row, or nothing.
 *
 * Read off the on-chain status only — a row still in the off-chain closing
 * stages has no settled `requestedClosePrice` to show, and its lifecycle pill
 * already says "closing". Shared by the blotter row, the details sheet and the
 * action ladder so they describe the same request the same way.
 */
export function restingCloseOf(quote: UnifiedQuote): RestingClose | undefined {
  if (quote.lifecycle !== QuoteLifecycle.ONCHAIN) return undefined;
  if (quote.quoteStatus !== QuoteStatus.CLOSE_PENDING && quote.quoteStatus !== QuoteStatus.CANCEL_CLOSE_PENDING) {
    return undefined;
  }
  if (quote.requestedClosePrice === undefined || quote.quantityToClose === undefined) return undefined;

  return {
    price: quote.requestedClosePrice,
    quantity: quote.quantityToClose,
    isLimit: quote.orderType === OrderType.LIMIT,
    deadline: quote.deadline !== undefined && quote.deadline > 0n ? Number(quote.deadline) : undefined,
  };
}
