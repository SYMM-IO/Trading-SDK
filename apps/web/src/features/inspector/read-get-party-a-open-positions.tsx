"use client";

import { AddressTag } from "@/components/address-tag";
import { Field } from "@/components/field";
import { ResultError, ResultNote } from "@/components/result";
import { TableSkeleton } from "@/components/skeletons";
import { WEI_DECIMALS } from "@/lib/format";
import { PositionType, QuoteStatus } from "@symmio/trading-core";
import { usePartyAOpenPositions } from "@symmio/trading-react";
import { Badge } from "@symmio/ui/components/badge";
import { Button } from "@symmio/ui/components/button";
import { DataTable, type DataTableColumn } from "@symmio/ui/components/data-table";
import { Input } from "@symmio/ui/components/input";
import { SearchInput } from "@symmio/ui/components/search-input";
import { Spinner } from "@symmio/ui/components/spinner";
import { formatTokenAmount } from "@symmio/utils";
import { useMemo, useState } from "react";
import { isAddress, type Address } from "viem";
import { MethodCard } from "./method-card";
import { PartyAField } from "./party-a-field";

type Position = NonNullable<ReturnType<typeof usePartyAOpenPositions>["data"]>[number];

function parseUint(value: string): bigint | undefined {
  if (!/^\d+$/.test(value.trim())) return undefined;
  return BigInt(value.trim());
}

function formatFixedPoint(raw: bigint): string {
  return formatTokenAmount(raw, WEI_DECIMALS, { maxFractionDigits: 6 });
}

const COLUMNS: DataTableColumn<Position>[] = [
  {
    id: "id",
    header: "Quote id",
    cell: (position) => String(position.id),
    sortAccessor: (position) => Number(position.id),
    cellClassName: "text-muted-foreground font-mono",
  },
  {
    id: "symbolId",
    header: "Market",
    cell: (position) => String(position.symbolId),
    sortAccessor: (position) => Number(position.symbolId),
    cellClassName: "text-foreground font-mono",
  },
  {
    id: "positionType",
    header: "Side",
    cell: (position) => (
      <Badge variant={position.positionType === PositionType.LONG ? "positive" : "destructive"}>
        {PositionType[position.positionType] ?? String(position.positionType)}
      </Badge>
    ),
    sortAccessor: (position) => position.positionType,
  },
  {
    id: "quoteStatus",
    header: "Status",
    cell: (position) => (
      <Badge variant="secondary">{QuoteStatus[position.quoteStatus] ?? String(position.quoteStatus)}</Badge>
    ),
    sortAccessor: (position) => position.quoteStatus,
  },
  {
    id: "quantity",
    header: "Quantity",
    align: "end",
    cell: (position) => formatFixedPoint(position.quantity),
    sortAccessor: (position) => Number(position.quantity),
    cellClassName: "text-foreground font-mono",
  },
  {
    id: "closedAmount",
    header: "Closed",
    align: "end",
    cell: (position) => formatFixedPoint(position.closedAmount),
    sortAccessor: (position) => Number(position.closedAmount),
    cellClassName: "text-muted-foreground font-mono",
  },
  {
    id: "openedPrice",
    header: "Open price",
    align: "end",
    cell: (position) => formatFixedPoint(position.openedPrice),
    sortAccessor: (position) => Number(position.openedPrice),
    cellClassName: "text-foreground font-mono",
  },
  {
    id: "partyB",
    header: "PartyB",
    cell: (position) => <AddressTag address={position.partyB} chars={4} />,
  },
];

export function ReadGetPartyAOpenPositions() {
  const [input, setInput] = useState<string>("");
  const [start, setStart] = useState("0");
  const [size, setSize] = useState("200");

  const validPartyA = isAddress(input) ? (input as Address) : undefined;
  const validStart = parseUint(start);
  const validSize = parseUint(size);
  const ready = Boolean(validPartyA) && validStart !== undefined && validSize !== undefined;

  const query = usePartyAOpenPositions({
    partyA: validPartyA,
    start: validStart ?? 0n,
    size: validSize ?? 0n,
    query: { enabled: false },
  });

  return (
    <MethodCard
      testId="method-getPartyAOpenPositions"
      name="getPartyAOpenPositions"
      magicMethodId="party-a-open-positions"
      magicMethodInput={input}
      mutability="view"
      description="Read a partyA's open positions (virtual account, lowcap)."
      wide
    >
      <PartyAField
        idPrefix="open-positions-partya"
        label="partyA (subaccount or VA address)"
        value={input}
        onValueChange={setInput}
        invalid={input.length > 0 && !validPartyA}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="start" htmlFor="input-open-positions-start">
          <Input
            id="input-open-positions-start"
            data-testid="input-open-positions-start"
            value={start}
            onChange={(event) => setStart(event.target.value)}
            placeholder="0"
            inputMode="numeric"
            aria-invalid={start.length > 0 && validStart === undefined}
          />
        </Field>

        <Field label="size" htmlFor="input-open-positions-size">
          <Input
            id="input-open-positions-size"
            data-testid="input-open-positions-size"
            value={size}
            onChange={(event) => setSize(event.target.value)}
            placeholder="200"
            inputMode="numeric"
            aria-invalid={size.length > 0 && validSize === undefined}
          />
        </Field>
      </div>

      <div className="flex items-center gap-3">
        <Button
          type="button"
          size="sm"
          disabled={!ready || query.isFetching}
          onClick={() => void query.refetch()}
          data-testid="button-read-open-positions"
        >
          {query.isFetching ? (
            <>
              <Spinner className="size-4" /> Reading…
            </>
          ) : (
            "Read open positions"
          )}
        </Button>

        {query.data ? (
          <span className="text-muted-foreground font-mono text-xs">
            {query.data.length} position{query.data.length === 1 ? "" : "s"}
          </span>
        ) : null}
      </div>

      <ResultPanel testId="result-getPartyAOpenPositions" query={query} />
    </MethodCard>
  );
}

function ResultPanel({ testId, query }: { testId: string; query: ReturnType<typeof usePartyAOpenPositions> }) {
  const [search, setSearch] = useState("");

  const visible = useMemo(() => {
    if (!query.data) return [];
    const term = search.trim().toLowerCase();
    return query.data.filter(
      (position) => term.length === 0 || String(position.id).includes(term) || String(position.symbolId).includes(term),
    );
  }, [query.data, search]);

  if (query.isLoading) {
    return <TableSkeleton rows={4} columns={8} alignEndFrom={4} testId={`${testId}-loading`} />;
  }
  if (query.error) {
    return <ResultError testId={`${testId}-error`} kind={query.error.kind} message={query.error.message} />;
  }
  if (!query.data) {
    return <ResultNote testId={`${testId}-idle`}>Run the read to see open positions.</ResultNote>;
  }
  if (query.data.length === 0) {
    return <ResultNote testId={`${testId}-empty`}>No open positions for this partyA.</ResultNote>;
  }

  return (
    <DataTable
      testId={`${testId}-data`}
      columns={COLUMNS}
      data={visible}
      totalCount={query.data.length}
      getRowId={(position) => String(position.id)}
      rowAttributes={(position) => ({ "data-quote-id": String(position.id) })}
      initialSort={{ columnId: "id", direction: "asc" }}
      defaultPageSize={5}
      emptyMessage="No open positions match this search."
      toolbar={
        <SearchInput
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search quote id or market…"
          data-testid="open-positions-search"
          aria-label="Search open positions"
        />
      }
    />
  );
}
