"use client";

import { WEI_DECIMALS } from "@/lib/format";
import type { QuoteGroup, QuoteGroupFunding } from "@symmio/trading-core";
import { useQuoteGroupFunding, useQuotesPendingFunding } from "@symmio/trading-react";
import { Spinner } from "@symmio/ui/components/spinner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@symmio/ui/components/tooltip";
import { formatTokenAmount } from "@symmio/utils";
import { ExpandedRowSection } from "./expanded-row-section";
import { GroupFundingHistoryButton } from "./group-funding-history-modal";

interface Props {
  /** The grouped position whose settled and pending funding to summarise. */
  group: QuoteGroup;
}

const EMPTY = "—";

/** Funding amounts are collateral, not prices — 4dp reads well and matches the per-quote panel. */
const FUNDING_PRECISION = 4;

/** Pending funding grows every epoch and no event announces it, so the panel polls it. */
const PENDING_FUNDING_REFETCH_MS = 60_000;

/** Tooltip on the pending figure: what it is, and why it is not an operand of the equation. */
const PENDING_FUNDING_TITLE =
  "Accrued on the open quotes since their last settlement and not yet charged. Not part of Net funding; it settles on the next charge or close.";

function formatAmount(value: bigint): string {
  if (value === 0n) return "0";
  return formatTokenAmount(value, WEI_DECIMALS, { maxFractionDigits: FUNDING_PRECISION });
}

/** Signed funding figure, e.g. `+0.0238` / `−0.7010`. The sign is the direction, so it is never dropped. */
function formatSignedAmount(value: bigint): string {
  if (value === 0n) return "0";
  return `${value < 0n ? "−" : "+"}${formatAmount(value < 0n ? -value : value)}`;
}

/** Green when the position earned funding, red when it paid; neutral at exactly zero. */
function netTone(net: bigint): string {
  if (net === 0n) return "text-foreground";
  return net < 0n ? "text-negative" : "text-positive";
}

/**
 * How much of the group's funding actually resolved, in words.
 *
 * `net` is only ever a sum over the children the subgraph has indexed, so an
 * incomplete read must not be presented as a final total — and an all-optimistic
 * group reporting `0` means "unknown", not "no funding".
 */
function CompletenessNote({ funding, isLoading }: { funding: QuoteGroupFunding; isLoading: boolean }) {
  if (isLoading) {
    return (
      <span className="text-muted-foreground inline-flex items-center gap-1.5 text-[0.65rem]">
        <Spinner className="size-3" />
        <span>Loading…</span>
      </span>
    );
  }

  if (funding.expectedCount === 0) {
    return <span className="text-muted-foreground text-[0.65rem]">No on-chain quotes yet</span>;
  }

  if (!funding.isComplete) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="text-muted-foreground hover:text-foreground inline-flex cursor-help text-[0.65rem]">
            {funding.resolvedCount} of {funding.expectedCount} quotes indexed · partial
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-64 text-left font-normal normal-case">
          {`The totals above cover only the quotes the subgraph has indexed, so they are a lower bound. Awaiting ${funding.missingQuoteIds.map((id) => `#${id}`).join(", ")}.`}
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <span className="text-muted-foreground text-[0.65rem]">
      {funding.expectedCount} {funding.expectedCount === 1 ? "quote" : "quotes"} · settled to date
    </span>
  );
}

/**
 * Group-level funding summary for one {@link QuoteGroup}: the net figure folded
 * across every child quote and the paid/received split it derives from, with the
 * full per-tick history one click away in {@link GroupFundingHistoryButton}.
 *
 * The totals come from a single batched subgraph round-trip rather than a
 * per-child fan-out. The funding accrued on the open children but not yet
 * settled is a separate on-chain read, shown after the equation in
 * {@link PendingFundingTerm} and never folded into it.
 */
export function GroupFundingPanel({ group }: Props) {
  const { funding, isLoading, error } = useQuoteGroupFunding({ group });

  /** Nothing resolved yet — showing `0` here would read as "no funding", which is a different claim. */
  const showAmounts = !isLoading && error === null && funding.resolvedCount > 0;

  /** The SDK already nets income-positive, so the equation on screen is exactly the one behind the figure. */
  const net = funding.netReceived;

  const pending = useQuotesPendingFunding({
    quotes: group.quotes,
    query: { refetchInterval: PENDING_FUNDING_REFETCH_MS },
  });
  /**
   * No child is an active on-chain position, so nothing was read: the hook answers
   * `0n` with every row `null`. A read that resolved to `0n` has rows, so it stays.
   */
  const hasPendingFunding = !(pending.pendingNetReceived === 0n && pending.rows.every((row) => row === null));

  return (
    <ExpandedRowSection
      title="Funding"
      note={
        error !== null ? (
          <span className="text-destructive text-[0.65rem]">{error.message}</span>
        ) : (
          <CompletenessNote funding={funding} isLoading={isLoading} />
        )
      }
    >
      {/* Every figure stays left-aligned: the expanded row spans a horizontally
          scrolling table, so anything pushed to the far edge lands off-screen. */}
      <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground text-[0.6rem] font-medium tracking-wider uppercase">Net funding</span>
          <span
            className={`font-mono text-xl leading-none ${showAmounts ? netTone(net) : "text-foreground"}`}
            data-testid="group-funding-net"
          >
            {error !== null ? (
              EMPTY
            ) : isLoading ? (
              <Spinner className="size-4" />
            ) : showAmounts ? (
              formatSignedAmount(net)
            ) : (
              EMPTY
            )}
          </span>
        </div>

        <Operator symbol="=" />
        <Term label="Received" value={showAmounts ? formatAmount(funding.received) : EMPTY} />
        <Operator symbol="−" />
        <Term label="Paid" value={showAmounts ? formatAmount(funding.paid) : EMPTY} />

        {hasPendingFunding ? <PendingFundingTerm pending={pending} /> : null}

        <GroupFundingHistoryButton group={group} />
      </div>
    </ExpandedRowSection>
  );
}

/** One operand of the `net = received − paid` derivation. */
function Term({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-muted-foreground/70 text-[0.6rem] font-medium tracking-wider uppercase">{label}</span>
      <span className="text-foreground font-mono text-sm leading-none">{value}</span>
    </div>
  );
}

/**
 * The group's pending (accrued, unsettled) funding, set after the equation behind
 * a rule because it is not an operand: settled funding comes from the subgraph and
 * pending from a contract read at another height, so the two are never summed.
 */
function PendingFundingTerm({ pending }: { pending: ReturnType<typeof useQuotesPendingFunding> }) {
  const value = pending.pendingNetReceived;
  return (
    <div className="border-border/70 flex flex-col gap-1 border-l pl-5">
      <span className="text-muted-foreground/70 text-[0.6rem] font-medium tracking-wider uppercase">
        Pending (unsettled)
      </span>
      <span
        className={`font-mono text-sm leading-none ${value !== undefined ? netTone(value) : "text-foreground"}`}
        title={pending.error?.message ?? PENDING_FUNDING_TITLE}
        data-testid="group-funding-pending"
      >
        {value !== undefined ? formatSignedAmount(value) : pending.isLoading ? <Spinner className="size-3" /> : EMPTY}
      </span>
    </div>
  );
}

/** The `=` / `−` between terms — real arithmetic, so it is spelled out rather than implied. */
function Operator({ symbol }: { symbol: string }) {
  return (
    <span aria-hidden className="text-muted-foreground/50 pb-0.5 font-mono text-sm leading-none">
      {symbol}
    </span>
  );
}
