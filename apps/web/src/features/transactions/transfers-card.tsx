"use client";

import { ResultError, ResultNote } from "@/components/result";
import { TableSkeleton } from "@/components/skeletons";
import { MethodCard } from "@/features/inspector/method-card";
import { SubAccountField } from "@/features/inspector/subaccount-field";
import type { TransferDirection, TransferRow } from "@symmio/trading-core";
import { useTransferHistory } from "@symmio/trading-react";
import { Button } from "@symmio/ui/components/button";
import { useState } from "react";
import { isAddress, type Address } from "viem";
import { HistoryPager } from "./history-pager";
import { TransfersTable } from "./transfers-table";

/** The selectable directions, in display order. */
const DIRECTIONS: readonly { value: TransferDirection; label: string }[] = [
  { value: "all", label: "All" },
  { value: "outgoing", label: "Sent" },
  { value: "incoming", label: "Received" },
];

/** Rows per page; one extra is fetched as a look-ahead to detect a next page. */
const PAGE_SIZE = 10;
const FETCH_SIZE = PAGE_SIZE + 1;

/**
 * Transfer history card: pick a sub-account and read its internal transfers
 * (margin moves between SYMMIO accounts) from the events subgraph, filterable by
 * direction. Shows the raw `from → to` endpoints — the source behind a Vibe-style
 * Transfer tab.
 */
export function TransfersCard() {
  const [input, setInput] = useState<string>("");
  const [direction, setDirection] = useState<TransferDirection>("all");
  const [page, setPage] = useState(1);
  const account = isAddress(input) ? (input as Address) : undefined;

  /** A new address or filter starts a fresh page run. */
  function changeInput(value: string) {
    setInput(value);
    setPage(1);
  }
  function changeDirection(value: TransferDirection) {
    setDirection(value);
    setPage(1);
  }

  const query = useTransferHistory({
    accounts: account ? [account] : [],
    direction,
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
      testId="method-transferHistory"
      name="useTransferHistory"
      mutability="view"
      description="Read a subaccount's internal transfers (margin moves between SYMMIO accounts) from the events subgraph, filterable by direction."
      wide
    >
      <SubAccountField
        idPrefix="transfer-history-account"
        label="account (subaccount address)"
        value={input}
        onValueChange={changeInput}
        invalid={input.length > 0 && !account}
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1" role="group" aria-label="Filter by direction">
          {DIRECTIONS.map((option) => (
            <Button
              key={option.value}
              type="button"
              size="sm"
              variant={direction === option.value ? "default" : "ghost"}
              onClick={() => changeDirection(option.value)}
              data-testid={`transfer-history-direction-${option.value}`}
              aria-pressed={direction === option.value}
            >
              {option.label}
            </Button>
          ))}
        </div>

        {account ? (
          <button
            type="button"
            onClick={() => void query.refetch()}
            data-testid="transfer-history-refresh"
            className="text-muted-foreground hover:text-foreground ml-auto text-xs transition-colors"
          >
            Refresh
          </button>
        ) : null}
      </div>

      <ResultPanel testId="result-transferHistory" query={query} rows={displayRows} page={page} />

      {showPager ? (
        <HistoryPager
          testId="transfer-history-pager"
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
}: {
  testId: string;
  query: ReturnType<typeof useTransferHistory>;
  rows: TransferRow[];
  page: number;
}) {
  if (query.fetchStatus === "idle" && !query.data) {
    return <ResultNote testId={`${testId}-idle`}>Enter a subaccount address to load its transfers.</ResultNote>;
  }
  if (query.isLoading && !query.data) {
    return <TableSkeleton rows={5} columns={5} alignEndFrom={2} testId={`${testId}-loading`} />;
  }
  if (query.error) {
    return <ResultError testId={`${testId}-error`} kind={query.error.kind} message={query.error.message} />;
  }
  if (rows.length === 0) {
    return (
      <ResultNote testId={`${testId}-empty`}>
        {page > 1 ? "No more transfers on this page." : "No transfers for this subaccount."}
      </ResultNote>
    );
  }
  return <TransfersTable testId={`${testId}-data`} rows={rows} hidePagination />;
}
