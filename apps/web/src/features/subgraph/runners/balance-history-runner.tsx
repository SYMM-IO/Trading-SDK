"use client";

import { useBalanceHistory, type UseBalanceHistoryParameters } from "@symmio/trading-react";
import { hookParameters, QueryRun, RUN_QUERY, type RunnerProps } from "./query-run";

export function BalanceHistoryRunner(props: RunnerProps) {
  const query = useBalanceHistory({
    ...hookParameters<UseBalanceHistoryParameters>(props.parameters),
    query: RUN_QUERY,
  });
  return <QueryRun query={query} {...props} />;
}
