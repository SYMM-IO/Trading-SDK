"use client";

import type { ComponentType } from "react";
import type { ReadId } from "./read-catalog";
import { BalanceHistoryRunner } from "./runners/balance-history-runner";
import { FundingIndexCheckpointsRunner } from "./runners/funding-index-checkpoints-runner";
import { LiquidationDetailsRunner } from "./runners/liquidation-details-runner";
import { MarginTransfersRunner } from "./runners/margin-transfers-runner";
import type { RunnerProps } from "./runners/query-run";
import { QuoteEventsByTypeRunner } from "./runners/quote-events-by-type-runner";
import { QuoteFundingRunner } from "./runners/quote-funding-runner";
import { QuoteFundingSettlementsRunner } from "./runners/quote-funding-settlements-runner";
import { QuoteHistoryRunner } from "./runners/quote-history-runner";
import { SubgraphQuotesRunner } from "./runners/subgraph-quotes-runner";
import { TransferHistoryRunner } from "./runners/transfer-history-runner";

/**
 * One component per read: a hook cannot be chosen at runtime, so each read calls
 * its own. Switching reads swaps the component, which remounts the hook.
 */
const RUNNERS: Record<ReadId, ComponentType<RunnerProps>> = {
  getBalanceHistory: BalanceHistoryRunner,
  getTransferHistory: TransferHistoryRunner,
  getMarginTransfers: MarginTransfersRunner,
  getLiquidationDetails: LiquidationDetailsRunner,
  getQuoteHistory: QuoteHistoryRunner,
  getSubgraphQuotes: SubgraphQuotesRunner,
  getQuoteEventsByType: QuoteEventsByTypeRunner,
  getQuoteFunding: QuoteFundingRunner,
  getQuoteFundingSettlements: QuoteFundingSettlementsRunner,
  getFundingIndexCheckpoints: FundingIndexCheckpointsRunner,
};

/** Run the committed request through the selected read's hook. */
export function ReadRunner(props: RunnerProps) {
  const Runner = RUNNERS[props.read.id];
  return <Runner {...props} />;
}
