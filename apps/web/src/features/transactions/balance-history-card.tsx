"use client";

import { ResultError, ResultNote } from "@/components/result";
import { TableSkeleton } from "@/components/skeletons";
import { MethodCard } from "@/features/inspector/method-card";
import { SubAccountField } from "@/features/inspector/subaccount-field";
import { BalanceHistoryFilter, type BalanceHistoryRow, type InternalTransfersMode } from "@symmio/trading-core";
import { useBalanceHistory, useSymmioConfig } from "@symmio/trading-react";
import { Button } from "@symmio/ui/components/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@symmio/ui/components/select";
import { useState } from "react";
import { isAddress, type Address } from "viem";
import { BalanceHistoryTable } from "./balance-history-table";
import { HistoryPager } from "./history-pager";

/** The selectable movement filters, in display order. */
const FILTERS: readonly { value: BalanceHistoryFilter; label: string }[] = [
  { value: BalanceHistoryFilter.All, label: "All" },
  { value: BalanceHistoryFilter.Deposit, label: "Deposits" },
  { value: BalanceHistoryFilter.Withdraw, label: "Withdrawals" },
];

/**
 * Internal-transfer modes for the "Margin legs" select. Margin-transfer legs are
 * the WITHDRAW/DEPOSIT bookkeeping entries produced when margin moves between a
 * subaccount and its virtual accounts — not real deposits/withdrawals, and not
 * the from → to transfers shown on the Transfers page. Each option carries a
 * `description` that the dropdown renders under its label.
 */
const INTERNAL_TRANSFER_MODES: readonly {
  value: InternalTransfersMode;
  label: string;
  description: string;
}[] = [
  {
    value: "exclude",
    label: "Hide margin legs",
    description: "Default. Show only real deposits and withdrawals; drop the margin-transfer bookkeeping legs.",
  },
  {
    value: "include",
    label: "Show margin legs",
    description: "Include the margin-transfer legs alongside real deposits and withdrawals.",
  },
  {
    value: "only",
    label: "Only margin legs",
    description: "Show just the margin-transfer legs — margin moved between a subaccount and its virtual accounts.",
  },
];

/** Rows per page; one extra is fetched as a look-ahead to detect a next page. */
const PAGE_SIZE = 10;
const FETCH_SIZE = PAGE_SIZE + 1;

/**
 * Deposit / withdraw history card: pick a sub-account and read its settled
 * collateral movements from the analytics subgraph, filterable by deposits,
 * withdrawals, or both. Bridge withdraws are grouped under withdrawals.
 */
export function BalanceHistoryCard() {
  const { addresses } = useSymmioConfig().getChainConfig();
  const [input, setInput] = useState<string>("");
  const [filter, setFilter] = useState<BalanceHistoryFilter>(BalanceHistoryFilter.All);
  const [internalTransfers, setInternalTransfers] = useState<InternalTransfersMode>("exclude");
  const [page, setPage] = useState(1);
  const account = isAddress(input) ? (input as Address) : undefined;

  /** A new address or filter starts a fresh page run. */
  function changeInput(value: string) {
    setInput(value);
    setPage(1);
  }
  function changeFilter(value: BalanceHistoryFilter) {
    setFilter(value);
    setPage(1);
  }
  function changeInternalTransfers(value: InternalTransfersMode) {
    setInternalTransfers(value);
    setPage(1);
  }

  const query = useBalanceHistory({
    accounts: account ? [account] : [],
    filter,
    internalTransfers,
    first: FETCH_SIZE,
    skip: (page - 1) * PAGE_SIZE,
    // Keep the previous page visible while the next one loads (no skeleton flash on paging).
    query: { placeholderData: (prev) => prev },
  });

  const rows = query.data?.rows ?? [];
  // The look-ahead row (the FETCH_SIZE-th) never renders — it only proves a next page exists.
  const displayRows = rows.slice(0, PAGE_SIZE);
  const hasNextPage = rows.length > PAGE_SIZE;
  const showPager = Boolean(account) && !(query.isLoading && !query.data);

  return (
    <MethodCard
      testId="method-balanceHistory"
      name="useBalanceHistory"
      mutability="view"
      description="Read a subaccount's deposit / withdraw history from the analytics subgraph, filterable by movement type. Internal margin-transfer legs are excluded by default."
      wide
    >
      <SubAccountField
        idPrefix="balance-history-account"
        label="account (subaccount address)"
        value={input}
        onValueChange={changeInput}
        invalid={input.length > 0 && !account}
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1" role="group" aria-label="Filter by movement type">
          {FILTERS.map((option) => (
            <Button
              key={option.value}
              type="button"
              size="sm"
              variant={filter === option.value ? "default" : "ghost"}
              onClick={() => changeFilter(option.value)}
              data-testid={`balance-history-filter-${option.value.toLowerCase()}`}
              aria-pressed={filter === option.value}
            >
              {option.label}
            </Button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground text-xs">Margin legs</span>
          <Select
            value={internalTransfers}
            onValueChange={(value) => changeInternalTransfers(value as InternalTransfersMode)}
          >
            <SelectTrigger
              className="h-8 w-44 text-xs"
              data-testid="balance-history-internal"
              aria-label="Margin-transfer legs"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INTERNAL_TRANSFER_MODES.map((mode) => (
                <SelectItem
                  key={mode.value}
                  value={mode.value}
                  description={mode.description}
                  className="max-w-xs"
                  data-testid={`balance-history-internal-${mode.value}`}
                >
                  {mode.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {account ? (
          <button
            type="button"
            onClick={() => void query.refetch()}
            data-testid="balance-history-refresh"
            className="text-muted-foreground hover:text-foreground ml-auto text-xs transition-colors"
          >
            Refresh
          </button>
        ) : null}
      </div>

      <ResultPanel
        testId="result-balanceHistory"
        query={query}
        rows={displayRows}
        page={page}
        decimals={addresses.collateralDecimals}
      />

      {showPager ? (
        <HistoryPager
          testId="balance-history-pager"
          page={page}
          hasNextPage={hasNextPage}
          busy={query.isFetching}
          onPrev={() => setPage((current) => Math.max(1, current - 1))}
          onNext={() => setPage((current) => current + 1)}
        />
      ) : null}
    </MethodCard>
  );
}

function ResultPanel({
  testId,
  query,
  rows,
  page,
  decimals,
}: {
  testId: string;
  query: ReturnType<typeof useBalanceHistory>;
  rows: BalanceHistoryRow[];
  page: number;
  decimals: number;
}) {
  if (query.fetchStatus === "idle" && !query.data) {
    return <ResultNote testId={`${testId}-idle`}>Enter a subaccount address to load its history.</ResultNote>;
  }
  if (query.isLoading && !query.data) {
    return <TableSkeleton rows={5} columns={4} alignEndFrom={1} testId={`${testId}-loading`} />;
  }
  if (query.error) {
    return <ResultError testId={`${testId}-error`} kind={query.error.kind} message={query.error.message} />;
  }
  if (rows.length === 0) {
    return (
      <ResultNote testId={`${testId}-empty`}>
        {page > 1 ? "No more history on this page." : "No matching history for this subaccount."}
      </ResultNote>
    );
  }
  return <BalanceHistoryTable testId={`${testId}-data`} rows={rows} decimals={decimals} hidePagination />;
}
