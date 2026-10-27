"use client";

import { useMarginTransfers, type UseMarginTransfersParameters } from "@symmio/trading-react";
import { hookParameters, QueryRun, RUN_QUERY, type RunnerProps } from "./query-run";

export function MarginTransfersRunner(props: RunnerProps) {
  const query = useMarginTransfers({
    ...hookParameters<UseMarginTransfersParameters>(props.parameters),
    query: RUN_QUERY,
  });
  return <QueryRun query={query} {...props} />;
}
