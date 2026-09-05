"use client";

import { Field } from "@/components/field";
import { ResultError, ResultNote, ResultSuccess } from "@/components/result";
import { WEI_DECIMALS } from "@/lib/format";
import { PositionType, type QuoteGroup } from "@symmio/trading-core";
import { useCloseQuoteGroup, useMarkets, type CloseQuoteGroupStepStatus } from "@symmio/trading-react";
import { Badge } from "@symmio/ui/components/badge";
import { Button } from "@symmio/ui/components/button";
import { Input } from "@symmio/ui/components/input";
import { Spinner } from "@symmio/ui/components/spinner";
import { formatTokenAmount } from "@symmio/utils";
import { useMemo, useState } from "react";
import { formatUnits, parseUnits, type Address } from "viem";

/** Badge tone per child-close stage. */
const STEP_VARIANT: Record<CloseQuoteGroupStepStatus, "secondary" | "default" | "positive" | "destructive"> = {
  queued: "secondary",
  closing: "default",
  closed: "positive",
  failed: "destructive",
};

/** Parse a user-entered decimal amount into wei; `undefined` when not a valid positive number. */
function parseAmount(value: string): bigint | undefined {
  if (!/^\d*\.?\d+$/.test(value.trim())) return undefined;
  try {
    const wei = parseUnits(value.trim(), WEI_DECIMALS);
    return wei > 0n ? wei : undefined;
  } catch {
    return undefined;
  }
}

