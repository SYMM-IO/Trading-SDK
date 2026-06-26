"use client";

import { ResultError, ResultNote } from "@/components/result";
import { TableSkeleton } from "@/components/skeletons";
import { MethodCard } from "@/features/inspector/method-card";
import { PartyAField } from "@/features/inspector/party-a-field";
import { OrderType, PositionType } from "@theoldvarorg/core";
import { useInstantOpens } from "@theoldvarorg/react";
import { Badge } from "@theoldvarorg/ui/components/badge";
import { Button } from "@theoldvarorg/ui/components/button";
import { DataTable, type DataTableColumn } from "@theoldvarorg/ui/components/data-table";
import { Spinner } from "@theoldvarorg/ui/components/spinner";
import { useState } from "react";
import { isAddress, type Address } from "viem";

type PendingOpen = NonNullable<ReturnType<typeof useInstantOpens>["data"]>[number];

const COLUMNS: DataTableColumn<PendingOpen>[] = [
  {
    id: "tempQuoteId",
    header: "Temp id",
    cell: (open) => String(open.tempQuoteId),
    sortAccessor: (open) => open.tempQuoteId,
    cellClassName: "text-muted-foreground font-mono",
  },
  {
    id: "marketId",
    header: "Market",
    cell: (open) => String(open.marketId),
    sortAccessor: (open) => open.marketId,
    cellClassName: "text-foreground font-mono",
  },
  {
    id: "positionType",
    header: "Side",
    cell: (open) => (
      <Badge variant={open.positionType === PositionType.LONG ? "positive" : "destructive"}>
        {PositionType[open.positionType] ?? String(open.positionType)}
      </Badge>
    ),
    sortAccessor: (open) => open.positionType,
  },
  {
    id: "orderType",
    header: "Type",
    cell: (open) => <Badge variant="secondary">{OrderType[open.orderType] ?? String(open.orderType)}</Badge>,
    sortAccessor: (open) => open.orderType,
  },
  {
    id: "requestedOpenPrice",
    header: "Open price",
    align: "end",
    cell: (open) => open.requestedOpenPrice,
    sortAccessor: (open) => Number(open.requestedOpenPrice),
    cellClassName: "text-foreground font-mono",
  },
  {
    id: "quantity",
    header: "Quantity",
    align: "end",
    cell: (open) => open.quantity,
    sortAccessor: (open) => Number(open.quantity),
    cellClassName: "text-foreground font-mono",
  },
  {
    id: "cva",
    header: "CVA",
    align: "end",
    cell: (open) => open.cva,
    sortAccessor: (open) => Number(open.cva),
    cellClassName: "text-muted-foreground font-mono",
  },
  {
    id: "lf",
    header: "LF",
    align: "end",
    cell: (open) => open.lf,
    sortAccessor: (open) => Number(open.lf),
    cellClassName: "text-muted-foreground font-mono",
  },
];

/**
 * Inspector card for the off-chain `getInstantOpens` read: a sub-account's
 * pending instant-open orders straight from the solver, before they are anchored
 * on-chain. One-shot read (use the magic sidebar for live polling).
 */
export function ReadInstantOpensCard() {
  const [input, setInput] = useState<string>("");
  const partyA = isAddress(input) ? (input as Address) : undefined;

  const query = useInstantOpens({ partyA: partyA ?? ZERO_ADDRESS, query: { enabled: false } });

  return (
    <MethodCard
      testId="method-getInstantOpens"
      name="getInstantOpens"
      magicMethodId="instant-opens"
      magicMethodInput={input}
      mutability="view"
      description="Read a sub-account's pending off-chain instant-open orders from the solver."
      wide
    >
      <PartyAField
        idPrefix="instant-opens-partya"
        label="partyA (subaccount or VA address)"
        value={input}
        onValueChange={setInput}
        invalid={input.length > 0 && !partyA}
      />

      <div className="flex items-center gap-3">
        <Button
          type="button"
          size="sm"
          disabled={!partyA || query.isFetching}
          onClick={() => void query.refetch()}
          data-testid="button-read-instant-opens"
        >
          {query.isFetching ? (
            <>
              <Spinner className="size-4" /> Reading…
            </>
          ) : (
            "Read instant opens"
          )}
        </Button>

        {query.data ? (
          <span className="text-muted-foreground font-mono text-xs">
            {query.data.length} order{query.data.length === 1 ? "" : "s"}
          </span>
        ) : null}
      </div>

      <ResultPanel testId="result-getInstantOpens" query={query} />
    </MethodCard>
  );
}

function ResultPanel({ testId, query }: { testId: string; query: ReturnType<typeof useInstantOpens> }) {
  if (query.isLoading && query.isFetching) {
    return <TableSkeleton rows={3} columns={8} alignEndFrom={4} testId={`${testId}-loading`} />;
  }
  if (query.error) {
    return <ResultError testId={`${testId}-error`} kind={query.error.kind} message={query.error.message} />;
  }
  if (!query.data) {
    return <ResultNote testId={`${testId}-idle`}>Run the read to see pending instant opens.</ResultNote>;
  }
  if (query.data.length === 0) {
    return <ResultNote testId={`${testId}-empty`}>No pending instant opens for this partyA.</ResultNote>;
  }

  return (
    <DataTable
      testId={`${testId}-data`}
      columns={COLUMNS}
      data={[...query.data]}
      totalCount={query.data.length}
      getRowId={(open) => String(open.tempQuoteId)}
      initialSort={{ columnId: "tempQuoteId", direction: "asc" }}
      defaultPageSize={5}
      emptyMessage="No pending instant opens."
    />
  );
}

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;
