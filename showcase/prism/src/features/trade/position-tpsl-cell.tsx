"use client";

import { Skeleton } from "@/components/table";
import type { Deployment, MarketFamily } from "@/config/deployments";
import type { FundingAccount } from "@/features/accounts/account-provider";
import type { PrismMarket } from "@/features/markets/types";
import { cn } from "@/lib/cn";
import { formatPrice, fromWei } from "@/lib/format";
import type { GroupTpSlSideSummary, UnifiedQuote } from "@symmio/trading-core";
import { useQuoteGroupTpSl, useTpSlSupported } from "@symmio/trading-react";
import { useMemo, useState } from "react";
import { PositionTpSlModal } from "./position-tpsl-modal";
import type { PrismGroup, PrismQuote } from "./positions-provider";

export interface PositionTpSlCellProps {
  row: PrismQuote;
  /** The row's market, for the modal's price precision and display name. */
  market?: PrismMarket;
}

/** The exits standing on one quote. */
export function PositionTpSlCell({ row, market }: PositionTpSlCellProps) {
  const quotes = useMemo(() => [row.quote], [row.quote]);

  return (
    <ExitsCell quotes={quotes} deployment={row.deployment} account={row.account} family={row.family} market={market} />
  );
}

export interface GroupExitsCellProps {
  row: PrismGroup;
  /** The group's market, for the modal's price precision and display name. */
  market?: PrismMarket;
}

/**
 * The exits standing on a grouped position.
 *
 * The handler holds one conditional order per **quote**, so a group's legs can
 * disagree — and "2 of 3 legs" is not the answer a trader needs, because two
 * small legs and one large one protect very different amounts of money. The
 * SDK's summary folds coverage by open notional instead, and that is the figure
 * this shows when the legs are split.
 */
export function GroupExitsCell({ row, market }: GroupExitsCellProps) {
  return (
    <ExitsCell
      quotes={row.group.quotes}
      deployment={row.deployment}
      account={row.account}
      family={row.family}
      market={market}
    />
  );
}

interface ExitsCellProps {
  quotes: readonly UnifiedQuote[];
  deployment: Deployment;
  account: FundingAccount;
  family: MarketFamily;
  market?: PrismMarket;
}

/**
 * The exits standing on a position, and the way to change them.
 *
 * Whether this column can say anything at all is a **capability** question, not
 * a solver one: conditional orders exist wherever the resolved solver declares a
 * handler, which `useTpSlSupported` answers per deployment. Where there is no
 * handler the cell says so plainly rather than offering a control that would
 * fail at submit — a lie the trader would only discover with money on the line.
 *
 * The values come from the SDK's folded summary, so a leg the handler has
 * accepted but not yet reported reads as `processing…` instead of as a live
 * exit. An unconfirmed exit is not an exit.
 */
function ExitsCell({ quotes, deployment, account, family, market }: ExitsCellProps) {
  const [open, setOpen] = useState(false);

  const supported = useTpSlSupported({ chainId: deployment.chainId, solverId: deployment.solverId });
  /* The planner writes against the on-chain id. A position still waiting to
     anchor has nothing for the handler to attach an exit to — and a group is
     addressable as soon as any one of its children is. */
  const isAnchored = quotes.some((quote) => quote.quoteId !== undefined && quote.quoteId > 0n);
  const isActive = supported && isAnchored;

  const { summary, isLoading } = useQuoteGroupTpSl({
    quotes,
    subAccount: account.address,
    chainId: deployment.chainId,
    enabled: isActive,
  });

  if (!supported) {
    return (
      <CellNote
        title={`${deployment.solverName} runs no conditional-order handler on ${deployment.chainName}, so exits on this deployment are placed by hand.`}
      >
        not offered
      </CellNote>
    );
  }

  if (!isAnchored) {
    return <CellNote title="Exits can be attached once the position anchors on-chain.">pending</CellNote>;
  }

  if (isLoading && summary.isEmpty) {
    return <Skeleton className="h-3 w-14" />;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={summary.isEmpty ? "Set a take profit and stop loss" : "Move or cancel these exits"}
        className={cn(
          "group/tpsl -mx-1.5 flex cursor-pointer flex-col items-start gap-0.5 rounded-sm px-1.5 py-1 text-left",
          "transition-colors duration-[var(--dur-fast)] hover:bg-bg-3",
          "focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none",
        )}
      >
        {summary.isEmpty ? (
          <span className="flex items-center gap-1 text-2xs font-semibold tracking-[0.08em] text-fg-3 uppercase transition-colors group-hover/tpsl:text-accent">
            <PlusIcon />
            Set exits
          </span>
        ) : (
          <>
            <SideValue side="tp" summary={summary.takeProfit} pricePrecision={market?.market.pricePrecision} />
            <SideValue side="sl" summary={summary.stopLoss} pricePrecision={market?.market.pricePrecision} />
          </>
        )}
      </button>

      {open ? (
        <PositionTpSlModal
          quotes={quotes}
          deployment={deployment}
          account={account}
          family={family}
          market={market}
          open={open}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

/** One side's readout: its trigger, its absence, its split, or the fact it is still landing. */
function SideValue({
  side,
  summary,
  pricePrecision,
}: {
  side: "tp" | "sl";
  summary: GroupTpSlSideSummary;
  pricePrecision?: number;
}) {
  const tone = side === "tp" ? "var(--long-500)" : "var(--short-500)";
  const label = side === "tp" ? "TP" : "SL";

  return (
    <span className="flex items-baseline gap-1.5 font-mono text-2xs leading-none">
      <span style={{ color: summary.count > 0 ? tone : "var(--fg-3)" }} className="font-semibold tracking-[0.08em]">
        {label}
      </span>
      {summary.isPending ? (
        <span className="prism-pulse text-warn">processing…</span>
      ) : summary.count === 0 ? (
        <span className="text-fg-3">—</span>
      ) : summary.display === "uniform" ? (
        <span className="tnum text-fg-1">{formatPrice(Number(summary.price), pricePrecision)}</span>
      ) : (
        /* Split legs have no single price to print. The share shown is of open
           notional, not of legs — one large unprotected quote should drag it
           down even when it is outnumbered. */
        <span
          className="tnum text-fg-1"
          title={`${summary.count} of ${summary.total} quotes carry a ${label}, covering this share of the position's open notional.`}
        >
          {`${fromWei(summary.coveragePercent).toFixed(0)}% covered`}
        </span>
      )}
    </span>
  );
}

/** Why this row has no exits control, in the cell's own voice. */
function CellNote({ children, title }: { children: string; title: string }) {
  return (
    <span title={title} className="cursor-help text-2xs tracking-[0.08em] text-fg-3 uppercase">
      {children}
    </span>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 10 10" width="9" height="9" fill="none" aria-hidden>
      <path d="M5 1.5v7M1.5 5h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
