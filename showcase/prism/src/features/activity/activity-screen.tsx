"use client";

import { Panel, PanelHeader } from "@/components/panel";
import { Segmented, type SegmentedOption } from "@/components/segmented";
import { usePrismMode } from "@/features/mode/mode-provider";
import { NotificationType, QuoteCloseType } from "@symmio/trading-core";
import { useMemo, useState } from "react";
import { ActivityFilters } from "./activity-filters";
import {
  ALL_ACCOUNTS,
  DEFAULT_STATE_FILTERS,
  type AccountFilter,
  type ActivityTab,
  type FundingSignFilter,
  type SolverFilter,
  type StateFilters,
  type StreamStatusFilter,
  type TransferKindFilter,
} from "./activity-types";
import { FundingTab } from "./funding-tab";
import { LiveStreamTab } from "./live-stream-tab";
import { QuotesTab } from "./quotes-tab";
import { TransfersTab } from "./transfers-tab";
import { useActivityAccounts } from "./use-activity-accounts";

const TABS: readonly SegmentedOption<ActivityTab>[] = [
  { value: "quotes", label: "Quotes & fills" },
  { value: "transfers", label: "Transfers" },
  { value: "funding", label: "Funding" },
  { value: "stream", label: "Live stream" },
];

const TAB_TITLES: Record<ActivityTab, string> = {
  quotes: "Quotes & fills",
  transfers: "Transfers",
  funding: "Funding",
  stream: "Live stream",
};

const CLOSE_TYPES: readonly SegmentedOption<QuoteCloseType>[] = [
  { value: QuoteCloseType.All, label: "All" },
  { value: QuoteCloseType.Closed, label: "Closed" },
  { value: QuoteCloseType.Liquidated, label: "Liquidated" },
  { value: QuoteCloseType.ForceClosed, label: "Force" },
  { value: QuoteCloseType.EmergencyClosed, label: "Emergency" },
  { value: QuoteCloseType.AdlClosed, label: "ADL" },
];

const TRANSFER_KINDS: readonly SegmentedOption<TransferKindFilter>[] = [
  { value: "all", label: "All" },
  { value: "deposit", label: "Deposits" },
  { value: "withdraw", label: "Withdrawals" },
  { value: "internal", label: "Margin moves" },
];

const FUNDING_SIGNS: readonly SegmentedOption<FundingSignFilter>[] = [
  { value: "all", label: "All" },
  { value: "earned", label: "Earned" },
  { value: "paid", label: "Paid" },
];

const STREAM_STATUSES: readonly SegmentedOption<StreamStatusFilter>[] = [
  { value: "all", label: "All" },
  { value: NotificationType.SUCCESS, label: "Success" },
  { value: NotificationType.FAILED, label: "Failed" },
  { value: NotificationType.SEEN, label: "Seen" },
];

/**
 * History and live events from every deployment, in one blotter.
 *
 * Activity is where the multi-solver claim is easiest to break: a merged table
 * with no attribution turns two independent systems into one undifferentiated
 * list, and a merged table that silently drops a failing source lies about what
 * it covers. So every row carries the solver that produced it, and every source
 * that failed or is known to be unreliable says so above the rows it did not
 * fill in.
 */
export function ActivityScreen() {
  const { deployments, isUnified } = usePrismMode();
  const [tab, setTab] = useState<ActivityTab>("quotes");
  const [solver, setSolver] = useState<SolverFilter>("all");
  const [account, setAccount] = useState<AccountFilter>(ALL_ACCOUNTS);
  const [states, setStates] = useState<StateFilters>(DEFAULT_STATE_FILTERS);

  const accounts = useActivityAccounts(solver, account);

  const solverOptions = useMemo<SegmentedOption<SolverFilter>[]>(
    () => [
      { value: "all", label: "All" },
      ...deployments.map((deployment) => ({
        value: deployment.family as SolverFilter,
        label: deployment.label,
      })),
    ],
    [deployments],
  );

  /* The solver filter narrows within the palette mode; it never widens past it,
     so a mode-scoped app stays mode-scoped on this screen too. */
  const resolvedSolver = solverOptions.some((option) => option.value === solver) ? solver : "all";

  const sharedFilters = {
    solver: resolvedSolver,
    solverOptions,
    onSolverChange: setSolver,
    account: accounts.resolvedAccounts,
    accountGroups: accounts.optionGroups,
    onAccountChange: setAccount,
  };

  const eyebrow = isUnified
    ? `Merged · ${deployments.map((deployment) => deployment.label).join(" + ")}`
    : `Scoped to ${deployments[0]?.label ?? "—"} by the palette mode`;

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-5 px-5 py-6">
      <header className="flex flex-col gap-1.5">
        <h1 className="font-display text-3xl font-bold tracking-[-0.02em] text-fg-0">Activity</h1>
        <p className="max-w-[76ch] text-md text-fg-2">
          Settled history and the live solver event stream, merged across every deployment. Rasa settles on Base, Enigma
          on HyperEVM — the row tells you which, always.
        </p>
      </header>

      <Panel>
        <PanelHeader
          title={TAB_TITLES[tab]}
          eyebrow={eyebrow}
          actions={<Segmented options={TABS} value={tab} onChange={setTab} size="sm" />}
        />

        {tab === "quotes" ? (
          <ActivityFilters
            {...sharedFilters}
            stateLabel="Close type"
            state={states.quotes}
            stateOptions={CLOSE_TYPES}
            onStateChange={(value) => setStates((current) => ({ ...current, quotes: value }))}
          />
        ) : null}

        {tab === "transfers" ? (
          <ActivityFilters
            {...sharedFilters}
            stateLabel="Movement"
            state={states.transfers}
            stateOptions={TRANSFER_KINDS}
            onStateChange={(value) => setStates((current) => ({ ...current, transfers: value }))}
          />
        ) : null}

        {tab === "funding" ? (
          <ActivityFilters
            {...sharedFilters}
            stateLabel="Direction"
            state={states.funding}
            stateOptions={FUNDING_SIGNS}
            onStateChange={(value) => setStates((current) => ({ ...current, funding: value }))}
          />
        ) : null}

        {tab === "stream" ? (
          <ActivityFilters
            {...sharedFilters}
            stateLabel="Status"
            state={states.stream}
            stateOptions={STREAM_STATUSES}
            onStateChange={(value) => setStates((current) => ({ ...current, stream: value }))}
          />
        ) : null}

        {tab === "quotes" ? <QuotesTab accounts={accounts} closeType={states.quotes} /> : null}
        {tab === "transfers" ? <TransfersTab accounts={accounts} kind={states.transfers} /> : null}
        {tab === "funding" ? <FundingTab accounts={accounts} sign={states.funding} /> : null}
        {tab === "stream" ? <LiveStreamTab accounts={accounts} filter={states.stream} /> : null}
      </Panel>
    </div>
  );
}
