"use client";

import { useSubgraphQuotes, type UseSubgraphQuotesParameters } from "@symmio/trading-react";
import { hookParameters, QueryRun, RUN_QUERY, type RunnerProps } from "./query-run";

export function SubgraphQuotesRunner(props: RunnerProps) {
  const query = useSubgraphQuotes({
    ...hookParameters<UseSubgraphQuotesParameters>(props.parameters),
    query: RUN_QUERY,
  });
  return <QueryRun query={query} {...props} />;
}
