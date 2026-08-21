"use client";

import { Button } from "@/components/button";
import { Chips } from "@/components/chips";
import { Field } from "@/components/field";
import { Modal } from "@/components/modal";
import { Pill } from "@/components/pill";
import { Segmented } from "@/components/segmented";
import { useToast } from "@/components/toast";
import { Numeric, ReceiptRow } from "@/components/value";
import type { Deployment, MarketFamily } from "@/config/deployments";
import type { FundingAccount } from "@/features/accounts/account-provider";
import type { PrismMarket } from "@/features/markets/types";
import { GatedSubmit } from "@/features/portfolio/gated-submit";
import { useMarkTick } from "@/features/prices/price-provider";
import { useTpSlDelegation } from "@/features/wallet/use-tpsl-delegation";
import {
  formatPercent,
  formatPnl,
  formatPrice,
  formatSize,
  fromWei,
  marketDisplayName,
  shortenAddress,
} from "@/lib/format";
import {
  aggregateGroupMetrics,
  PositionType,
  type GroupTpSlChild,
  type GroupTpSlDesiredMap,
  type GroupTpSlSideKey,
  type GroupTpSlSideSummary,
  type TpSlPriceType,
  type TpSlValidation,
  type UnifiedQuote,
} from "@symmio/trading-core";
import { useQuoteGroupTpSl, useQuoteGroupTpSlEditor, useSetQuoteGroupTpSl, useTpSlConfig } from "@symmio/trading-react";
import { useMemo, useState } from "react";
import { formatUnits } from "viem";

/** Distances offered as one-tap targets, as a percent away from the mark. */
const DISTANCES = ["5%", "10%", "25%", "50%"] as const;

const PRICE_TYPES = [
  { value: "markPrice" as const, label: "Mark" },
  { value: "lastPrice" as const, label: "Last" },
];

/** Fallback when the market list has not resolved this position's market yet. */
const FALLBACK_PRICE_PRECISION = 4;

export interface PositionTpSlModalProps {
  /**
   * The positions this editor writes across: a single quote for a flat row,
   * every child of a grouped position for a folded one.
   */
  quotes: readonly UnifiedQuote[];
  /** The deployment the quotes settle on — the handler and its rules live there. */
  deployment: Deployment;
  /** The sub-account that owns them. It signs, and its stream reports back. */
  account: FundingAccount;
  /** Which price feed to read the mark from. */
  family: MarketFamily;
  /** The position's market, for price precision and the display name. */
  market?: PrismMarket;
  open: boolean;
  onClose: () => void;
}

/**
 * Set, move or cancel the exits on an open position — one quote or a whole
 * grouped one.
 *
 * A conditional order is not an on-chain write. The trader signs an EIP-712
 * message with the session key, the handler holds it off-chain, and when the
 * trigger prints it fires `requestToClosePosition` from its own wallet — which
 * is why the form is gated on {@link useTpSlDelegation} rather than on the
 * chain alone. An exit written without that second grant looks live and does
 * nothing.
 *
 * ## One form for one quote and for twenty
 *
 * `useQuoteGroupTpSlEditor` is the SDK's staging buffer: it diffs the trader's
 * inputs against what the handler already holds and answers what a submit would
 * actually do — write this side, cancel that one, skip the rest. That diff is
 * the whole difference between "set TP/SL" and "edit TP/SL", and it is exactly
 * as useful over one position as over twenty, which is why this sheet takes a
 * list of quotes rather than a row: a grouped position is not a different
 * editor, it is the same editor with more children. Clearing a field is how a
 * live order is cancelled; the planner turns the empty string into a delete.
 *
 * A conditional order is per **quote**, not per group — the handler holds one
 * order against one quote id. So a group's legs can disagree, and the fields
 * write across every child at once (`applyToAll`) rather than pretending the
 * group has a single order behind it.
 */
