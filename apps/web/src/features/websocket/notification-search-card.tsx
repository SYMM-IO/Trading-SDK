"use client";

import { ResultError, ResultNote } from "@/components/result";
import type { NotificationSearchFilter } from "@theoldvarorg/core";
import { useSearchNotifications } from "@theoldvarorg/react";
import { Badge } from "@theoldvarorg/ui/components/badge";
import { Button } from "@theoldvarorg/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@theoldvarorg/ui/components/card";
import { Combobox, type ComboboxItem } from "@theoldvarorg/ui/components/combobox";
import { Input } from "@theoldvarorg/ui/components/input";
import { JsonView } from "@theoldvarorg/ui/components/json-view";
import { Spinner } from "@theoldvarorg/ui/components/spinner";
import { cn } from "@theoldvarorg/ui/lib/utils";
import { useRef, useState } from "react";

/** A single editable key/value pair in the filter builder. */
interface FilterRow {
  id: number;
  key: string;
  value: string;
}

/** One-click filter starting points. `value: ""` leaves the value for the user to fill. */
interface Suggestion {
  label: string;
  hint: string;
  key: string;
  value: string;
}

/**
 * Document keys the search backend understands, offered as native autocomplete
 * on the key field. Top-level fields plus the common `data.*` payload paths
 * (which mirror the position wire frame). Any other key still works — the
 * endpoint matches every key by exact equality.
 */
const KNOWN_KEYS = [
  "app_name",
  "address",
  "type",
  "primary_identifier",
  "secondary_identifier",
  "id",
  "create_time",
  "modify_time",
  "data.quote_id",
  "data.temp_quote_id",
  "data.action_status",
  "data.last_seen_action",
  "data.state_type",
  "data.counterparty_address",
  "data.va_address",
  "data.filled_amount_open",
  "data.filled_amount_close",
  "data.avg_price_open",
  "data.avg_price_close",
  "data.error_code",
  "data.failure_type",
];

/** Known keys as combobox options, tagged top-level vs nested payload. */
const KEY_ITEMS: ComboboxItem[] = KNOWN_KEYS.map((key) => ({
  id: key,
  title: key,
  description: key.startsWith("data.") ? "Nested payload field" : "Top-level field",
}));

const SUGGESTIONS: Suggestion[] = [
  { label: "Quote by temp id", hint: "data.temp_quote_id", key: "data.temp_quote_id", value: "-172" },
  { label: "Quote by on-chain id", hint: "data.quote_id", key: "data.quote_id", value: "" },
  { label: "By app channel", hint: "app_name", key: "app_name", value: "Hyper-EVM_Solver-Low-Cap_Production" },
  { label: "Failed actions", hint: "data.action_status", key: "data.action_status", value: "failed" },
  { label: "By SubAccount", hint: "address", key: "address", value: "" },
];

/**
 * Coerce a typed value into the scalar the backend expects. Clean decimals
 * become numbers (so `data.temp_quote_id: -172` matches the integer, not the
 * string "-172"); `true` / `false` / `null` become their literals; hex strings
 * (`0x…` addresses) and everything else stay strings.
 */
function coerceValue(raw: string): string | number | boolean | null {
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (raw === "null") return null;
  if (/^-?\d+(\.\d+)?$/.test(raw)) return Number(raw);
  return raw;
}

/** Build the request `query` object from the rows, dropping rows with an empty key or value. */
function buildFilter(rows: FilterRow[]): NotificationSearchFilter {
  const filter: NotificationSearchFilter = {};
  for (const row of rows) {
    const key = row.key.trim();
    const value = row.value.trim();
    if (!key || value === "") continue;
    filter[key] = coerceValue(value);
  }
  return filter;
}

/**
 * Interactive console for the notification search REST endpoint
 * (`searchNotifications` / `useSearchNotifications`). Build a free-form equality
 * filter as key/value rows — top-level fields or dotted `data.*` paths — preview
 * the exact request body, and run it against the chain's notification service.
 */
