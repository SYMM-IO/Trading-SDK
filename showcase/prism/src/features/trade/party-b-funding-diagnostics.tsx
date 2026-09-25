"use client";

import { CopyAction, DetailRow, DetailSection } from "@/components/detail-list";
import { Pill } from "@/components/pill";
import { Numeric } from "@/components/value";
import { formatClock, formatDate, shortenAddress } from "@/lib/format";
import type { FundingFee } from "@symmio/trading-core";
import { useFundingFeesOfPartyB } from "@symmio/trading-react";
import { formatUnits, zeroAddress } from "viem";
import type { PrismQuote } from "./positions-provider";

interface Props {
  /** Position whose market and solver identify the on-chain funding pair. */
  row: PrismQuote;
}

type PairState = "accruing" | "configured" | "not-configured";

/** Raw accumulated-funding configuration for this position's market and solver pair. */
export function PartyBFundingDiagnostics({ row }: Props) {
  const { quote, deployment } = row;
  const partyB = quote.partyB;
  const hasPartyB = partyB !== undefined && partyB !== zeroAddress;
  const funding = useFundingFeesOfPartyB({
    symbolId: quote.symbolId,
    partyB: partyB ?? zeroAddress,
    chainId: deployment.chainId,
    query: { enabled: hasPartyB, staleTime: 60_000, refetchInterval: 60_000 },
  });

  if (!hasPartyB) {
    return (
      <DetailSection title="Solver funding state" note={`symbol #${quote.symbolId}`}>
        <p className="py-1 text-sm leading-relaxed text-fg-3">
          A solver has not locked this quote yet, so there is no market-and-solver funding pair to inspect.
        </p>
      </DetailSection>
    );
  }

  if (funding.error) {
    return (
      <DetailSection title="Solver funding state" note={`symbol #${quote.symbolId}`}>
        <p className="py-1 text-sm leading-relaxed text-short">
          The pair&rsquo;s on-chain funding state could not be read. {funding.error.message}
        </p>
      </DetailSection>
    );
  }

  const fee = funding.data;
  const state = fee ? pairState(fee) : undefined;

  return (
    <DetailSection title="Solver funding state" note={`symbol #${quote.symbolId} · per solver`}>
      <p className="pb-2 text-2xs leading-relaxed text-fg-3">
        Contract rates for this market-and-solver pair. They are 18-decimal, per-unit values: positive means that side
        pays. They are not position funding amounts and are not added to settled or accrued funding.
      </p>

      <DetailRow
        label="Pair state"
        value={state ? <StatePill state={state} /> : "—"}
        sub={state ? stateDescription(state) : undefined}
        isLoading={funding.isLoading}
      />
      <DetailRow
        label="Solver (partyB)"
        value={<span className="font-mono text-sm text-fg-1">{shortenAddress(partyB)}</span>}
        action={<CopyAction value={partyB} label="Solver address" />}
      />
      <DetailRow
        label="Epoch duration"
        value={<Numeric size="sm">{fee ? formatDuration(fee.epochDuration) : "—"}</Numeric>}
        sub={fee?.epochDuration === 0n ? "accumulated funding disabled" : "one funding epoch"}
        isLoading={funding.isLoading}
      />
      <DetailRow
        label="Current long rate"
        value={<Rate value={fee?.currentLongRate} />}
        sub={fee ? sideMeaning("Longs", fee.currentLongRate) : undefined}
        isLoading={funding.isLoading}
      />
      <DetailRow
        label="Current short rate"
        value={<Rate value={fee?.currentShortRate} />}
        sub={fee ? sideMeaning("Shorts", fee.currentShortRate) : undefined}
        isLoading={funding.isLoading}
      />
      <DetailRow
        label="Weighted long rate"
        value={<Rate value={fee?.accumulatedLongRate} />}
        sub="average per unit / epoch"
        isLoading={funding.isLoading}
      />
      <DetailRow
        label="Weighted short rate"
        value={<Rate value={fee?.accumulatedShortRate} />}
        sub="average per unit / epoch"
        isLoading={funding.isLoading}
      />
      <DetailRow
        label="Last contract update"
        value={<Numeric size="sm">{fee ? formatTimestamp(fee.lastUpdatedTimeStamp) : "—"}</Numeric>}
        sub={fee && fee.lastUpdatedEpoch > 0n ? `epoch ${fee.lastUpdatedEpoch}` : undefined}
        isLoading={funding.isLoading}
      />

      {fee ? <AdvancedFundingFields fee={fee} /> : null}
    </DetailSection>
  );
}

