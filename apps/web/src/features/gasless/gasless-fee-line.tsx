"use client";

import { formatUsd } from "@/lib/format";
import { Spinner } from "@symmio/ui/components/spinner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@symmio/ui/components/tooltip";
import { cn } from "@symmio/ui/lib/utils";
import type { ReactNode } from "react";
import { GasFreeIcon } from "../session-keys/session-key-icons";

/** What one gasless fee line shows. */
export type GaslessFeeLineState =
  /** The card cannot describe its call yet — `hint` says what is missing. */
  | { status: "idle"; hint: string }
  /** The quote is on its way. */
  | { status: "loading" }
  /**
   * A priced call: `fee` at `decimals` (18 for a GaslessLayer quote, the
   * collateral token's for a deposit policy), a short `note` after it (who pays,
   * what is free), and an optional hover `breakdown`. `updating` dims a figure
   * that belongs to the previous inputs while the new quote loads.
   */
  | { status: "ready"; fee: bigint; decimals: number; note?: ReactNode; breakdown?: ReactNode; updating?: boolean }
  /** The GaslessLayer would refuse the relay: `summary` inline, `detail` on hover. */
  | { status: "refused"; summary: string; detail?: string }
  /** The estimate itself failed, which says nothing about the relay. */
  | { status: "unavailable"; detail?: string };

interface Props {
  state: GaslessFeeLineState;
  testId: string;
}

/**
 * One hairline row closing a card: what the gasless relay of the card's action
 * would charge. The relayer pays the network gas; this is the GaslessLayer's own
 * fee, drawn from SYMMIO collateral after the call runs — so it is shown in
 * collateral, never in native gas.
 */
export function GaslessFeeLine({ state, testId }: Props) {
  return (
    <div
      data-testid={testId}
      data-status={state.status}
      className="border-border/70 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-dashed pt-3 text-xs"
    >
      <span className="text-muted-foreground inline-flex items-center gap-1.5 font-medium tracking-wide uppercase">
        <GasFreeIcon className="size-3.5" />
        Gasless fee
      </span>
      <FeeValue state={state} testId={testId} />
    </div>
  );
}

function FeeValue({ state, testId }: Props) {
  switch (state.status) {
    case "idle":
      return <span className="text-muted-foreground">{state.hint}</span>;
    case "loading":
      return (
        <span className="text-muted-foreground inline-flex items-center gap-1.5">
          <Spinner className="size-3" /> estimating…
        </span>
      );
    case "ready": {
      const figure = (
        <span
          className={cn("text-foreground font-mono font-semibold transition-opacity", state.updating && "opacity-50")}
          data-testid={`${testId}-amount`}
        >
          ≈ {formatUsd(state.fee, state.decimals)} USDC
        </span>
      );
      return (
        <span className="inline-flex flex-wrap items-baseline justify-end gap-x-1.5">
          {state.breakdown ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="cursor-help">{figure}</span>
              </TooltipTrigger>
              <TooltipContent className="w-72 p-3" sideOffset={6}>
                {state.breakdown}
              </TooltipContent>
            </Tooltip>
          ) : (
            figure
          )}
          {state.note ? <span className="text-muted-foreground">· {state.note}</span> : null}
        </span>
      );
    }
    case "refused":
      return <DetailOnHover className="text-warning font-medium" text={state.summary} detail={state.detail} />;
    case "unavailable":
      return <DetailOnHover className="text-muted-foreground" text="estimate unavailable" detail={state.detail} />;
  }
}

function DetailOnHover({ className, text, detail }: { className: string; text: string; detail?: string }) {
  if (!detail) return <span className={className}>{text}</span>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn(className, "cursor-help")}>{text}</span>
      </TooltipTrigger>
      <TooltipContent className="max-w-80 p-3 text-xs leading-5" sideOffset={6}>
        {detail}
      </TooltipContent>
    </Tooltip>
  );
}
