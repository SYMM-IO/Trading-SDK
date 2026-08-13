"use client";

import { DEFAULT_PRICE_PRECISION, WEI_DECIMALS } from "@/lib/format";
import type { GroupTpSlSideKey, QuoteGroup, TpSlPriceType } from "@symmio/trading-core";
import { PositionType } from "@symmio/trading-core";
import {
  childNotional,
  decimalPriceToWei,
  summarizeQuoteGroupTpSl,
  useDeleteQuoteGroupTpSl,
  useEnigmaPriceByMarketId,
  useMarkets,
  useQuoteGroupTpSl,
  useQuoteGroupTpSlEditor,
  useSetQuoteGroupTpSl,
  useTpSlConfig,
} from "@symmio/trading-react";
import { Button } from "@symmio/ui/components/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@symmio/ui/components/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@symmio/ui/components/select";
import { Spinner } from "@symmio/ui/components/spinner";
import { cn } from "@symmio/ui/lib/utils";
import { formatTokenAmount } from "@symmio/utils";
import { toDecimal } from "@symmio/utils/decimal";
import { useMemo, useState } from "react";
import type { Address } from "viem";
import { GroupTpSlLegs } from "./group-tpsl-legs";
import { distancePercentOf, GroupTpSlRail, type GroupTpSlRung } from "./group-tpsl-rail";
import { useMarketNameById } from "./use-market-name-by-id";
import { useTpSlDelegation } from "./use-tpsl-delegation";