export function NotificationSearchCard() {
  const idRef = useRef(2);
  const [rows, setRows] = useState<FilterRow[]>([{ id: 1, key: "", value: "" }]);
  const [limit, setLimit] = useState("100");
  const [submitted, setSubmitted] = useState<{ filter: NotificationSearchFilter; size: number } | null>(null);

  const query = useSearchNotifications({
    filter: submitted?.filter ?? {},
    size: submitted?.size,
    query: { enabled: submitted !== null },
  });

  const liveFilter = buildFilter(rows);
  const filterKeyCount = Object.keys(liveFilter).length;
  const size = clampSize(limit);
  const requestBody = { query: liveFilter, size };

  const addRow = () => setRows((prev) => [...prev, { id: idRef.current++, key: "", value: "" }]);
  const removeRow = (id: number) =>
    setRows((prev) => (prev.length === 1 ? [{ id, key: "", value: "" }] : prev.filter((row) => row.id !== id)));
  const updateRow = (id: number, patch: Partial<FilterRow>) =>
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));

  const applySuggestion = (s: Suggestion) => setRows([{ id: idRef.current++, key: s.key, value: s.value }]);

  const search = () => {
    if (filterKeyCount === 0) return;
    const next = { filter: liveFilter, size };
    // Same filter + limit as the last run produces an identical query key, so
    // React Query would serve the cache instead of refetching. Force a fresh
    // request in that case; otherwise the new key fetches on its own.
    if (submitted && JSON.stringify(submitted) === JSON.stringify(next)) {
      void query.refetch();
    } else {
      setSubmitted(next);
    }
  };

  return (
    <Card className="animate-enter-up">
      <CardHeader>
        <CardTitle>Search notifications</CardTitle>
        <CardDescription>
          Match stored notifications by any field — top-level (<code className="font-mono text-xs">app_name</code>) or a
          dotted payload path (<code className="font-mono text-xs">data.temp_quote_id</code>). Every key is an exact
          match.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="flex flex-wrap gap-2" data-testid="notif-search-suggestions">
          {SUGGESTIONS.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => applySuggestion(s)}
              title={s.hint}
              data-testid={`notif-search-suggestion-${s.key}`}
              className="border-border/70 bg-muted/30 text-muted-foreground hover:border-ring/50 hover:text-foreground hover:bg-muted/60 focus-visible:ring-ring/40 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors outline-none focus-visible:ring-2"
            >
              <SparkIcon />
              {s.label}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          {rows.map((row) => (
            <div key={row.id} className="flex items-center gap-2">
              <Combobox
                idPrefix={`notif-search-key-${row.id}`}
                value={row.key}
                onValueChange={(next) => updateRow(row.id, { key: next })}
                onSelect={(item) => updateRow(row.id, { key: item.id })}
                items={KEY_ITEMS}
                searchable
                searchPlaceholder="Filter keys…"
                triggerLabel="Browse notification fields"
                placeholder="key"
                emptyResultsLabel="No matching field — any key still works."
                mono
                className="min-w-0 flex-1"
              />
              <span className="text-muted-foreground/60 font-mono text-sm">:</span>
              <Input
                value={row.value}
                onChange={(e) => updateRow(row.id, { value: e.target.value })}
                placeholder="value"
                aria-label="Filter value"
                data-testid="notif-search-value"
                className="min-w-0 flex-1 font-mono"
              />
              <button
                type="button"
                onClick={() => removeRow(row.id)}
                aria-label="Remove filter"
                data-testid="notif-search-remove"
                className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 focus-visible:ring-ring/40 inline-flex size-9 shrink-0 items-center justify-center rounded-xl transition-colors outline-none focus-visible:ring-2"
              >
                <RemoveIcon />
              </button>
            </div>
          ))}

          <button
            type="button"
            onClick={addRow}
            data-testid="notif-search-add"
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 rounded-md py-1 text-xs font-medium transition-colors"
          >
            <PlusIcon />
            Add filter
          </button>
        </div>

        <div className="flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-muted-foreground text-xs font-medium">Limit</span>
            <Input
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              inputMode="numeric"
              aria-label="Result limit"
              data-testid="notif-search-limit"
              className="w-24 font-mono"
            />
          </label>
          <Button
            type="button"
            size="sm"
            disabled={filterKeyCount === 0 || query.isFetching}
            onClick={search}
            data-testid="notif-search-run"
            className="ml-auto"
          >
            {query.isFetching ? (
              <>
                <Spinner className="size-4" /> Searching…
              </>
            ) : (
              <>
                <SearchIcon /> Search
              </>
            )}
          </Button>
        </div>

        {/* Signature: the live wire request, exactly as the SDK sends it. */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="bg-info/10 text-info rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wider">
              POST
            </span>
            <code className="text-muted-foreground font-mono text-xs">/api/v1/search</code>
            {filterKeyCount === 0 ? (
              <span className="text-muted-foreground/70 text-xs">· add a filter to enable</span>
            ) : null}
          </div>
          <JsonView
            data={requestBody}
            hideToolbar
            scroll={false}
            defaultExpandedDepth={4}
            className={cn("transition-opacity", filterKeyCount === 0 && "opacity-60")}
            data-testid="notif-search-request"
          />
        </div>

        <SearchResult query={query} submitted={submitted !== null} />
      </CardContent>
    </Card>
  );
}

/** Result region: error, idle prompt, loading, empty, or the matched documents. */
function SearchResult({ query, submitted }: { query: ReturnType<typeof useSearchNotifications>; submitted: boolean }) {
  if (query.error) {
    return <ResultError testId="notif-search-error" kind={query.error.kind} message={query.error.message} />;
  }
  if (!submitted) {
    return <ResultNote testId="notif-search-idle">Pick a suggestion or add a filter, then search.</ResultNote>;
  }
  if (query.isLoading) {
    return (
      <ResultNote testId="notif-search-loading" loading>
        Searching notifications…
      </ResultNote>
    );
  }
  const result = query.data;
  if (!result || result.documents.length === 0) {
    return <ResultNote testId="notif-search-empty">No notifications matched this filter.</ResultNote>;
  }
  return (
    <div className="space-y-2" data-testid="notif-search-result">
      <div className="flex items-center gap-2 text-sm">
        <Badge variant="secondary" className="font-mono">
          {result.total}
        </Badge>
        <span className="text-muted-foreground">
          {result.total === 1 ? "match" : "matches"} · showing {result.count}
        </span>
      </div>
      <JsonView data={result.documents} defaultExpandedDepth={2} />
    </div>
  );
}

/** Coerce the limit input to the backend's accepted range (1–100). */
function clampSize(raw: string): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 100;
  return Math.min(100, Math.max(1, Math.trunc(n)));
}

function SparkIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="size-3" aria-hidden>
      <path d="M8 1.5 9.4 6.6 14.5 8 9.4 9.4 8 14.5 6.6 9.4 1.5 8 6.6 6.6 8 1.5Z" fill="currentColor" opacity="0.9" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="size-4" aria-hidden>
      <circle cx="7" cy="7" r="4.25" stroke="currentColor" strokeWidth="1.6" />
      <path d="m10.5 10.5 3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="size-3.5" aria-hidden>
      <path d="M8 3.5v9M3.5 8h9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function RemoveIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="size-4" aria-hidden>
      <path d="m4.5 4.5 7 7M11.5 4.5l-7 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
