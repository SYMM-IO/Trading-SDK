"use client";

import { useLiquidationDetails, type UseLiquidationDetailsParameters } from "@symmio/trading-react";
import { hookParameters, QueryRun, RUN_QUERY, type RunnerProps } from "./query-run";

export function LiquidationDetailsRunner(props: RunnerProps) {
  const query = useLiquidationDetails({
    ...hookParameters<UseLiquidationDetailsParameters>(props.parameters),
    query: RUN_QUERY,
  });
  return <QueryRun query={query} {...props} />;
}
