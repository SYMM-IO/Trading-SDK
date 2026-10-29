"use client";

import { useQuoteEventsByType, type UseQuoteEventsByTypeParameters } from "@symmio/trading-react";
import { hookParameters, QueryRun, RUN_QUERY, type RunnerProps } from "./query-run";

export function QuoteEventsByTypeRunner(props: RunnerProps) {
  const query = useQuoteEventsByType({
    ...hookParameters<UseQuoteEventsByTypeParameters>(props.parameters),
    query: RUN_QUERY,
  });
  return <QueryRun query={query} {...props} />;
}
