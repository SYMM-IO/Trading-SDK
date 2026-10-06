"use client";

import { ResultError, ResultNote } from "@/components/result";
import { TableSkeleton } from "@/components/skeletons";
import { formatUsd } from "@/lib/format";
import type { ExpressWithdrawStatus } from "@symmio/trading-core";
import {
  isExpressWithdrawPayoutComplete,
  useExpressWithdrawStatuses,
  usePendingWithdrawRequests,
  useSymmioConfig,
  type ExpressWithdrawStatusEntry,
} from "@symmio/trading-react";
import { Badge } from "@symmio/ui/components/badge";
import { Button } from "@symmio/ui/components/button";
import { DataTable, type DataTableColumn } from "@symmio/ui/components/data-table";
import { Spinner } from "@symmio/ui/components/spinner";
import { useState, type ReactNode } from "react";
import { isAddress, type Address } from "viem";
import { ExpressWithdrawConfigNote } from "./express-withdraw-config-note";
import { MethodCard } from "./method-card";
import { SubAccountField } from "./subaccount-field";

export function ReadExpressWithdrawStatuses() {
  const { addresses } = useSymmioConfig().getChainConfig();
  const [input, setInput] = useState<string>("");
  const validUser = isAddress(input) ? (input as Address) : undefined;

  const pending = usePendingWithdrawRequests({ user: validUser });
  /** Keeps the requests routed through the configured provider and polls each one independently. */
  const express = useExpressWithdrawStatuses({
    requests: pending.data ?? [],
    enabled: pending.data !== undefined,
  });

  return (
    <MethodCard
      testId="method-useExpressWithdrawStatuses"
      name="useExpressWithdrawStatuses"
      mutability="view"
      description="Rebuild a subaccount's active Express progress: its pending on-chain requests, filtered to the configured provider, each polled for service status."
      wide
    >
      <ExpressWithdrawConfigNote />

      <SubAccountField
        idPrefix="express-statuses-user"
        label="user (subaccount address)"
        value={input}
        onValueChange={setInput}
        invalid={input.length > 0 && !validUser}
      />

      <Button
        type="button"
        size="sm"
        disabled={!validUser || pending.isFetching}
        onClick={() => void pending.refetch()}
        data-testid="button-read-express-statuses"
      >
        {pending.isFetching || express.isFetching ? (
          <>
            <Spinner className="size-4" /> Reading…
          </>
        ) : (
          "Read"
        )}
      </Button>

      <ResultPanel
        testId="result-useExpressWithdrawStatuses"
        pending={pending}
        express={express}
        decimals={addresses.collateralDecimals}
      />
    </MethodCard>
  );
}

function ResultPanel({
  testId,
  pending,
  express,
  decimals,
}: {
  testId: string;
  pending: ReturnType<typeof usePendingWithdrawRequests>;
  express: ReturnType<typeof useExpressWithdrawStatuses>;
  decimals: number;
}) {
  if (pending.isLoading) {
    return <TableSkeleton rows={2} columns={6} alignEndFrom={1} testId={`${testId}-loading`} />;
  }
  if (pending.error) {
    return <ResultError testId={`${testId}-error`} kind={pending.error.kind} message={pending.error.message} />;
  }
  if (!pending.data) {
    return <ResultNote testId={`${testId}-idle`}>Pick a subaccount to reconcile its Express requests.</ResultNote>;
  }
  if (express.entries.length === 0) {
    return (
      <ResultNote testId={`${testId}-empty`}>
        No active Express requests — {pending.data.length} pending {pending.data.length === 1 ? "request" : "requests"}{" "}
        on this subaccount, none routed through the configured provider.
      </ResultNote>
    );
  }

  return (
    <DataTable
      testId={`${testId}-data`}
      columns={getEntryColumns(decimals)}
      data={[...express.entries]}
      getRowId={(entry) => String(entry.request.id)}
      rowAttributes={(entry) => ({ "data-request-id": String(entry.request.id) })}
      hidePagination
    />
  );
}

/**
 * A status-derived cell. Until the entry's first status read lands — or when it
 * failed — the option cell carries that state and the other status cells dash.
 */
function statusCell(
  entry: ExpressWithdrawStatusEntry,
  render: (status: ExpressWithdrawStatus) => ReactNode,
  showsState = false,
): ReactNode {
  if (entry.status) return render(entry.status);
  if (!showsState) return <span className="text-muted-foreground">—</span>;
  if (entry.error) return <span className="text-destructive text-xs">{entry.error.message}</span>;
  return (
    <span className="text-muted-foreground flex items-center gap-2">
      {entry.isFetching ? <Spinner className="size-3.5" /> : null} Checking service status…
    </span>
  );
}

function getEntryColumns(decimals: number): DataTableColumn<ExpressWithdrawStatusEntry>[] {
  return [
    {
      id: "id",
      header: "Id",
      cellClassName: "text-foreground font-mono",
      cell: (entry) => String(entry.request.id),
    },
    {
      id: "amount",
      header: "Amount",
      align: "end",
      cellClassName: "text-foreground font-mono",
      cell: (entry) => formatUsd(entry.request.totalAmount, decimals),
    },
    {
      id: "option",
      header: "Option",
      cellClassName: "text-foreground font-mono",
      cell: (entry) => statusCell(entry, (status) => status.onChain.optionType, true),
    },
    {
      id: "provider",
      header: "Provider",
      cell: (entry) => statusCell(entry, (status) => <Badge variant="secondary">{status.onChain.status}</Badge>),
    },
    {
      id: "service",
      header: "Service",
      cell: (entry) => statusCell(entry, (status) => <Badge variant="secondary">{status.local.status}</Badge>),
    },
    {
      id: "payout",
      header: "Payout",
      cell: (entry) =>
        statusCell(entry, (status) =>
          isExpressWithdrawPayoutComplete(status) ? (
            <Badge variant="positive">paid</Badge>
          ) : (
            <Badge variant="warning">pending</Badge>
          ),
        ),
    },
  ];
}
