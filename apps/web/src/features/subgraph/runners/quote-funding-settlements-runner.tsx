"use client";

import { useQuoteFundingSettlements, type UseQuoteFundingSettlementsParameters } from "@symmio/trading-react";
import { hookParameters, QueryRun, RUN_QUERY, type RunnerProps } from "./query-run";

export function QuoteFundingSettlementsRunner(props: RunnerProps) {
  const query = useQuoteFundingSettlements({
    ...hookParameters<UseQuoteFundingSettlementsParameters>(props.parameters),
    query: RUN_QUERY,
  });
  return <QueryRun query={query} {...props} />;
}
