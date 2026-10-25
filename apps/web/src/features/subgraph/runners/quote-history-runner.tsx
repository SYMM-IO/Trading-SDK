"use client";

import { useQuoteHistory, type UseQuoteHistoryParameters } from "@symmio/trading-react";
import { hookParameters, QueryRun, RUN_QUERY, type RunnerProps } from "./query-run";

export function QuoteHistoryRunner(props: RunnerProps) {
  const query = useQuoteHistory({ ...hookParameters<UseQuoteHistoryParameters>(props.parameters), query: RUN_QUERY });
  return <QueryRun query={query} {...props} />;
}
