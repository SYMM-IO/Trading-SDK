"use client";
import { PartyAField } from "@/features/inspector/party-a-field";
import type { QuoteHistoryRow } from "@symmio/trading-core";
import { QuoteCloseType } from "@symmio/trading-core";
import { useQuoteHistory } from "@symmio/trading-react";
import { Button } from "@symmio/ui/components/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@symmio/ui/components/select";
import { useEffect, useMemo, useRef } from "react";
import { isAddress, type Address } from "viem";
import type { MagicMethodPanelProps } from "../magic-sidebar/magic-types";
import { magicInputPersistKey, usePersistentPinState } from "../magic-sidebar/magic-value-store";
import { HistoryTable } from "./history-table";

/** History rows shown per page. */
const PAGE_SIZE = 5;
/**
 * One extra row is fetched as a look-ahead: the subgraph exposes no total count,
 * so the only way to know a further page exists (without falsely offering "Next"
 * on an exactly-full final page) is to ask for one more than we render.
 */
const FETCH_SIZE = PAGE_SIZE + 1;

/** Close-type filter options, in the order they render in the dropdown. */
const CLOSE_TYPE_OPTIONS: readonly { value: QuoteCloseType; label: string }[] = [
  { value: QuoteCloseType.All, label: "All statuses" },
  { value: QuoteCloseType.Closed, label: "Closed" },
  { value: QuoteCloseType.ForceClosed, label: "Force closed" },
  { value: QuoteCloseType.EmergencyClosed, label: "Emergency closed" },
  { value: QuoteCloseType.AdlClosed, label: "ADL closed" },
  { value: QuoteCloseType.Liquidated, label: "Liquidated" },
];

/** Persisted snapshot of the last loaded page, restored on reload. */
interface HistorySnapshot {
  rows: QuoteHistoryRow[];
}

/**
 * Live magic-sidebar panel for quote history: pick a partyA (seeded from the
 * source card) and page through its closed/liquidated quotes from the analytics
 * subgraph, filterable by close type. Mirrors {@link "QuotesMagicPanel"} /
 * {@link "GroupedQuotesMagicPanel"} but renders the history view with offset
 * pagination — the subgraph exposes no total count, so paging is prev/next and
 * "Next" is enabled only while a page comes back full. The feed polls only while
 * the card is expanded (`enabled`) and a valid address is entered.
 */
export function QuoteHistoryMagicPanel({
  intervalMs,
  enabled,
  initialInput,
  persistKey,
  seedToken,
}: MagicMethodPanelProps) {
  const [input, setInput] = usePersistentPinState(magicInputPersistKey(persistKey), initialInput ?? "", seedToken);
  const [closeType, setCloseType] = usePersistentPinState<QuoteCloseType>(
    persistKey ? `${persistKey}:close-type` : undefined,
    QuoteCloseType.All,
  );
  const [page, setPage] = usePersistentPinState<number>(persistKey ? `${persistKey}:page` : undefined, 1);

  const partyA = isAddress(input) ? (input as Address) : undefined;
  const active = enabled && Boolean(partyA);

  /** A new address or filter starts a fresh page run. */
  function handleInputChange(value: string) {
    setInput(value);
    setPage(1);
  }
  function handleCloseTypeChange(value: QuoteCloseType) {
    setCloseType(value);
    setPage(1);
  }
  /** An external retarget ("watch this sub-account") also resets to the first page. */
  const seedTokenRef = useRef(seedToken);
  useEffect(() => {
    if (seedToken === undefined || seedToken === seedTokenRef.current) return;
    seedTokenRef.current = seedToken;
    setPage(1);
  }, [seedToken, setPage]);

  const { data, isLoading } = useQuoteHistory({
    subAccounts: partyA ? [partyA] : [],
    closeType,
    first: FETCH_SIZE,
    skip: (page - 1) * PAGE_SIZE,
    query: { enabled: active, refetchInterval: active ? intervalMs : false, refetchIntervalInBackground: true },
  });
  const rows = useMemo(() => data?.rows ?? [], [data]);

  /**
   * Keep the last loaded page so a reload shows it instantly instead of
   * "Loading history…". Persist only when the page's content actually changes,
   * comparing a cheap signature of the filter, page, and event ids.
   */
  const [snapshot, setSnapshot] = usePersistentPinState<HistorySnapshot>(persistKey, { rows: [] });
  const lastSignatureRef = useRef<string | null>(null);
  useEffect(() => {
    if (!active || isLoading) return;
    const signature = `${closeType}:${page}::${rows.map((row) => row.eventId).join(",")}`;
    if (signature === lastSignatureRef.current) return;
    lastSignatureRef.current = signature;
    setSnapshot({ rows });
  }, [active, isLoading, rows, closeType, page, setSnapshot]);

  const hasLive = active && !isLoading;
  const sourceRows = hasLive ? rows : snapshot.rows;
  // The look-ahead row (the FETCH_SIZE-th) never renders — it only proves a next page exists.
  const displayRows = useMemo(() => sourceRows.slice(0, PAGE_SIZE), [sourceRows]);
  const hasNextPage = sourceRows.length > PAGE_SIZE;

  return (
    <div className="flex flex-col gap-3">
      <PartyAField
        idPrefix="magic-quote-history"
        label="partyA (subaccount or VA address)"
        value={input}
        onValueChange={handleInputChange}
        invalid={input.length > 0 && !partyA}
      />

      <div className="flex items-center gap-2 text-xs">
        <Select value={closeType} onValueChange={(value) => handleCloseTypeChange(value as QuoteCloseType)}>
          <SelectTrigger className="h-7 w-auto gap-1 text-xs" aria-label="Close-type filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CLOSE_TYPE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value} className="text-xs">
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {active ? (
          <span className="text-muted-foreground ml-auto">
            {displayRows.length} row{displayRows.length === 1 ? "" : "s"}
          </span>
        ) : null}
      </div>

      {!active ? (
        <p className="text-muted-foreground text-xs">Enter a partyA address to load its quote history.</p>
      ) : isLoading && snapshot.rows.length === 0 ? (
        <p className="text-muted-foreground text-xs">Loading history…</p>
      ) : (
        <>
          <HistoryTable
            testId="magic-quote-history-table"
            rows={displayRows}
            hidePagination
            emptyMessage={page > 1 ? "No more history on this page." : "No history for this partyA yet."}
          />
          <div className="flex items-center justify-between text-xs">
            <Button
              variant="outline"
              size="xs"
              disabled={page <= 1 || isLoading}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Prev
            </Button>
            <span className="text-muted-foreground tabular-nums">Page {page}</span>
            <Button
              variant="outline"
              size="xs"
              disabled={!hasNextPage || isLoading}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