interface Props {
  group: QuoteGroup;
  /** Sub-account that owns the group's Virtual Accounts — required to sign. */
  subAccount: Address;
  /** Delegated session key to sign from, when one is active. */
  from?: Address;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Set the exits for a merged position.
 *
 * A merged row is several on-chain quotes and the handler takes one signed
 * request per quote, so two things have to be true at once: the trader decides
 * once, and the interface is honest about how many quotes that touches. The
 * rail carries the decision — both exits placed around the live mark price with
 * their distance, resulting PnL and protected share — and the footer states the
 * real cost straight off the SDK's plan.
 */
export function GroupTpSlModal({ group, subAccount, from, open, onOpenChange }: Props) {
  const marketNameById = useMarketNameById();
  const marketsQuery = useMarkets();
  const market = useMemo(
    () => marketsQuery.data?.find((entry) => BigInt(entry.symbol_id ?? -1) === group.by.symbolId),
    [marketsQuery.data, group.by.symbolId],
  );
  const pricePrecision = Number(market?.price_precision ?? DEFAULT_PRICE_PRECISION);

  const price = useEnigmaPriceByMarketId({ marketId: group.by.symbolId ?? 0n });
  /** The feed reports `null` before its first tick; the SDK wants "absent", not "null". */
  const markPrice = price.markPrice ?? undefined;
  /** The feed streams full precision; the rail shows what the market actually quotes. */
  const markPriceLabel = useMemo(() => roundToPrecision(markPrice, pricePrecision), [markPrice, pricePrecision]);
  const tpslConfig = useTpSlConfig();

  const groupTpSl = useQuoteGroupTpSl({ quotes: group.quotes, enabled: open });
  const editor = useQuoteGroupTpSlEditor({
    children: groupTpSl.children,
    pricePrecision,
    referencePrice: markPrice,
    config: tpslConfig.data,
  });
  const setRun = useSetQuoteGroupTpSl();
  const deleteRun = useDeleteQuoteGroupTpSl();
  const delegation = useTpSlDelegation({ subAccount, sessionKey: from });

  /**
   * One price-type control for the whole position. It never emits an empty
   * trigger price — that is the SDK's "clear this side" sentinel, so a type
   * change must re-apply whatever price is already staged, per side.
   */
  const [priceType, setPriceType] = useState<TpSlPriceType>("markPrice");

  /** Staged state wins, so the rail moves as the trader types. */
  const staged = useMemo(
    () => summarizeQuoteGroupTpSl(groupTpSl.children, { overrides: editor.desired }),
    [groupTpSl.children, editor.desired],
  );

  const marketLabel =
    group.by.symbolId === undefined
      ? "position"
      : (marketNameById.get(String(group.by.symbolId)) ?? String(group.by.symbolId));
  const isShort = group.by.positionType === PositionType.SHORT;
  /** The header's USD figure. `0n` before the first tick, which reads as "no notional yet". */
  const notional = childNotional({
    openQuantity: group.metrics.openQuantity,
    openPrice: decimalPriceToWei(markPrice ?? "") ?? 0n,
  });

  const writeCount = editor.plan.sets.length + editor.plan.deletes.length;
  /**
   * A run is not over when the requests are: until the handler reports back,
   * the exits on screen are a request, not a fact. Editing or re-submitting
   * against that half-applied state is how a trader ends up with two orders on
   * one leg, so the form stays locked through the confirming window too.
   */
  const confirming = setRun.isConfirming || deleteRun.isConfirming;
  const busy = setRun.isSubmitting || deleteRun.isDeleting || confirming;
  const liveOrders = groupTpSl.orders.filter((order) => order.hasLiveOrder);

  /** The price a rail rung shows: staged if uniform, otherwise blank with a hint below. */
  function rung(side: GroupTpSlSideKey): GroupTpSlRung {
    const summary = side === "tp" ? staged.takeProfit : staged.stopLoss;
    const estimate = side === "tp" ? editor.estimate.takeProfit : editor.estimate.stopLoss;
    const triggerPrice = summary.display === "uniform" ? (summary.price ?? "") : "";
    const firstError = Object.values(editor.errors)
      .map((validation) => (side === "tp" ? validation.tpError : validation.slError))
      .find(Boolean);
    return {
      side,
      triggerPrice,
      distancePercent: distancePercentOf(triggerPrice, markPrice ?? ""),
      pnl: estimate.legs.length > 0 ? estimate.totalPnl : undefined,
      coverage: summary.coveragePercent === undefined ? 0 : Number(summary.coveragePercent / 10n ** 16n) / 100,
      count: summary.count,
      total: summary.total,
      isPending: summary.isPending,
      error: firstError,
    };
  }

  function handleRailChange(side: GroupTpSlSideKey, triggerPrice: string) {
    editor.applyToAll(side, triggerPrice, priceType);
  }

  function handleClear(side: GroupTpSlSideKey) {
    editor.clearSide(side);
  }

  /** Re-stamp the staged (or confirmed) price on both sides under the new type. */
  function handlePriceType(next: TpSlPriceType) {
    setPriceType(next);
    for (const side of ["tp", "sl"] as const) {
      const summary = side === "tp" ? staged.takeProfit : staged.stopLoss;
      if (summary.display !== "uniform" || !summary.price) continue;
      editor.applyToAll(side, summary.price, next);
    }
  }

  async function handleSubmit() {
    // Clear any prior cancel receipt so the two run ledgers never show at once.
    deleteRun.reset();
    await setRun.set({
      children: groupTpSl.children,
      desired: editor.desired,
      subAccount,
      pricePrecision,
      config: tpslConfig.data,
      referencePrice: markPrice,
      from,
    });
  }

  async function handleCancelAll() {
    // Clear the stale "Set exits" receipt — after a cancel it no longer
    // reflects reality (those orders are being removed, not "live").
    setRun.reset();
    await deleteRun.deleteOrders({ children: groupTpSl.children, notificationsAccount: subAccount, from });
    editor.reset();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] gap-0 overflow-y-auto p-0 sm:max-w-md" data-testid="group-tpsl-modal">
        <DialogHeader className="border-border/60 gap-2 border-b px-5 py-4 pr-12">
          <div className="flex items-baseline justify-between gap-3">
            <DialogTitle className="text-[0.95rem] font-medium">Set exits</DialogTitle>
            <span className="flex items-baseline gap-2 font-mono text-xs">
              <span className="text-foreground">{marketLabel}</span>
              <span className={cn("tracking-wide uppercase", isShort ? "text-negative" : "text-positive")}>
                {isShort ? "short" : "long"}
              </span>
            </span>
          </div>
          <DialogDescription className="font-mono text-[0.7rem] tabular-nums">
            {formatTokenAmount(group.metrics.openQuantity, WEI_DECIMALS, { maxFractionDigits: 4 })} open
            {notional > 0n ? ` · $${formatTokenAmount(notional, WEI_DECIMALS, { maxFractionDigits: 2 })}` : ""} ·{" "}
            {group.metrics.quoteCount} {group.metrics.quoteCount === 1 ? "leg" : "legs"}
          </DialogDescription>
        </DialogHeader>

        {groupTpSl.isLoading ? (
          <p className="text-muted-foreground flex items-center gap-2 px-5 py-10 text-xs">
            <Spinner className="size-3" /> Reading the current exits…
          </p>
        ) : (
          <div className="flex flex-col gap-4 px-5 py-4">
            <GroupTpSlRail
              legs={groupTpSl.children}
              overrides={editor.desired}
              referencePrice={markPriceLabel}
              positionType={group.by.positionType}
              takeProfit={rung("tp")}
              stopLoss={rung("sl")}
              onChange={handleRailChange}
              onClear={handleClear}
              disabled={busy}
            />

            <GroupTpSlLegs
              legs={groupTpSl.children}
              overrides={editor.desired}
              mixed={staged.takeProfit.display === "mixed" || staged.stopLoss.display === "mixed"}
              errors={editor.errors}
              onSetLeg={(key, side, triggerPrice) => editor.setChildSide(key, side, { triggerPrice, priceType })}
              disabled={busy}
              trailing={
                <Select
                  value={priceType}
                  onValueChange={(next) => handlePriceType(next as TpSlPriceType)}
                  disabled={busy}
                >
                  <SelectTrigger
                    className="text-muted-foreground h-7 w-auto shrink-0 gap-1.5 border-transparent bg-transparent px-1.5 text-xs shadow-none"
                    aria-label="Which price triggers these exits"
                  >
                    <span className="text-[0.6rem] tracking-[0.14em] uppercase">trigger on</span>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="markPrice">Mark price</SelectItem>
                    <SelectItem value="lastPrice">Last price</SelectItem>
                  </SelectContent>
                </Select>
              }
            />

            {liveOrders.length > 0 ? (
              <div className="border-border/60 flex items-center justify-between gap-3 border-t pt-3">
                <span className="text-muted-foreground font-mono text-[0.7rem] tabular-nums">
                  {liveOrders.length} live {liveOrders.length === 1 ? "order" : "orders"} on the handler
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleCancelAll}
                  disabled={busy}
                  className="text-muted-foreground hover:text-destructive h-6 px-1.5 text-xs"
                  data-testid="group-tpsl-cancel-all"
                >
                  {deleteRun.isDeleting || deleteRun.isConfirming ? <Spinner className="size-3" /> : null}
                  {deleteRun.isDeleting ? "Cancelling…" : deleteRun.isConfirming ? "Confirming…" : "Cancel all"}
                </Button>
              </div>
            ) : null}

            {setRun.steps.length > 0 ? <RunLedger setRun={setRun} /> : null}
            {deleteRun.steps.length > 0 ? <CancelLedger deleteRun={deleteRun} /> : null}
          </div>
        )}