function StatePill({ state }: { state: PairState }) {
  if (state === "accruing") {
    return (
      <Pill dot color="var(--long-500)" background="var(--long-bg)" border="var(--long-500)">
        Accruing
      </Pill>
    );
  }
  if (state === "configured") {
    return (
      <Pill dot color="var(--warn-500)" background="var(--warn-bg)" border="var(--warn-500)">
        Not started
      </Pill>
    );
  }
  return <Pill>Not configured</Pill>;
}

function AdvancedFundingFields({ fee }: { fee: FundingFee }) {
  return (
    <details className="group mt-2 border-t border-line-subtle pt-2">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-1 text-sm text-fg-2 transition-colors hover:text-fg-0 [&::-webkit-details-marker]:hidden">
        <span>Advanced funding fields</span>
        <span
          aria-hidden
          className="text-2xs text-fg-3 transition-transform duration-[var(--dur-fast)] group-open:rotate-90"
        >
          ›
        </span>
      </summary>
      <dl className="mt-1 flex flex-col border-l border-line-subtle pl-3">
        <DetailRow
          label="History started"
          value={<Numeric size="sm">{formatTimestamp(fee.startEpochTimeStamp)}</Numeric>}
          sub={fee.startEpoch > 0n ? `epoch ${fee.startEpoch}` : "no first rate yet"}
        />
        <DetailRow label="Long snapshot" value={<Rate value={fee.snapshotLongFee} />} sub="carried per-unit fee" />
        <DetailRow label="Short snapshot" value={<Rate value={fee.snapshotShortFee} />} sub="carried per-unit fee" />
      </dl>
      <p className="mt-2 pl-3 text-2xs leading-relaxed text-fg-3">
        Snapshots carry funding from before an epoch-duration change. Weighted rates are averages, not cumulative
        position charges.
      </p>
    </details>
  );
}

function Rate({ value }: { value: bigint | undefined }) {
  if (value === undefined) return <Numeric size="sm">—</Numeric>;
  const tone = value > 0n ? "short" : value < 0n ? "long" : "muted";
  return (
    <Numeric size="sm" tone={tone}>
      {formatRate(value)}
    </Numeric>
  );
}

function pairState(fee: FundingFee): PairState {
  if (fee.epochDuration === 0n) return "not-configured";
  if (fee.startEpoch === 0n && fee.startEpochTimeStamp === 0n) return "configured";
  return "accruing";
}

function stateDescription(state: PairState): string {
  if (state === "accruing") return "open quotes accrue each epoch";
  if (state === "configured") return "duration set; no rate posted yet";
  return "no accumulated funding for this pair";
}

function sideMeaning(side: "Longs" | "Shorts", value: bigint): string {
  if (value > 0n) return `${side} pay per unit / epoch`;
  if (value < 0n) return `${side} receive per unit / epoch`;
  return `No current ${side.toLowerCase()} rate`;
}

function formatRate(value: bigint): string {
  const sign = value > 0n ? "+" : value < 0n ? "−" : "";
  const decimal = formatUnits(value < 0n ? -value : value, 18);
  const [whole = "0", fraction = ""] = decimal.split(".");
  const groupedWhole = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const trimmed = fraction.replace(/0+$/, "");
  if (!trimmed) return `${sign}${groupedWhole}`;

  const firstSignificant = trimmed.search(/[1-9]/);
  const visibleDigits = firstSignificant === -1 ? 0 : Math.min(trimmed.length, Math.max(4, firstSignificant + 4));
  const visible = trimmed.slice(0, visibleDigits).replace(/0+$/, "");
  return visible ? `${sign}${groupedWhole}.${visible}` : `${sign}${groupedWhole}`;
}

function formatDuration(seconds: bigint): string {
  if (seconds === 0n) return "—";
  if (seconds % 86_400n === 0n) return `${seconds / 86_400n}d`;
  if (seconds % 3_600n === 0n) return `${seconds / 3_600n}h`;
  if (seconds % 60n === 0n) return `${seconds / 60n}m`;
  return `${seconds}s`;
}

function formatTimestamp(timestamp: bigint): string {
  if (timestamp === 0n) return "—";
  const seconds = Number(timestamp);
  return `${formatDate(seconds)} · ${formatClock(seconds)}`;
}
