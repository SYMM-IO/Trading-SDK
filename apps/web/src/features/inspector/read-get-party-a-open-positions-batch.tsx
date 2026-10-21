"use client";

import { AddressTag } from "@/components/address-tag";
import { Field } from "@/components/field";
import { ResultError, ResultNote } from "@/components/result";
import { TableSkeleton } from "@/components/skeletons";
import { WEI_DECIMALS } from "@/lib/format";
import { PositionType, QuoteStatus } from "@symmio/trading-core";
import { usePartyAOpenPositionsBatch } from "@symmio/trading-react";
import { Badge } from "@symmio/ui/components/badge";
import { Button } from "@symmio/ui/components/button";
import { DataTable, type DataTableColumn } from "@symmio/ui/components/data-table";
import { Input } from "@symmio/ui/components/input";
import { Label } from "@symmio/ui/components/label";
import { SearchInput } from "@symmio/ui/components/search-input";
import { Spinner } from "@symmio/ui/components/spinner";
import { Switch } from "@symmio/ui/components/switch";
import { formatTokenAmount } from "@symmio/utils";
import { useMemo, useState } from "react";
import { isAddress, type Address } from "viem";
import { MethodCard } from "./method-card";
import { PartyAField } from "./party-a-field";

type BatchResult = NonNullable<ReturnType<typeof usePartyAOpenPositionsBatch>["data"]>[number];
type Position = Extract<BatchResult, { status: "success" }>["quotes"][number];

/** A selected account plus the `start` typed for it. */
interface AccountInput {
  address: Address;
  start: string;
}

interface PositionRow {
  partyA: Address;
  position: Position;
}

function parseUint(value: string): bigint | undefined {
  if (!/^\d+$/.test(value.trim())) return undefined;
  return BigInt(value.trim());
}

function parsePositiveInt(value: string): number | undefined {
  if (!/^\d+$/.test(value.trim())) return undefined;
  const parsed = Number(value.trim());
  return parsed >= 1 ? parsed : undefined;
}

function formatFixedPoint(raw: bigint): string {
  return formatTokenAmount(raw, WEI_DECIMALS, { maxFractionDigits: 6 });
}

