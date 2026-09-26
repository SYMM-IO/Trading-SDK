"use client";

import type { FullBalanceFunding, SolverId } from "@symmio/trading-core";
import { useInstantOpenFees, type PositionType } from "@symmio/trading-react";
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
  /** Raw margin input (decimal string); the query stays idle while empty/invalid. Ignored when `fund` is set. */
  initialMargin: string;
  /**
   * Full-balance funding (lowcap only). When set it replaces `initialMargin`:
   * the preview runs the SDK's probe-and-rescale sizing off the whole balance,
   * so the legs and sized quantity equal what the open will actually submit.
   */
  fund?: FullBalanceFunding;
  /** Raw collateral budget enabling the same automatic fallback as the prepared order. */
  availableBalance?: string;
  /** Reuse the preparation's estimate for the fee calculation. */
  estimatedOpenPrice?: string | null;
  /** Avoid showing fees for an order that is still being prepared. */
  preparationReady: boolean;
  leverage: number;
  /** Percent. Required on majors; on lowcap the SDK auto-derives when omitted. */
  slippage?: number;
  /** Cache-hot mark price — skips the SDK's own fetch when present. */
  markPrice?: string;
  idPrefix: string;
}

/**
 * SDK fee preview for the instant-open form — the open-side legs only: what
 * the open charges now (platform open + solver open + static open + the
 * settlement provision, funded from the Virtual Account). Close fees are
 * charged at close from the position and are previewed in the close form
 * (`useInstantCloseFees`), where the notional and holding time are real.
 * Driven by `useInstantOpenFees`, which mirrors the exact math
 * `prepareInstantOpenParams` charges. With `fund` set the breakdown adds the
 * SDK-sized quantity row so the user sees the size the balance can carry.
 */
export function InstantOpenFeesPreview({
  subAccount,
  solverId,
  marketId,
  positionType,
  initialMargin,
  fund,
  availableBalance,
  estimatedOpenPrice,
  preparationReady,
  leverage,
  slippage,
  markPrice,
  idPrefix,
}: Props) {
  const isFullBalance = fund !== undefined;
  const fundingAmount = isFullBalance ? fund.balance : initialMargin;
  const enabled = marketId !== undefined && Number(fundingAmount) > 0 && leverage > 0;
  const feesQuery = useInstantOpenFees({
    subAccountAddress: subAccount,
    solverId,
    market: { id: marketId ?? 0 },
    positionType,
    // The SDK enforces the funding one-of — never pass both.
    initialMargin: isFullBalance ? undefined : initialMargin,
    fund,
    availableBalance,
    estimatedOpenPrice,
    leverage,
    slippage,
    markPrice,
    query: { enabled },
  });
  const fees = feesQuery.data;
  const error = feesQuery.validationError ?? feesQuery.error;

  return (
    <div
      data-testid={`${idPrefix}-fees-preview`}
      className="border-border/70 bg-muted/20 flex items-center justify-between gap-3 rounded-xl border p-4 text-sm"
    >
      <div className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Fees (SDK preview)</div>

      {!enabled ? (
        <span className="text-muted-foreground text-xs">
          {isFullBalance ? "Select a market — the full balance funds the open." : "Select a market and enter a margin."}
        </span>
      ) : error ? (
        <span className="text-destructive text-xs" data-testid={`${idPrefix}-fees-preview-error`}>
          {error.message}
        </span>
      ) : !preparationReady || !feesQuery.isReady || !fees ? (
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
              <span className="text-foreground font-mono font-semibold">{formatFeeUsd(fees.totalFee)}</span>
              <span className="text-muted-foreground text-[0.6rem] tracking-wide uppercase">charged now</span>
            </span>
          </TooltipTrigger>
          <TooltipContent className="w-72 p-3" sideOffset={6}>
            <div className="grid gap-1.5 text-xs" data-testid={`${idPrefix}-fees-preview-tooltip`}>
              <FeeRow label="Platform open fee" value={formatFeeUsd(fees.platformOpenFee)} />
              {fees.kind === "enigma" ? (
                <>
                  <FeeRow label="Solver open fee" value={formatFeeUsd(fees.openSolverFee)} />
                  <FeeRow label="Solver static open fee" value={formatFeeUsd(fees.staticSolverFeeOpen)} sub="flat" />
                  <FeeRow
                    label="Expected settlement"
                    value={formatFeeUsd(fees.expectedSettlementLoss)}
                    sub="est. fill vs mark"
                  />
                </>
              ) : null}
              <div className="border-border/60 mt-1 border-t pt-1.5">
                <FeeRow label="Charged at open" value={formatFeeUsd(fees.totalFee)} bold />
              </div>
              <FeeRow label="On notional" value={formatFeeUsd(fees.notional)} sub="qty × request price" />
              {fees.fundingMode === "full-balance" ? (
                // The SDK rescaled the quantity down so locks + open fees + settlement fit the balance.
                <FeeRow label="Sized quantity" value={formatQuantityAmount(fees.quantity)} sub="fits the balance" />
              ) : null}
              <p className="text-muted-foreground text-[0.7rem] leading-snug">
                {fees.kind === "enigma"
                  ? "Lowcap: the open funds these legs from the Virtual Account. Close fees are charged at close from the position — see the close form for their live preview."
                  : "Majors: the platform open fee is charged now; the platform close fee is charged at close."}
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

/** Format a base-asset quantity at up to 6 fraction digits, comma-separated. */
function formatQuantityAmount(value: string): string {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return value;
  return formatWithCommas(String(parseFloat(parsed.toFixed(6))));
}
