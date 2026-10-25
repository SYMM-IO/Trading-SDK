"use client";

import { useFundingIndexCheckpoints, type UseFundingIndexCheckpointsParameters } from "@symmio/trading-react";
import { hookParameters, QueryRun, RUN_QUERY, type RunnerProps } from "./query-run";

export function FundingIndexCheckpointsRunner(props: RunnerProps) {
  const query = useFundingIndexCheckpoints({
    ...hookParameters<UseFundingIndexCheckpointsParameters>(props.parameters),
    query: RUN_QUERY,
  });
  return <QueryRun query={query} {...props} />;
}