export function ReadGetPartyAOpenPositionsBatch() {
  const [draft, setDraft] = useState("");
  const [accounts, setAccounts] = useState<AccountInput[]>([]);
  const [size, setSize] = useState("200");
  const [batchSize, setBatchSize] = useState("10");
  const [includeLiquidationStatus, setIncludeLiquidationStatus] = useState(true);

  const validSize = parseUint(size);
  const validBatchSize = parsePositiveInt(batchSize);
  const startsValid = accounts.every(
    (account) => account.start.trim() === "" || parseUint(account.start) !== undefined,
  );
  const ready = accounts.length > 0 && startsValid && validSize !== undefined && validBatchSize !== undefined;

  const partyAs = useMemo(
    () =>
      accounts.map((account) => {
        const start = parseUint(account.start);
        return start ? { partyA: account.address, start } : account.address;
      }),
    [accounts],
  );
  const distinctReads = new Set(accounts.map((account) => `${account.address.toLowerCase()}:${account.start || "0"}`))
    .size;
  const multicalls = validBatchSize ? Math.ceil(distinctReads / validBatchSize) : 0;

  const query = usePartyAOpenPositionsBatch({
    partyAs,
    size: validSize ?? 0n,
    includeLiquidationStatus,
    batchSize: validBatchSize ?? 1,
    query: { enabled: false },
  });

  function add(address: Address) {
    setAccounts((previous) =>
      previous.some((account) => account.address.toLowerCase() === address.toLowerCase())
        ? previous
        : [...previous, { address, start: "" }],
    );
  }

  /** A picked or completely pasted address joins the list; anything else is still being typed. */
  function onDraftChange(value: string) {
    if (isAddress(value)) {
      add(value);
      setDraft("");
      return;
    }
    setDraft(value);
  }

  function remove(address: string) {
    setAccounts((previous) => previous.filter((account) => account.address.toLowerCase() !== address.toLowerCase()));
  }

  function setStart(address: Address, start: string) {
    setAccounts((previous) =>
      previous.map((account) => (account.address === address ? { ...account, start } : account)),
    );
  }

  return (
    <MethodCard
      testId="method-getPartyAOpenPositionsBatch"
      name="getPartyAOpenPositionsBatch"
      mutability="view"
      description="Read the open positions of many partyAs — any mix of subaccounts and VAs — in chunked multicalls, one result per account."
      wide
    >
      <PartyAField
        idPrefix="open-positions-batch-partya"
        label="partyAs (subaccounts and VAs)"
        hint="Pick or paste accounts one at a time — each joins the list below, and results come back in that order."
        value={draft}
        onValueChange={onDraftChange}
        invalid={draft.length > 0 && !isAddress(draft)}
        selectedAddresses={accounts.map((account) => account.address)}
      />

      {accounts.length > 0 ? (
        <div data-testid="open-positions-batch-selected" className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-xs">
              {accounts.length} account{accounts.length === 1 ? "" : "s"} selected
            </span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setAccounts([])}
              data-testid="open-positions-batch-clear"
            >
              Clear
            </Button>
          </div>
          {accounts.map((account) => (
            <div
              key={account.address}
              data-testid="open-positions-batch-selected-row"
              data-address={account.address}
              className="border-border/60 flex items-center gap-2 rounded-lg border px-2.5 py-1.5"
            >
              <AddressTag address={account.address} chars={6} className="min-w-0 flex-1" />
              <Input
                aria-label={`start for ${account.address}`}
                data-testid="open-positions-batch-start"
                value={account.start}
                onChange={(event) => setStart(account.address, event.target.value)}
                placeholder="start 0"
                inputMode="numeric"
                className="h-8 w-24 font-mono"
                aria-invalid={account.start.trim() !== "" && parseUint(account.start) === undefined}
              />
              <Button
                type="button"
                size="sm"
                variant="ghost"
                aria-label={`Remove ${account.address}`}
                onClick={() => remove(account.address)}
                data-testid="open-positions-batch-remove"
              >
                ✕
              </Button>
            </div>
          ))}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="size (per account)" htmlFor="input-open-positions-batch-size">
          <Input
            id="input-open-positions-batch-size"
            data-testid="input-open-positions-batch-size"
            value={size}
            onChange={(event) => setSize(event.target.value)}
            placeholder="200"
            inputMode="numeric"
            aria-invalid={size.length > 0 && validSize === undefined}
          />
        </Field>

        <Field label="batchSize (accounts per multicall)" htmlFor="input-open-positions-batch-batch-size">
          <Input
            id="input-open-positions-batch-batch-size"
            data-testid="input-open-positions-batch-batch-size"
            value={batchSize}
            onChange={(event) => setBatchSize(event.target.value)}
            placeholder="10"
            inputMode="numeric"
            aria-invalid={batchSize.length > 0 && validBatchSize === undefined}
          />
        </Field>

        <div className="flex items-end justify-between gap-3 pb-2">
          <Label htmlFor="switch-open-positions-batch-liquidation">includeLiquidationStatus</Label>
          <Switch
            id="switch-open-positions-batch-liquidation"
            data-testid="switch-open-positions-batch-liquidation"
            checked={includeLiquidationStatus}
            onCheckedChange={setIncludeLiquidationStatus}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          size="sm"
          disabled={!ready || query.isFetching}
          onClick={() => void query.refetch()}
          data-testid="button-read-open-positions-batch"
        >
          {query.isFetching ? (
            <>
              <Spinner className="size-4" /> Reading…
            </>
          ) : (
            "Read open positions"
          )}
        </Button>

        {distinctReads > 0 && multicalls > 0 ? (
          <span data-testid="open-positions-batch-plan" className="text-muted-foreground font-mono text-xs">
            {distinctReads} read{distinctReads === 1 ? "" : "s"} → {multicalls} multicall{multicalls === 1 ? "" : "s"}
            {includeLiquidationStatus ? " (+ liquidation flag per account)" : ""}
          </span>
        ) : null}
      </div>

      <ResultPanel testId="result-getPartyAOpenPositionsBatch" query={query} />
    </MethodCard>
  );
}

function ResultPanel({ testId, query }: { testId: string; query: ReturnType<typeof usePartyAOpenPositionsBatch> }) {
  const [search, setSearch] = useState("");

  const accountRows = useMemo(() => [...(query.data ?? [])], [query.data]);
  const positions = useMemo<PositionRow[]>(
    () =>
      query.data?.flatMap((result) =>
        result.status === "success" ? result.quotes.map((position) => ({ partyA: result.partyA, position })) : [],
      ) ?? [],
    [query.data],
  );
  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (term.length === 0) return positions;
    return positions.filter(
      ({ partyA, position }) =>
        String(position.id).includes(term) ||
        String(position.symbolId).includes(term) ||
        partyA.toLowerCase().includes(term),
    );
  }, [positions, search]);

  if (query.isLoading) {
    return <TableSkeleton rows={4} columns={7} alignEndFrom={4} testId={`${testId}-loading`} />;
  }
  if (query.error) {
    return <ResultError testId={`${testId}-error`} kind={query.error.kind} message={query.error.message} />;
  }
  if (!query.data) {
    return <ResultNote testId={`${testId}-idle`}>Pick accounts and run the read.</ResultNote>;
  }

  return (
    <div className="space-y-4">
      <DataTable
        testId={`${testId}-accounts`}
        columns={ACCOUNT_COLUMNS}
        data={accountRows}
        getRowId={(result) => `${result.partyA}:${result.start}`}
        rowAttributes={(result) => ({ "data-party-a": result.partyA, "data-status": result.status })}
        defaultPageSize={10}
      />

      {positions.length === 0 ? (
        <ResultNote testId={`${testId}-empty`}>No open positions across these accounts.</ResultNote>
      ) : (
        <DataTable
          testId={`${testId}-positions`}
          columns={POSITION_COLUMNS}
          data={visible}
          totalCount={positions.length}
          getRowId={({ partyA, position }) => `${partyA}:${position.id}`}
          rowAttributes={({ position }) => ({ "data-quote-id": String(position.id) })}
          initialSort={{ columnId: "id", direction: "asc" }}
          defaultPageSize={5}
          emptyMessage="No open positions match this search."
          toolbar={
            <SearchInput
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search quote id, market or partyA…"
              data-testid="open-positions-batch-search"
              aria-label="Search open positions"
            />
          }
        />
      )}
    </div>
  );
}