interface Props {
  /** The market + side group the close distributes over. */
  group: QuoteGroup;
  /** Session key that signs every child close silently. */
  sessionKey: Address;
  /** Sub-account owning the VA — its notification stream reports the close fills. */
  subAccount: Address;
  /** Prefix for `data-testid` hooks. */
  idPrefix: string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

/**
 * Integration-flow step for a **group close**: the picked position's whole
 * market + side cohort is closed as one — the quantities of every child quote
 * are concatenated into a single aggregated total, one exact amount is entered
 * against it, and `useCloseQuoteGroup` distributes the amount child by child
 * (largest first, dust-safe), reporting per-quote progress.
 */
export function GroupCloseStep({ group, sessionKey, subAccount, idPrefix, onRefresh, isRefreshing }: Props) {
  const [amount, setAmount] = useState("");
  const [slippage, setSlippage] = useState("5");
  const marketsQuery = useMarkets();
  const groupClose = useCloseQuoteGroup();

  const market = useMemo(
    () => marketsQuery.data?.find((entry) => BigInt(entry.symbolId ?? -1) === group.by.symbolId),
    [marketsQuery.data, group.by.symbolId],
  );
  const minAcceptableQuoteValue = useMemo(
    () =>
      market?.minAcceptableQuoteValue !== undefined
        ? parseUnits(market.minAcceptableQuoteValue, WEI_DECIMALS)
        : undefined,
    [market],
  );

  const targetQuantity = parseAmount(amount);
  const slippageNumber = Number(slippage);
  const openQuantity = group.metrics.openQuantity;
  const canClose =
    targetQuantity !== undefined &&
    minAcceptableQuoteValue !== undefined &&
    Number.isFinite(slippageNumber) &&
    slippageNumber > 0 &&
    !groupClose.isClosing;

  function handleClose() {
    if (!canClose || targetQuantity === undefined || minAcceptableQuoteValue === undefined) return;
    void groupClose.close({
      group,
      targetQuantity,
      minAcceptableQuoteValue,
      slippage: slippageNumber,
      from: sessionKey,
      notificationsAccount: subAccount,
    });
  }

  const sideIsLong = group.by.positionType === PositionType.LONG;

  return (
    <div className="flex flex-col gap-4" data-testid={`${idPrefix}-group-step`}>
      {/* Concatenated group summary */}
      <div className="border-border/70 bg-muted/20 grid gap-3 rounded-xl border p-4 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="text-foreground text-sm font-medium">
            {market?.name ?? `symbol ${group.by.symbolId?.toString() ?? "?"}`} · group of {group.metrics.quoteCount}{" "}
            quote{group.metrics.quoteCount === 1 ? "" : "s"}
          </span>
          <span className="flex items-center gap-2">
            {group.by.positionType !== undefined ? (
              <Badge variant={sideIsLong ? "positive" : "destructive"}>{sideIsLong ? "Long" : "Short"}</Badge>
            ) : null}
            {onRefresh ? (
              <Button type="button" variant="ghost" size="sm" onClick={onRefresh} disabled={isRefreshing}>
                {isRefreshing ? <Spinner className="size-3" /> : null}
                Refresh
              </Button>
            ) : null}
          </span>
        </div>
        <div className="border-border/60 grid grid-cols-2 gap-3 border-t pt-3 @lg/console:grid-cols-3">
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground text-xs">total open quantity</span>
            <span className="text-foreground font-mono" data-testid={`${idPrefix}-group-open`}>
              {formatTokenAmount(openQuantity, WEI_DECIMALS, { maxFractionDigits: 6 })}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground text-xs">quotes</span>
            <span className="text-foreground font-mono">
              {group.quotes
                .filter((quote) => quote.quoteId !== undefined)
                .map((quote) => `#${quote.quoteId!.toString()}`)
                .join(" + ")}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground text-xs">min quote value</span>
            <span className="text-foreground font-mono">
              {minAcceptableQuoteValue !== undefined
                ? formatTokenAmount(minAcceptableQuoteValue, WEI_DECIMALS, { maxFractionDigits: 2 })
                : "—"}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-end gap-2">
        <Field
          label="Quantity to close"
          htmlFor={`${idPrefix}-group-amount`}
          className="flex-1"
          action={
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setAmount(formatUnits(openQuantity, WEI_DECIMALS))}
            >
              Max
            </Button>
          }
        >
          <Input
            id={`${idPrefix}-group-amount`}
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="0.0"
            inputMode="decimal"
            className="font-mono"
          />
        </Field>
        <Field label="Slippage %" htmlFor={`${idPrefix}-group-slippage`} className="w-24">
          <Input
            id={`${idPrefix}-group-slippage`}
            value={slippage}
            onChange={(event) => setSlippage(event.target.value)}
            inputMode="decimal"
            className="font-mono"
          />
        </Field>
        <Button type="button" onClick={handleClose} disabled={!canClose} data-testid={`${idPrefix}-group-submit`}>
          {groupClose.isClosing ? <Spinner className="size-4" /> : null}
          {groupClose.isClosing ? "Closing…" : "Close group"}
        </Button>
      </div>

      {minAcceptableQuoteValue === undefined && !marketsQuery.isLoading ? (
        <ResultNote>Market info for this symbol has no minAcceptableQuoteValue — cannot plan.</ResultNote>
      ) : null}

      {groupClose.planFailure ? (
        <ResultError
          testId={`${idPrefix}-group-plan-error`}
          kind={groupClose.planFailure.reason}
          message={
            groupClose.planFailure.reason === "dust-locked"
              ? `Exact amount unreachable. Largest closeable: ${formatTokenAmount(groupClose.planFailure.closeableQuantity, WEI_DECIMALS, { maxFractionDigits: 6 })}`
              : groupClose.planFailure.reason === "exceeds-open"
                ? `Amount exceeds the group's open size (${formatTokenAmount(groupClose.planFailure.totalOpen, WEI_DECIMALS, { maxFractionDigits: 6 })}).`
                : "Nothing closable in this group."
          }
        />
      ) : null}

      {groupClose.error ? (
        <ResultError
          testId={`${idPrefix}-group-error`}
          kind={groupClose.error.kind}
          message={groupClose.error.message}
        />
      ) : null}

      {groupClose.steps.length > 0 ? (
        <div className="border-border/70 flex flex-col gap-3 rounded-xl border p-4">
          <div className="bg-muted h-1.5 overflow-hidden rounded-full">
            <div
              className="bg-positive h-full rounded-full transition-all"
              style={{ width: `${groupClose.progressPercent}%` }}
            />
          </div>
          <div className="text-muted-foreground flex justify-between font-mono text-xs">
            <span>
              {formatTokenAmount(groupClose.closedQuantity, WEI_DECIMALS, { maxFractionDigits: 6 })} /{" "}
              {formatTokenAmount(groupClose.targetQuantity, WEI_DECIMALS, { maxFractionDigits: 6 })}
            </span>
            <span>{groupClose.progressPercent}%</span>
          </div>
          <ul className="flex flex-col gap-1.5" data-testid={`${idPrefix}-group-steps`}>
            {groupClose.steps.map((step) => (
              <li key={step.key} className="flex items-center gap-2 font-mono text-xs">
                <Badge variant={STEP_VARIANT[step.status]} className="w-16 justify-center">
                  {step.status}
                </Badge>
                <span className="text-foreground">#{String(step.quoteId)}</span>
                <span className="text-muted-foreground">
                  {step.kind} · {formatTokenAmount(step.closeQuantity, WEI_DECIMALS, { maxFractionDigits: 6 })}
                </span>
                {step.status === "closing" ? <span className="text-muted-foreground">awaiting fill…</span> : null}
                {step.error ? <span className="text-destructive truncate">{step.error.message}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {groupClose.status === "success" ? (
        <ResultSuccess testId={`${idPrefix}-group-success`}>
          Closed {formatTokenAmount(groupClose.closedQuantity, WEI_DECIMALS, { maxFractionDigits: 6 })} across{" "}
          {groupClose.steps.length} quote{groupClose.steps.length === 1 ? "" : "s"}.
        </ResultSuccess>
      ) : null}

      {(groupClose.status === "success" || groupClose.status === "failed") && (
        <Button type="button" variant="ghost" size="sm" className="self-start" onClick={() => groupClose.reset()}>
          Reset
        </Button>
      )}
    </div>
  );
}
