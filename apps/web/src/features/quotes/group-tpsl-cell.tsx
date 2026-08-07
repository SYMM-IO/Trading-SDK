"use client";

import type { QuoteGroup } from "@symmio/trading-core";
import { useQuoteGroupTpSl } from "@symmio/trading-react";
import { cn } from "@symmio/ui/lib/utils";
import { useState } from "react";
import type { Address } from "viem";
import { formatCoveragePercent, GroupTpSlCoverageBar } from "./group-tpsl-coverage-bar";
import { GroupTpSlModal } from "./group-tpsl-modal";

interface Props {
  group: QuoteGroup;
  /** Sub-account that owns the group — needed to sign the writes. */
  subAccount?: Address;
  /** Delegated session key to sign from, when one is active. */
  from?: Address;
}

/**
 * The TP/SL cell of a merged position row.
 *
 * Three states, in order of how much the trader needs to know: nothing set,
 * one price across every leg, or a split. The split case shows the same
 * notional-weighted bar the modal uses at full size — one idea at two scales —
 * because "2 of 3 legs" says nothing about how much of the position is exposed.
 */
export function GroupTpSlCell({ group, subAccount, from }: Props) {
  const [open, setOpen] = useState(false);
  const { summary, children } = useQuoteGroupTpSl({ quotes: group.quotes });
  const editable = Boolean(subAccount);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={!editable}
        title={editable ? "Set take profit and stop loss" : "Connect a sub-account to set TP/SL"}
        className={cn(
          "group/tpsl flex w-full min-w-32 flex-col items-start gap-1 rounded-sm px-1 py-0.5 text-left",
          "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
          editable ? "hover:bg-muted/40 cursor-pointer" : "cursor-default",
        )}
        data-testid={`group-tpsl-cell-${group.key}`}
      >
        {summary.isEmpty ? (
          <span className="text-muted-foreground text-xs">
            Not set
            {editable ? <span className="text-primary ml-1.5 group-hover/tpsl:underline">Set</span> : null}
          </span>
        ) : (
          <>
            <span className="flex items-center gap-2 font-mono text-xs">
              <SideValue side="tp" summary={summary.takeProfit} />
              <SideValue side="sl" summary={summary.stopLoss} />
            </span>
            {summary.takeProfit.display === "mixed" || summary.stopLoss.display === "mixed" ? (
              <span className="flex w-full flex-col gap-0.5">
                {summary.takeProfit.count > 0 ? <GroupTpSlCoverageBar legs={children} side="tp" compact /> : null}
                {summary.stopLoss.count > 0 ? <GroupTpSlCoverageBar legs={children} side="sl" compact /> : null}
              </span>
            ) : null}
          </>
        )}
      </button>

      {open && subAccount ? (
        <GroupTpSlModal group={group} subAccount={subAccount} from={from} open={open} onOpenChange={setOpen} />
      ) : null}
    </>
  );
}

/** One side's compact readout: the shared price when uniform, the covered share when split. */
function SideValue({
  side,
  summary,
}: {
  side: "tp" | "sl";
  summary: { display: string; price?: string; count: number; coveragePercent?: bigint };
}) {
  if (summary.count === 0) return null;
  const tone = side === "tp" ? "text-positive" : "text-negative";
  const label = side === "tp" ? "TP" : "SL";
  return (
    <span className={cn("flex items-baseline gap-1", tone)}>
      <span className="text-[0.65rem] opacity-70">{label}</span>
      {summary.display === "uniform" ? (
        <span>{summary.price}</span>
      ) : (
        <span title={`${summary.count} legs protected`}>{formatCoveragePercent(summary.coveragePercent)}%</span>
      )}
    </span>
  );
}
