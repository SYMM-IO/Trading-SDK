"use client";

import { useTransferHistory, type UseTransferHistoryParameters } from "@symmio/trading-react";
import { hookParameters, QueryRun, RUN_QUERY, type RunnerProps } from "./query-run";

export function TransferHistoryRunner(props: RunnerProps) {
  const query = useTransferHistory({
    ...hookParameters<UseTransferHistoryParameters>(props.parameters),
    query: RUN_QUERY,
  });
  return <QueryRun query={query} {...props} />;
}
