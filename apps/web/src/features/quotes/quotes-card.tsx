"use client";
import { ResultError, ResultNote } from "@/components/result";
import { TableSkeleton } from "@/components/skeletons";
import { StatusDot } from "@/components/status-dot";
import { MethodCard } from "@/features/inspector/method-card";
import { PartyAField } from "@/features/inspector/party-a-field";
import { socketStatusLabel, socketStatusTone } from "@/features/websocket/socket-status-display";
import { useManagedQuotes } from "@theoldvarorg/react";
import { SearchInput } from "@theoldvarorg/ui/components/search-input";
import { useMemo, useState } from "react";
import { isAddress, type Address } from "viem";
import { QuotesTable } from "./quotes-table";

/**
 * Solvers-page card for the managed quotes feed: pick a partyA and watch its
 * fully-reconciled quote list — on-chain positions, pending instant-opens, and
 * pending instant-closes merged into one stable, lifecycle-tagged table. The
 * feed is hybrid: it polls every source and uses the notifications socket to
 * accelerate polling, so a live socket status indicator sits beside the input.
 */
export function QuotesCard() {
  const [input, setInput] = useState<string>("");
  const [search, setSearch] = useState("");
  const partyA = isAddress(input) ? (input as Address) : undefined;

  const { quotes, accounts, isLoading, isFetching, socketStatus, error, refetch } = useManagedQuotes({
    partyA,
    live: true,
    enabled: Boolean(partyA),
    includeVirtualAccounts: true,
  });

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (term.length === 0) return quotes;
    return quotes.filter(
      (quote) =>
        quote.key.toLowerCase().includes(term) ||
        String(quote.quoteId ?? "").includes(term) ||
        String(quote.tempQuoteId ?? "").includes(term) ||
        String(quote.symbolId).includes(term),
    );
  }, [quotes, search]);

  return (
    <MethodCard
      testId="method-managedQuotes"
      name="useManagedQuotes"
      magicMethodId="managed-quotes"
      magicMethodInput={input}
      mutability="view"
      description="Reconcile a partyA's on-chain positions, pending instant-opens, and pending instant-closes into one lifecycle-tagged quote feed."
      wide
    >
      <PartyAField
        idPrefix="managed-quotes-partya"
        label="partyA (subaccount or VA address)"
        value={input}
        onValueChange={setInput}
        invalid={input.length > 0 && !partyA}
      />

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <StatusDot tone={socketStatusTone(socketStatus)} pulse={socketStatus === "open"} />
        <span className="text-muted-foreground">{socketStatusLabel(socketStatus)}</span>
        {partyA && accounts.length > 0 ? (
          <span className="text-muted-foreground" title="Sub-account + Virtual Accounts scanned">
            · {accounts.length} account{accounts.length === 1 ? "" : "s"}
          </span>
        ) : null}
        {isFetching ? <span className="text-muted-foreground">· syncing…</span> : null}
        {partyA ? (
          <button
            type="button"
            onClick={() => refetch()}
            data-testid="managed-quotes-refresh"
            className="text-muted-foreground hover:text-foreground ml-auto transition-colors"
          >
            Refresh
          </button>
        ) : null}
      </div>

      <ResultPanel
        testId="result-managedQuotes"
        partyA={partyA}
        isLoading={isLoading}
        error={error}
        quotes={quotes}
        visible={visible}
        search={search}
        onSearchChange={setSearch}
      />
    </MethodCard>
  );
}

function ResultPanel({
  testId,
  partyA,
  isLoading,
  error,
  quotes,
  visible,
  search,
  onSearchChange,
}: {
  testId: string;
  partyA: Address | undefined;
  isLoading: boolean;
  error: ReturnType<typeof useManagedQuotes>["error"];
  quotes: ReturnType<typeof useManagedQuotes>["quotes"];
  visible: ReturnType<typeof useManagedQuotes>["quotes"];
  search: string;
  onSearchChange: (value: string) => void;
}) {
  if (!partyA) {
    return <ResultNote testId={`${testId}-idle`}>Enter a partyA address to load its managed quotes.</ResultNote>;
  }
  if (isLoading) {
    return <TableSkeleton rows={4} columns={13} alignEndFrom={6} testId={`${testId}-loading`} />;
  }
  if (error) {
    return <ResultError testId={`${testId}-error`} kind={error.kind} message={error.message} />;
  }
  if (quotes.length === 0) {
    return <ResultNote testId={`${testId}-empty`}>No quotes for this partyA.</ResultNote>;
  }

  return (
    <QuotesTable
      testId={`${testId}-data`}
      quotes={visible}
      totalCount={quotes.length}
      defaultPageSize={5}
      emptyMessage="No quotes match this search."
      toolbar={
        <SearchInput
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search id or market…"
          data-testid="managed-quotes-search"
          aria-label="Search managed quotes"
        />
      }
    />
  );
}
