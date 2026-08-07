"use client";

import { WEI_DECIMALS } from "@/lib/format";
import type { QuoteGroup, QuoteGroupFunding } from "@symmio/trading-core";
import { useQuoteGroupFunding } from "@symmio/trading-react";
import { Spinner } from "@symmio/ui/components/spinner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@symmio/ui/components/tooltip";
import { formatTokenAmount } from "@symmio/utils";
import { ExpandedRowSection } from "./expanded-row-section";
import { GroupFundingHistoryButton } from "./group-funding-history-modal";

interface Props {
  /** The grouped position whose settled funding to summarise. */
  group: QuoteGroup;
}

const EMPTY = "—";

/** Funding amounts are collateral, not prices — 4dp reads well and matches the per-quote panel. */
const FUNDING_PRECISION = 4;

function formatAmount(value: bigint): string {
  if (value === 0n) return "0";
  return formatTokenAmount(value, WEI_DECIMALS, { maxFractionDigits: FUNDING_PRECISION });
}

/**
 * The direction of a net figure, spelled out.
 *
 * The SDK's convention is `net = paid − received`, so a positive `net` means the
 * user *paid*. That is the opposite of the "positive is income" reflex, so this
 * panel never shows a bare `+`/`-` — it names the direction instead.
 */
function netLabel(net: bigint): string {
  if (net === 0n) return "Net";
  return net > 0n ? "Net paid" : "Net received";
}

/** Magnitude of the net figure; the direction is carried by {@link netLabel}. */
function netMagnitude(net: bigint): bigint {
  return net < 0n ? -net : net;
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
 * per-child fan-out.
 */
export function GroupFundingPanel({ group }: Props) {
  const { funding, isLoading, error } = useQuoteGroupFunding({ group });

  /** Nothing resolved yet — showing `0` here would read as "no funding", which is a different claim. */
  const showAmounts = !isLoading && error === null && funding.resolvedCount > 0;

  /**
   * The derivation always reads left-to-right as a true subtraction: net-paid is
   * `paid − received`, net-received is the same sum the other way round. Flipping
   * the operands keeps the equation honest instead of showing a magnitude that
   * does not match the operator.
   */
  const isNetReceived = funding.net < 0n;
  const derivation = isNetReceived
    ? ([
        { label: "Received", value: funding.received },
        { label: "Paid", value: funding.paid },
      ] as const)
    : ([
        { label: "Paid", value: funding.paid },
        { label: "Received", value: funding.received },
      ] as const);

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
          <span className="text-muted-foreground text-[0.6rem] font-medium tracking-wider uppercase">
            {netLabel(funding.net)}
          </span>
          <span
            className={`font-mono text-xl leading-none ${isNetReceived ? "text-primary" : "text-foreground"}`}
            data-testid="group-funding-net"
          >
            {error !== null ? (
              EMPTY
            ) : isLoading ? (
              <Spinner className="size-4" />
            ) : showAmounts ? (
              formatAmount(netMagnitude(funding.net))
            ) : (
              EMPTY
            )}
          </span>
        </div>

        <Operator symbol="=" />
        <Term label={derivation[0].label} value={showAmounts ? formatAmount(derivation[0].value) : EMPTY} />
        <Operator symbol="−" />
        <Term label={derivation[1].label} value={showAmounts ? formatAmount(derivation[1].value) : EMPTY} />

        <GroupFundingHistoryButton group={group} />
      </div>
    </ExpandedRowSection>
  );
}

/** One operand of the `net = paid − received` derivation. */
function Term({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-muted-foreground/70 text-[0.6rem] font-medium tracking-wider uppercase">{label}</span>
      <span className="text-foreground font-mono text-sm leading-none">{value}</span>
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
