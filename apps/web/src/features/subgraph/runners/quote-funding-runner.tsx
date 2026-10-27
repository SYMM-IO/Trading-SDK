"use client";

import { WEI_DECIMALS } from "@/lib/format";
import { useQuotesFunding, type UseQuotesFundingParameters } from "@symmio/trading-react";
import { formatTokenAmount } from "@symmio/utils";
import { useMemo } from "react";
import { ResultView } from "../result-view";
import { hookParameters, type RunnerProps } from "./query-run";

function formatWei(value: bigint): string {
  return formatTokenAmount(value, WEI_DECIMALS, { maxFractionDigits: 6 });
}

/**
 * `useQuotesFunding` returns its own shape — rows aligned with the input quotes
 * plus running sums — and no `refetch`, so a Run remounts it to read again.
 */
export function QuoteFundingRunner(props: RunnerProps) {
  return <QuoteFundingRun key={props.runId} {...props} />;
}

function QuoteFundingRun({ read, parameters, collateralDecimals }: RunnerProps) {
  const input = hookParameters<UseQuotesFundingParameters>(parameters);
  const funding = useQuotesFunding({ ...input, query: { retry: false, refetchOnWindowFocus: false } });

  /** A quote the subgraph has no row for keeps its id and shows its amounts as not indexed. */
  const rows = useMemo(
    () =>
      funding.rows.map(
        (row, index) => row ?? { quoteId: input.quotes[index]?.quoteId, paid: null, received: null, netReceived: null },
      ),
    [funding.rows, input.quotes],
  );

  const summary = (
    <dl className="grid gap-x-6 gap-y-1 font-mono text-xs sm:grid-cols-4" data-testid="subgraph-funding-summary">
      <div>
        <dt className="text-muted-foreground">Σ paid</dt>
        <dd title={funding.paid.toString()}>{formatWei(funding.paid)}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Σ received</dt>
        <dd title={funding.received.toString()}>{formatWei(funding.received)}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Σ netReceived</dt>
        <dd title={funding.netReceived.toString()}>{formatWei(funding.netReceived)}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">missingQuoteIds</dt>
        <dd>{funding.missingQuoteIds.length > 0 ? funding.missingQuoteIds.join(", ") : "none"}</dd>
      </div>
    </dl>
  );

  return (
    <ResultView
      read={read}
      collateralDecimals={collateralDecimals}
      result={{
        rows: funding.isLoading ? undefined : rows,
        isLoading: funding.isLoading,
        isFetching: funding.isLoading,
        error: funding.error,
        summary,
      }}
    />
  );
}
