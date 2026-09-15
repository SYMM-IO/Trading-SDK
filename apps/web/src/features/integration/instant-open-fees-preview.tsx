"use client";

import type { SolverId } from "@symmio/trading-core";
import { calculateSolverCloseFee, useInstantOpenFees, useMarkets, type PositionType } from "@symmio/trading-react";
import { Spinner } from "@symmio/ui/components/spinner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@symmio/ui/components/tooltip";
import { cn } from "@symmio/ui/lib/utils";
import { formatWithCommas } from "@symmio/utils";
import type { Address } from "viem";

interface Props {
  subAccount: Address;
  /** Target solver. Defaults to the chain's default solver. */
  solverId?: SolverId;
  /** Selected market id; the query stays idle until one is picked. */
  marketId?: number;
  positionType: PositionType;
  /** Raw margin input (decimal string); the query stays idle while empty/invalid. */
  initialMargin: string;
  leverage: number;
  /** Percent. Required on majors; on lowcap the SDK auto-derives when omitted. */
  slippage?: number;
  /** Cache-hot mark price — skips the SDK's own fetch when present. */
  markPrice?: string;
  idPrefix: string;
}

/**
 * SDK fee preview for the instant-open form: the total fee the quote pays,
 * with the full per-leg breakdown on hover — platform open/close on both
 * kinds, plus the solver fees and expected settlement provision on lowcap
 * (Enigma). Driven by `useInstantOpenFees`, which mirrors the exact math
 * `prepareInstantOpenParams` charges.
 */
export function InstantOpenFeesPreview({
  subAccount,
  solverId,
  marketId,
  positionType,
  initialMargin,
  leverage,
  slippage,
  markPrice,
  idPrefix,
}: Props) {
  const enabled = marketId !== undefined && Number(initialMargin) > 0 && leverage > 0;
  const feesQuery = useInstantOpenFees({
    subAccountAddress: subAccount,
    solverId,
    market: { id: marketId ?? 0 },
    positionType,
    initialMargin,
    leverage,
    slippage,
    markPrice,
    query: { enabled },
  });
  const fees = feesQuery.data;

  // The SDK provisions the worst-case (early) close fee — other consumers rely on
  // that. This app instead previews the **minimum** (standard-rate) close fee: the
  // solver close-fee rate once the position is held past its early-close window.
  const marketsQuery = useMarkets({ solverId, query: { enabled } });
  const resolvedMarket = marketsQuery.data?.find((entry) => entry.symbolId === marketId);
  const enigmaMarket = resolvedMarket?.kind === "enigma" ? resolvedMarket : undefined;
  const minCloseSolverFee =
    fees?.kind === "enigma" && enigmaMarket !== undefined
      ? calculateSolverCloseFee(enigmaMarket, {
          notional: fees.notional,
          holdingSeconds: enigmaMarket.hedgerFeeCloseStandardThreshold,
        })
      : undefined;
  // Fall back to the SDK's (max) value only until the market loads.
  const displayCloseSolverFee = fees?.kind === "enigma" ? (minCloseSolverFee ?? fees.closeSolverFee) : undefined;
  const displayTotalFee =
    fees?.kind === "enigma" && displayCloseSolverFee !== undefined
      ? String(
          Number(fees.platformOpenFee) +
            Number(fees.platformCloseFee) +
            Number(fees.openSolverFee) +
            Number(displayCloseSolverFee) +
            Number(fees.expectedSettlementLoss),
        )
      : fees?.totalFee;

  return (
    <div
      data-testid={`${idPrefix}-fees-preview`}
      className="border-border/70 bg-muted/20 flex items-center justify-between gap-3 rounded-xl border p-4 text-sm"
    >
      <div className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Fees (SDK preview)</div>

      {!enabled ? (
        <span className="text-muted-foreground text-xs">Select a market and enter a margin.</span>
      ) : feesQuery.isError ? (
        <span className="text-destructive text-xs" data-testid={`${idPrefix}-fees-preview-error`}>
          {feesQuery.error?.message ?? "Fee preview unavailable."}
        </span>
      ) : !fees ? (
        <span className="text-muted-foreground inline-flex items-center gap-2 text-xs">
          <Spinner className="size-3" /> computing…
        </span>
      ) : (
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className="inline-flex cursor-help items-baseline gap-2"
              data-testid={`${idPrefix}-fees-preview-total`}
            >
              <span className="text-muted-foreground text-[0.65rem] tracking-wide uppercase">
                {fees.kind === "enigma" ? "lowcap" : "majors"}
              </span>
              <span className="text-foreground font-mono font-semibold">
                {formatFeeUsd(displayTotalFee ?? fees.totalFee)}
              </span>
            </span>
          </TooltipTrigger>
          <TooltipContent className="w-72 p-3" sideOffset={6}>
            <div className="grid gap-1.5 text-xs" data-testid={`${idPrefix}-fees-preview-tooltip`}>
              <FeeRow label="Platform open fee" value={formatFeeUsd(fees.platformOpenFee)} />
              <FeeRow label="Platform close fee" value={formatFeeUsd(fees.platformCloseFee)} sub="provisioned" />
              {fees.kind === "enigma" ? (
                <>
                  <FeeRow label="Solver open fee" value={formatFeeUsd(fees.openSolverFee)} />
                  <FeeRow
                    label="Solver close fee"
                    value={formatFeeUsd(displayCloseSolverFee ?? fees.closeSolverFee)}
                    sub="min (standard rate)"
                  />
                  <FeeRow
                    label="Expected settlement"
                    value={formatFeeUsd(fees.expectedSettlementLoss)}
                    sub="est. fill vs mark"
                  />
                </>
              ) : null}
              <div className="border-border/60 mt-1 border-t pt-1.5">
                <FeeRow label="Total" value={formatFeeUsd(displayTotalFee ?? fees.totalFee)} bold />
              </div>
              <FeeRow label="On notional" value={formatFeeUsd(fees.notional)} sub="qty × request price" />
              <p className="text-muted-foreground text-[0.7rem] leading-snug">
                {fees.kind === "enigma"
                  ? "Lowcap: platform + solver fees and the settlement provision are charged from the Virtual Account — the addMargin transfer funds every leg."
                  : "Majors: platform fees only — no solver fees, no settlement provision."}
              </p>
            </div>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

function FeeRow({ label, value, sub, bold = false }: { label: string; value: string; sub?: string; bold?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-muted-foreground inline-flex items-baseline gap-1.5">
        <span>{label}</span>
        {sub ? <span className="text-[0.65rem] opacity-70">{sub}</span> : null}
      </span>
      <span className={cn("font-mono", bold ? "text-foreground font-semibold" : "text-foreground")}>{value}</span>
    </div>
  );
}

/** USD-format a decimal-string fee at up to 4 fraction digits, `$0`-safe. */
function formatFeeUsd(value: string): string {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return value;
  return `$${formatWithCommas(String(parseFloat(parsed.toFixed(4))))}`;
}
