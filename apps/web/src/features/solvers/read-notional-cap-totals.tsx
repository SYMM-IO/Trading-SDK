"use client";

import { DataList, DataRow } from "@/components/data-list";
import { ResultError, ResultNote } from "@/components/result";
import { DEFAULT_NOTIONAL_CAP_POLLING_MS, useNotionalCapAll } from "@symmio/trading-react";
import { Button } from "@symmio/ui/components/button";
import { Spinner } from "@symmio/ui/components/spinner";
import { useMemo, useState } from "react";
import { MethodCard } from "../inspector/method-card";
import { useSolverKindActive } from "./solver-target";

/**
 * Solvers-page card for `/notional_cap` — aggregate open interest, total cap,
 * and used across every market the solver lists. Live-polls every
 * {@link DEFAULT_NOTIONAL_CAP_POLLING_MS}; toggle to pause.
 */
export function ReadNotionalCapTotals() {
  const [polling, setPolling] = useState(true);
  const active = useSolverKindActive("enigma");
  const query = useNotionalCapAll({
    pollingInterval: polling ? DEFAULT_NOTIONAL_CAP_POLLING_MS : false,
    query: { enabled: active },
  });

  const totalCap = useMemo(() => sumField(query.data?.symbols, "totalCap"), [query.data]);

  return (
    <MethodCard
      testId="method-getNotionalCapAll"
      name="getNotionalCapAll"
      mutability="view"
      description="Fetch aggregate open interest and total cap across every solver market."
      wide
    >
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          disabled={!active || query.isFetching}
          onClick={() => void query.refetch()}
          data-testid="button-read-notional-cap-totals"
        >
          {query.isFetching ? (
            <>
              <Spinner className="size-4" /> Refreshing…
            </>
          ) : (
            "Refresh"
          )}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setPolling((current) => !current)}
          data-testid="button-notional-cap-totals-toggle-polling"
        >
          {polling ? "Pause polling" : "Resume polling"}
        </Button>
        <span className="text-muted-foreground text-xs">
          {polling ? `Auto-refresh every ${Math.round(DEFAULT_NOTIONAL_CAP_POLLING_MS / 1000)}s` : "Polling paused"}
        </span>
      </div>

      <ResultPanel testId="result-getNotionalCapAll" query={query} totalCap={totalCap} />
    </MethodCard>
  );
}

function ResultPanel({
  testId,
  query,
  totalCap,
}: {
  testId: string;
  query: ReturnType<typeof useNotionalCapAll>;
  totalCap: number;
}) {
  if (query.isLoading) {
    return (
      <ResultNote testId={`${testId}-loading`} loading>
        Loading…
      </ResultNote>
    );
  }
  if (query.error) {
    return <ResultError testId={`${testId}-error`} kind={query.error.kind} message={query.error.message} />;
  }
  if (!query.data) {
    return <ResultNote testId={`${testId}-idle`}>Run the read to see solver totals.</ResultNote>;
  }
  const data = query.data;
  return (
    <DataList data-testid={`${testId}-data`}>
      <DataRow label="markets" value={String(data.count)} mono />
      <DataRow label="totalOpenInterest" value={String(data.totalOpenInterest)} mono />
      <DataRow label="totalUsed" value={String(data.totalUsed)} mono />
      <DataRow label="totalCap (Σ symbols)" value={String(totalCap)} mono />
    </DataList>
  );
}

function sumField(rows: { totalCap: number }[] | undefined, field: "totalCap"): number {
  if (!rows) return 0;
  let total = 0;
  for (const row of rows) total += row[field];
  return total;
}