        <div className="border-border/60 flex items-center justify-between gap-3 border-t px-5 py-3.5">
          {delegation.ready ? (
            <>
              <span className={cn("text-[0.7rem]", editor.hasInvalid ? "text-destructive" : "text-muted-foreground")}>
                {confirming
                  ? "Waiting for the handler to confirm these exits."
                  : footerCopy(editor.hasInvalid, writeCount, editor.plan.deletes.length)}
              </span>
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={busy || editor.hasInvalid || writeCount === 0}
                data-testid="group-tpsl-submit"
              >
                {setRun.isSubmitting || setRun.isConfirming ? <Spinner className="size-3" /> : null}
                {setRun.isSubmitting
                  ? `Writing ${setRun.acceptedCount}/${setRun.totalCount}…`
                  : setRun.isConfirming
                    ? `Confirming ${setRun.confirmedCount}/${setRun.totalCount}…`
                    : "Set exits"}
              </Button>
            </>
          ) : (
            <>
              <span className="text-muted-foreground text-[0.7rem]">
                {delegation.needsSessionKey
                  ? "Set up a session key to manage exits."
                  : delegation.error
                    ? delegation.error.message
                    : "One-time approval lets your session key set and cancel exits for this position."}
              </span>
              <Button
                type="button"
                onClick={() => void delegation.enable()}
                disabled={delegation.needsSessionKey || delegation.isEnabling || delegation.isLoading}
                data-testid="group-tpsl-enable-delegation"
              >
                {delegation.isEnabling ? <Spinner className="size-3" /> : null}
                {delegation.isEnabling ? "Approving…" : "Enable one-click TP/SL"}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Says what pressing the button will actually do, in legs. */
function footerCopy(hasInvalid: boolean, writeCount: number, cancelCount: number): string {
  if (hasInvalid) return "Fix the highlighted price to continue.";
  if (writeCount === 0) return "No changes staged.";
  const writes = writeCount - cancelCount;
  const parts: string[] = [];
  if (writes > 0) parts.push(`writes ${writes} ${writes === 1 ? "leg" : "legs"}`);
  if (cancelCount > 0) parts.push(`cancels ${cancelCount}`);
  return `This ${parts.join(" and ")}.`;
}

/**
 * Per-step outcome of the last run. Only rendered once a run exists, and only
 * for steps that actually hit the network — a skipped leg is not news.
 */
function RunLedger({ setRun }: { setRun: ReturnType<typeof useSetQuoteGroupTpSl> }) {
  const executed = setRun.steps.filter((step) => step.status !== "skipped");
  if (executed.length === 0) return null;
  const failed = executed.filter((step) => step.status === "failed");

  return (
    <section className="border-border/60 flex flex-col gap-1.5 border-t pt-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-muted-foreground text-[0.6rem] tracking-[0.18em] uppercase">last run</span>
        {failed.length > 0 ? (
          <button
            type="button"
            onClick={() => void setRun.retryFailed()}
            /** A retry mid-run is refused by the hook; better to say so than to no-op. */
            disabled={setRun.isSubmitting || setRun.isConfirming}
            className="text-primary text-[0.7rem] underline-offset-2 hover:underline disabled:opacity-50 disabled:hover:no-underline"
            data-testid="group-tpsl-retry"
          >
            Retry {failed.length} failed
          </button>
        ) : null}
      </div>
      <ul className="flex flex-col gap-0.5 font-mono text-[0.65rem] tabular-nums">
        {executed.map((step) => (
          <li key={step.id} className="flex items-baseline gap-2">
            <span className="text-muted-foreground/70 w-14 shrink-0">
              {step.kind === "cancel" ? "cancel" : "write"}
            </span>
            <span className="text-muted-foreground/70 w-16 shrink-0">#{String(step.quoteId)}</span>
            <span
              className={cn(
                step.status === "failed"
                  ? "text-destructive"
                  : step.status === "done"
                    ? "text-positive"
                    : "text-muted-foreground",
              )}
            >
              {STEP_COPY[step.status]}
            </span>
            {step.error ? <span className="text-destructive truncate">{step.error.message}</span> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Per-step outcome of the last cancel run — the counterpart to {@link RunLedger}. */
function CancelLedger({ deleteRun }: { deleteRun: ReturnType<typeof useDeleteQuoteGroupTpSl> }) {
  if (deleteRun.steps.length === 0) return null;
  const failed = deleteRun.steps.filter((step) => step.status === "failed");

  return (
    <section className="border-border/60 flex flex-col gap-1.5 border-t pt-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-muted-foreground text-[0.6rem] tracking-[0.18em] uppercase">last cancel</span>
        {failed.length > 0 ? (
          <button
            type="button"
            onClick={() => void deleteRun.retryFailed()}
            disabled={deleteRun.isDeleting || deleteRun.isConfirming}
            className="text-primary text-[0.7rem] underline-offset-2 hover:underline disabled:opacity-50 disabled:hover:no-underline"
            data-testid="group-tpsl-cancel-retry"
          >
            Retry {failed.length} failed
          </button>
        ) : null}
      </div>
      <ul className="flex flex-col gap-0.5 font-mono text-[0.65rem] tabular-nums">
        {deleteRun.steps.map((step) => (
          <li key={step.id} className="flex items-baseline gap-2">
            <span className="text-muted-foreground/70 w-14 shrink-0">cancel</span>
            <span className="text-muted-foreground/70 w-16 shrink-0">#{String(step.quoteId)}</span>
            <span
              className={cn(
                step.status === "failed"
                  ? "text-destructive"
                  : step.status === "done"
                    ? "text-positive"
                    : "text-muted-foreground",
              )}
            >
              {CANCEL_STEP_COPY[step.status]}
            </span>
            {step.error ? <span className="text-destructive truncate">{step.error.message}</span> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Cancel-step status in the trader's words. */
const CANCEL_STEP_COPY: Record<string, string> = {
  queued: "queued",
  deleting: "signing",
  confirming: "waiting for the handler",
  done: "cancelled",
  failed: "failed",
};

/** Step status in the trader's words, not the state machine's. */
const STEP_COPY: Record<string, string> = {
  queued: "queued",
  submitting: "signing",
  confirming: "waiting for the handler",
  done: "live",
  failed: "failed",
  skipped: "no change needed",
};

/** Round a streamed price to what the market quotes. Empty string before the first tick. */
function roundToPrecision(price: string | undefined, pricePrecision: number): string {
  if (!price) return "";
  try {
    const decimal = toDecimal(price);
    return decimal.isFinite() ? decimal.toFixed(pricePrecision) : "";
  } catch {
    return "";
  }
}