export function PositionTpSlModal({
  quotes,
  deployment,
  account,
  family,
  market,
  open,
  onClose,
}: PositionTpSlModalProps) {
  const chainId = deployment.chainId;
  const toast = useToast();

  const head = quotes[0];
  const name = market ? marketDisplayName(market.market.name) : `#${head?.symbolId}`;
  const pricePrecision = market?.market.pricePrecision ?? FALLBACK_PRICE_PRECISION;
  const isLong = head?.positionType === PositionType.LONG;

  /* The feed's own decimal string, never a re-formatted number: a lowcap mark
     lands around 1e-7, and a `String(number)` round-trip there yields
     exponential notation the handler's validator does not take. */
  const tick = useMarkTick(family, market?.market.name ?? "");
  const markPrice = tick?.markPrice;
  const mark = markPrice === undefined ? undefined : Number(markPrice);

  const group = useQuoteGroupTpSl({ quotes, subAccount: account.address, chainId, enabled: open });
  const summary = group.summary;

  const tpslConfig = useTpSlConfig({ chainId, query: { enabled: open } });
  const editor = useQuoteGroupTpSlEditor({
    children: group.children,
    pricePrecision,
    referencePrice: markPrice,
    config: tpslConfig.data,
  });
  const run = useSetQuoteGroupTpSl();
  const delegation = useTpSlDelegation(account);

  const [priceTypeOverride, setPriceTypeOverride] = useState<TpSlPriceType>();

  const priceType = priceTypeOverride ?? summary.takeProfit.priceType ?? summary.stopLoss.priceType ?? "markPrice";
  const tpValue = stagedValue(editor.desired, group.children, "tp", summary.takeProfit);
  const slValue = stagedValue(editor.desired, group.children, "sl", summary.stopLoss);

  /* The first child that fails is the one that blocks the submit, and the rule
     it broke is the same rule every other child would break — the trigger is
     applied to all of them at one price. */
  const validation = firstError(editor.errors);
  const busy = run.isSubmitting || run.isConfirming;
  /* Folded, so the receipt describes the position the form actually writes to
     rather than whichever child happened to sort first. */
  const folded = useMemo(() => aggregateGroupMetrics(quotes), [quotes]);
  const entryPrice =
    folded.weightedOpenPrice === undefined ? undefined : Number(formatUnits(folded.weightedOpenPrice, 18));
  const quantity = Number(formatUnits(folded.openQuantity, 18));

  function applySide(side: GroupTpSlSideKey, value: string) {
    editor.applyToAll(side, value, priceType);
  }

  function applyPriceType(next: TpSlPriceType) {
    setPriceTypeOverride(next);
    /* The price type is not an order of its own — it is a field on each leg. A
       change only reaches the handler if the staged sides are re-applied with
       it, so a switch made after typing is submitted rather than dropped. */
    if (tpValue) editor.applyToAll("tp", tpValue, next);
    if (slValue) editor.applyToAll("sl", slValue, next);
  }

  function targetFor(side: GroupTpSlSideKey, distance: string): string | undefined {
    if (mark === undefined || !Number.isFinite(mark)) return undefined;
    const percent = Number(distance.replace("%", ""));
    /* A take profit is above the mark for a long and below it for a short; a
       stop loss is the mirror. The side alone does not decide the direction. */
    const upward = side === "tp" ? isLong : !isLong;
    return (mark * (1 + (upward ? percent : -percent) / 100)).toFixed(pricePrecision);
  }

  const plan = editor.plan;
  const hasLiveOrder = !summary.isEmpty;
  const canSubmit =
    group.children.length > 0 &&
    editor.isDirty &&
    !editor.isNoop &&
    !editor.hasInvalid &&
    !busy &&
    Boolean(delegation.sessionKey);

  const submitLabel =
    plan.sets.length === 0 && plan.deletes.length > 0
      ? plan.deletes.length > 1
        ? "Cancel exits"
        : "Cancel exit"
      : hasLiveOrder
        ? "Update exits"
        : "Set exits";

  async function submit() {
    if (group.children.length === 0) return;

    const summary = await run.set({
      children: group.children,
      desired: editor.desired,
      subAccount: account.address,
      pricePrecision,
      config: tpslConfig.data,
      referencePrice: markPrice,
      from: delegation.sessionKey ?? undefined,
      chainId,
      /* Every leg is signed locally by the session key, so there is no wallet
         prompt to serialize behind. */
      concurrency: 2,
    });

    if (summary.ok) {
      toast.push({
        title: `Exits updated · ${name}`,
        body: `${deployment.solverName} holds ${describePlan(plan.sets.length, plan.deletes.length)}.`,
        tone: "long",
      });
      editor.reset();
      onClose();
      return;
    }

    toast.push({
      title: summary.stoppedByUser ? "Cancelled" : "The handler rejected the exits",
      body: summary.error?.message ?? "Nothing was written. Your existing exits are unchanged.",
      tone: summary.stoppedByUser ? "warn" : "error",
    });
  }

  async function authorise() {
    try {
      await delegation.grant();
    } catch {
      /* `useTpSlDelegation` keeps the failure; the sheet renders it below. */
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow={`${deployment.label} · ${account.name}`}
      title={`Exits · ${name}`}
      footer={
        delegation.isReady ? (
          <>
            {/* Not gated on the chain: the exits are signed by the session key
                and posted to the conditional-order handler, so the browser
                wallet is never asked for anything. Only the authorisation
                below it is a transaction. */}
            <Button
              variant="primary"
              size="lg"
              onClick={() => void submit()}
              disabled={!canSubmit}
              loading={busy}
              className="w-full"
            >
              {submitLabel}
            </Button>
            {busy ? (
              <span className="prism-pulse text-center text-2xs text-fg-3">
                {run.isConfirming
                  ? `Waiting for the handler to report · ${Math.round(run.progressPercent)}%`
                  : "Signing and submitting…"}
              </span>
            ) : null}
          </>
        ) : (
          <>
            <GatedSubmit
              deployment={deployment}
              label={delegation.needsSessionKey ? "Create a session key first" : "Authorise conditional orders"}
              onSubmit={() => void authorise()}
              disabled={delegation.needsSessionKey || delegation.isLoading}
              loading={delegation.isGranting}
              size="lg"
              className="w-full"
            />
            <span className="text-center text-2xs leading-relaxed text-fg-3">
              Two grants, one prompt each: your session key signs the order, and{" "}
              {shortenAddress(delegation.handlerWallet)} — {deployment.solverName}’s handler wallet — fires the close
              when the trigger prints.
            </span>
            {delegation.error ? (
              <span className="text-center text-2xs text-short">{delegation.error.message}</span>
            ) : null}
          </>
        )
      }
    >
      <div className="flex flex-col divide-y divide-[var(--border-subtle)]">
        <ReceiptRow
          label="Position"
          value={
            <span className="flex items-center justify-end gap-2">
              <span
                className="text-sm font-semibold"
                style={{ color: isLong ? "var(--long-500)" : "var(--short-500)" }}
              >
                {isLong ? "Long" : "Short"}
              </span>
              <Numeric size="sm" tone="strong">
                {formatSize(quantity, market?.market.symbol)}
              </Numeric>
            </span>
          }
        />
        {quotes.length > 1 ? (
          <ReceiptRow
            label="Folds"
            value={<span className="text-sm text-fg-1">{quotes.length} quotes · one order each</span>}
          />
        ) : null}
        <ReceiptRow
          label={quotes.length > 1 ? "Avg entry" : "Entry"}
          value={
            <Numeric size="sm" tone={entryPrice === undefined ? "muted" : undefined}>
              {entryPrice === undefined ? "—" : formatPrice(entryPrice, pricePrecision)}
            </Numeric>
          }
        />
        <ReceiptRow
          label="Mark"
          value={
            mark === undefined ? (
              <Numeric size="sm" tone="muted">
                —
              </Numeric>
            ) : (
              <Numeric size="sm" tone="strong">
                {formatPrice(mark, pricePrecision)}
              </Numeric>
            )
          }
        />
      </div>

      <SideEditor
        side="tp"
        label="Take profit"
        value={tpValue}
        isPending={summary.takeProfit.isPending}
        hasLiveOrder={summary.takeProfit.count > 0}
        split={splitOf(summary.takeProfit)}
        mark={mark}
        estimate={fromWei(editor.estimate.takeProfit.totalPnl)}
        error={validation?.tpError}
        direction={isLong ? "above" : "below"}
        disabled={busy}
        onChange={(value) => applySide("tp", value)}
        targetFor={(distance) => targetFor("tp", distance)}
      />

      <SideEditor
        side="sl"
        label="Stop loss"
        value={slValue}
        isPending={summary.stopLoss.isPending}
        hasLiveOrder={summary.stopLoss.count > 0}
        split={splitOf(summary.stopLoss)}
        mark={mark}
        estimate={fromWei(editor.estimate.stopLoss.totalPnl)}
        error={validation?.slError}
        direction={isLong ? "below" : "above"}
        disabled={busy}
        onChange={(value) => applySide("sl", value)}
        targetFor={(distance) => targetFor("sl", distance)}
      />

      <div className="flex items-center gap-2">
        <span className="text-2xs font-semibold tracking-[0.12em] text-fg-3 uppercase">Trigger on</span>
        <Segmented className="ml-auto" options={PRICE_TYPES} value={priceType} onChange={applyPriceType} size="sm" />
      </div>

      <p className="text-2xs leading-relaxed text-fg-3">
        {tpslConfig.data
          ? `Every target is checked against ${deployment.solverName}'s live rules before it is signed — ${describeRule(tpslConfig.data.minPriceDistancePercent, "distance from the mark")}, ${describeRule(tpslConfig.data.minProfitStopLossSpreadPercent, "spread between the two legs")}.`
          : `${deployment.solverName}'s distance rules are still loading. Targets are checked against them before anything is signed.`}
      </p>
    </Modal>
  );
}

interface SideEditorProps {
  side: GroupTpSlSideKey;
  label: string;
  value: string;
  /** True while any child's leg on this side is still landing with the handler. */
  isPending: boolean;
  /** True when the handler already holds an order on this side, for any child. */
  hasLiveOrder: boolean;
  /**
   * Set only when the children disagree on this side: how many carry a trigger,
   * out of how many. The field starts empty in that case — there is no single
   * value to show — so the footnote is what says the position is half-protected.
   */
  split?: { count: number; total: number };
  mark?: number;
  /** Realized P&L if this side triggers at the staged price, in dollars. */
  estimate: number;
  error?: string;
  /** Which way this leg sits from the mark, given the position's direction. */
  direction: "above" | "below";
  disabled: boolean;
  onChange: (value: string) => void;
  targetFor: (distance: string) => string | undefined;
}

/**
 * One leg of the exit plan.
 *
 * The footnote answers the question the trader actually has — what this level
 * is worth — rather than restating the number they just typed. An empty field
 * is not "nothing": when the handler holds a live order there, clearing it is
 * the cancel, so the control says so instead of looking inert.
 */
function SideEditor({
  side,
  label,
  value,
  isPending,
  hasLiveOrder,
  split,
  mark,
  estimate,
  error,
  direction,
  disabled,
  onChange,
  targetFor,
}: SideEditorProps) {
  const tone = side === "tp" ? "var(--long-500)" : "var(--short-500)";
  const distance =
    mark !== undefined && value !== "" && Number.isFinite(Number(value))
      ? ((Number(value) - mark) / mark) * 100
      : undefined;

  return (
    <div className="flex flex-col gap-2">
      <Field
        label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        inputMode="decimal"
        placeholder="0.00"
        disabled={disabled}
        invalid={Boolean(error)}
        hint={
          isPending ? (
            <span className="prism-pulse text-warn">processing…</span>
          ) : split ? (
            <span style={{ color: tone }}>{`${split.count} of ${split.total} live`}</span>
          ) : hasLiveOrder ? (
            <span style={{ color: tone }}>live</span>
          ) : (
            `triggers ${direction} the mark`
          )
        }
        adornment={
          value ? (
            <button
              type="button"
              onClick={() => onChange("")}
              disabled={disabled}
              className="cursor-pointer rounded-xs px-1.5 py-1 font-mono text-2xs tracking-[0.12em] text-fg-3 uppercase transition-colors duration-[var(--dur-fast)] hover:text-fg-0"
            >
              {hasLiveOrder ? "Cancel" : "Clear"}
            </button>
          ) : undefined
        }
        footnote={
          error ? (
            <span className="text-short">{error}</span>
          ) : value === "" ? (
            split ? (
              <span className="text-warn">
                {`These quotes hold different levels here. Typing one price replaces all ${split.total}; submitting empty cancels the ${split.count} that are live.`}
              </span>
            ) : hasLiveOrder ? (
              <span className="text-warn">Submitting now cancels this leg.</span>
            ) : (
              "Leave empty for no exit on this side."
            )
          ) : (
            <span className="flex items-center gap-1.5">
              {distance === undefined ? null : (
                <span className="tnum">
                  {distance >= 0 ? "+" : "−"}
                  {Math.abs(distance).toFixed(2)}% from mark
                </span>
              )}
              <span className="text-fg-3">·</span>
              <span className="tnum" style={{ color: estimate >= 0 ? "var(--long-500)" : "var(--short-500)" }}>
                {formatPnl(estimate)} at trigger
              </span>
            </span>
          )
        }
      />

      <div className="flex items-center gap-1.5">
        <Pill
          color={tone}
          background={`color-mix(in srgb, ${tone} 13%, transparent)`}
          border={`color-mix(in srgb, ${tone} 26%, transparent)`}
        >
          {side === "tp" ? "TP" : "SL"}
        </Pill>
        <Chips
          className="flex-1"
          options={DISTANCES}
          onChange={(distance) => {
            const target = targetFor(distance);
            if (target) onChange(target);
          }}
        />
      </div>
    </div>
  );
}

/**
 * One of the handler's distance rules, in a sentence.
 *
 * The published values are raw percents and can be effectively zero — a
 * `2e-11%` minimum is not a constraint, and printing it in scientific notation
 * reads as a rule the trader has to work around rather than one they will never
 * meet.
 */
function describeRule(percent: number | undefined, subject: string): string {
  if (percent === undefined || percent < 0.01) return `no minimum ${subject}`;
  return `at least ${formatPercent(percent, { decimals: percent < 1 ? 2 : 0 })} ${subject}`;
}

/**
 * What one side's field shows.
 *
 * A staged edit wins over the handler's own value — including an empty one,
 * which is how a live order is cancelled. Children that disagree have no single
 * value to show, so the field starts empty and {@link splitOf} gives the editor
 * what it needs to say so.
 */
function stagedValue(
  desired: GroupTpSlDesiredMap,
  children: readonly GroupTpSlChild[],
  side: GroupTpSlSideKey,
  summary: GroupTpSlSideSummary,
): string {
  /* `applyToAll` writes one price to every child, so the first staged entry is
     representative of all of them. */
  const staged = children.map((child) => desired[child.key]?.[side]?.triggerPrice).find((value) => value !== undefined);
  if (staged !== undefined) return staged;
  return summary.display === "uniform" ? (summary.price ?? "") : "";
}

/** The split to warn about, or nothing when every child agrees on this side. */
function splitOf(summary: GroupTpSlSideSummary): { count: number; total: number } | undefined {
  return summary.display === "mixed" ? { count: summary.count, total: summary.total } : undefined;
}

/** The first child whose staged trigger breaks a rule — the one blocking the submit. */
function firstError(errors: Record<string, TpSlValidation>): TpSlValidation | undefined {
  return Object.values(errors).find((entry) => entry.tpError || entry.slError);
}

/** Plain-language summary of what a run just did, for the success toast. */
function describePlan(sets: number, deletes: number): string {
  const parts: string[] = [];
  if (sets > 0) parts.push(`${sets} exit${sets > 1 ? "s" : ""}`);
  if (deletes > 0) parts.push(`${deletes} cancellation${deletes > 1 ? "s" : ""}`);
  return parts.join(" and ") || "no change";
}