function LiquidationCell({ result }: { result: BatchResult }) {
  if (result.status !== "success" || !("isLiquidated" in result)) return <>—</>;
  if (result.isLiquidated === undefined) return <Badge variant="warning">unknown</Badge>;
  return result.isLiquidated ? (
    <Badge variant="destructive">in liquidation</Badge>
  ) : (
    <Badge variant="secondary">no</Badge>
  );
}

const ACCOUNT_COLUMNS: DataTableColumn<BatchResult>[] = [
  {
    id: "partyA",
    header: "partyA",
    cell: (result) => <AddressTag address={result.partyA} chars={4} className="whitespace-nowrap" />,
  },
  {
    id: "start",
    header: "start",
    align: "end",
    cell: (result) => String(result.start),
    cellClassName: "text-muted-foreground font-mono",
  },
  {
    id: "status",
    header: "Status",
    cell: (result) => <Badge variant={result.status === "success" ? "positive" : "destructive"}>{result.status}</Badge>,
  },
  {
    id: "positions",
    header: "Positions",
    align: "end",
    cell: (result) => (result.status === "success" ? String(result.quotes.length) : "—"),
    cellClassName: "text-foreground font-mono",
  },
  {
    id: "hasMore",
    header: "hasMore",
    cell: (result) =>
      result.status === "success" ? (
        <Badge variant={result.hasMore ? "warning" : "secondary"}>{result.hasMore ? "yes" : "no"}</Badge>
      ) : (
        "—"
      ),
  },
  {
    id: "isLiquidated",
    header: "Liquidation",
    cell: (result) => <LiquidationCell result={result} />,
  },
  {
    id: "error",
    header: "Error",
    cell: (result) =>
      result.status === "failure" ? (
        <span className="text-destructive line-clamp-2 text-xs" title={result.error.message}>
          {result.error.message}
        </span>
      ) : null,
  },
];

const POSITION_COLUMNS: DataTableColumn<PositionRow>[] = [
  {
    id: "partyA",
    header: "partyA",
    cell: ({ partyA }) => <AddressTag address={partyA} chars={4} />,
  },
  {
    id: "id",
    header: "Quote id",
    cell: ({ position }) => String(position.id),
    sortAccessor: ({ position }) => Number(position.id),
    cellClassName: "text-muted-foreground font-mono",
  },
  {
    id: "symbolId",
    header: "Market",
    cell: ({ position }) => String(position.symbolId),
    sortAccessor: ({ position }) => Number(position.symbolId),
    cellClassName: "text-foreground font-mono",
  },
  {
    id: "positionType",
    header: "Side",
    cell: ({ position }) => (
      <Badge variant={position.positionType === PositionType.LONG ? "positive" : "destructive"}>
        {PositionType[position.positionType] ?? String(position.positionType)}
      </Badge>
    ),
    sortAccessor: ({ position }) => position.positionType,
  },
  {
    id: "quoteStatus",
    header: "Status",
    cell: ({ position }) => (
      <Badge variant="secondary">{QuoteStatus[position.quoteStatus] ?? String(position.quoteStatus)}</Badge>
    ),
    sortAccessor: ({ position }) => position.quoteStatus,
  },
  {
    id: "quantity",
    header: "Quantity",
    align: "end",
    cell: ({ position }) => formatFixedPoint(position.quantity),
    sortAccessor: ({ position }) => Number(position.quantity),
    cellClassName: "text-foreground font-mono",
  },
  {
    id: "openedPrice",
    header: "Open price",
    align: "end",
    cell: ({ position }) => formatFixedPoint(position.openedPrice),
    sortAccessor: ({ position }) => Number(position.openedPrice),
    cellClassName: "text-foreground font-mono",
  },
];
