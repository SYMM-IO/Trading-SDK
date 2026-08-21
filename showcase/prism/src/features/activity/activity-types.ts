import type { Deployment, MarketFamily } from "@/config/deployments";
import { QuoteCloseType, type NotificationType } from "@symmio/trading-core";
import type { Address } from "viem";

/** The four views the Activity screen switches between. */
export type ActivityTab = "quotes" | "transfers" | "funding" | "stream";

/**
 * Solver filter for the merged view.
 *
 * Activity is the one screen that deliberately shows both deployments at once,
 * so provenance has to be filterable as well as visible: `all` keeps the merged
 * blotter, a family narrows it to that solver's rows.
 */
export type SolverFilter = "all" | MarketFamily;

/**
 * Account filter: the sub-accounts every read on the screen targets.
 *
 * An empty selection means *every* in-scope account rather than none. A filter
 * that can be emptied into showing zero rows is a trap — the user clears the
 * last chip and the screen reads as broken — so "nothing chosen" and "no
 * narrowing" are deliberately the same state here.
 */
export type AccountFilter = readonly Address[];

/** Opening account filter: no narrowing. */
export const ALL_ACCOUNTS: AccountFilter = [];

/** Which kinds of collateral movement the Transfers tab shows. */
export type TransferKindFilter = "all" | "deposit" | "withdraw" | "internal";

/** Which side of the funding ledger the Funding tab shows. */
export type FundingSignFilter = "all" | "earned" | "paid";

/** Which notification classifications the Live stream tab shows. */
export type StreamStatusFilter = "all" | NotificationType;

/**
 * The state filter, held per tab so switching tabs never silently drops a
 * choice the user made on another one.
 */
export interface StateFilters {
  quotes: QuoteCloseType;
  transfers: TransferKindFilter;
  funding: FundingSignFilter;
  stream: StreamStatusFilter;
}

/** Opening state-filter values: every tab unfiltered. */
export const DEFAULT_STATE_FILTERS: StateFilters = {
  quotes: QuoteCloseType.All,
  transfers: "all",
  funding: "all",
  stream: "all",
};

/**
 * Per-deployment outcome of one merged read.
 *
 * A merged table cannot say "no activity" honestly unless it knows, for every
 * deployment it claims to cover, whether that deployment answered, failed, or
 * was never asked. The inline notices are rendered from exactly this.
 */
export interface DeploymentReadState {
  deployment: Deployment;
  isLoading: boolean;
  error: Error | null;
  /** Rows this deployment contributed — separates "empty" from "never answered". */
  rowCount: number;
  /** `false` when the read never ran, e.g. no funding account exists on that chain. */
  attempted: boolean;
}
