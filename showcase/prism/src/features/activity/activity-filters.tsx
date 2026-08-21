"use client";

import { MicroLabel } from "@/components/panel";
import { Segmented, type SegmentedOption } from "@/components/segmented";
import type { ReactNode } from "react";
import { AccountFilterCombobox } from "./account-filter-combobox";
import type { AccountFilter, SolverFilter } from "./activity-types";
import type { ActivityAccountOptionGroup } from "./use-activity-accounts";

export interface ActivityFiltersProps<T extends string> {
  solver: SolverFilter;
  solverOptions: readonly SegmentedOption<SolverFilter>[];
  onSolverChange: (value: SolverFilter) => void;
  account: AccountFilter;
  accountGroups: readonly ActivityAccountOptionGroup[];
  onAccountChange: (value: AccountFilter) => void;
  /** Micro-label over the per-tab state control, e.g. "Close type". */
  stateLabel: string;
  state: T;
  stateOptions: readonly SegmentedOption<T>[];
  onStateChange: (value: T) => void;
  /** Right-aligned extras — a live indicator, a row count. */
  trailing?: ReactNode;
}

/**
 * The filter bar every Activity tab shares.
 *
 * Solver and account are genuinely shared — they select which deployments and
 * which sub-accounts every read on the screen targets. The third control is
 * the tab's own state filter, kept in the same slot so the bar's shape never
 * moves when the tab changes; only its options do.
 */
export function ActivityFilters<T extends string>({
  solver,
  solverOptions,
  onSolverChange,
  account,
  accountGroups,
  onAccountChange,
  stateLabel,
  state,
  stateOptions,
  onStateChange,
  trailing,
}: ActivityFiltersProps<T>) {
  return (
    <div className="flex flex-wrap items-end gap-x-5 gap-y-3 border-b border-line-subtle px-4 py-3">
      <div className="flex flex-col gap-1.5">
        <MicroLabel>Solver</MicroLabel>
        <Segmented options={solverOptions} value={solver} onChange={onSolverChange} size="sm" />
      </div>

      <div className="flex flex-col gap-1.5">
        <MicroLabel>Accounts</MicroLabel>
        <AccountFilterCombobox value={account} groups={accountGroups} onChange={onAccountChange} />
      </div>

      <div className="flex flex-col gap-1.5">
        <MicroLabel>{stateLabel}</MicroLabel>
        <Segmented options={stateOptions} value={state} onChange={onStateChange} size="sm" />
      </div>

      {trailing ? <div className="ml-auto flex items-center gap-2 pb-0.5">{trailing}</div> : null}
    </div>
  );
}
