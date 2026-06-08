"use client";

import { ResultError, ResultNote } from "@/components/result";
import { useEnigmaPriceServiceSymbolsInfo } from "@symm-frontier/react";
import { Badge } from "@symm-frontier/ui/components/badge";
import { Button } from "@symm-frontier/ui/components/button";
import { Spinner } from "@symm-frontier/ui/components/spinner";
import { MethodCard } from "../inspector/method-card";

export function ReadEnigmaPriceServiceSymbolsInfo() {
  const query = useEnigmaPriceServiceSymbolsInfo({ query: { enabled: false } });

  return (
    <MethodCard
      testId="method-getEnigmaPriceServiceSymbolsInfo"
      name="getEnigmaPriceServiceSymbolsInfo"
      mutability="view"
      description="Fetch known symbols, statuses, and token addresses from the Enigma price service."
      wide
    >
      <Button
        type="button"
        size="sm"
        disabled={query.isFetching}
        onClick={() => void query.refetch()}
        data-testid="button-read-enigma-price-service-symbols-info"
      >
        {query.isFetching ? (
          <>
            <Spinner className="size-4" /> Reading...
          </>
        ) : (
          "Read symbols info"
        )}
      </Button>

      <ResultPanel testId="result-getEnigmaPriceServiceSymbolsInfo" query={query} />
    </MethodCard>
  );
}

function ResultPanel({
  testId,
  query,
}: {
  testId: string;
  query: ReturnType<typeof useEnigmaPriceServiceSymbolsInfo>;
}) {
  if (query.isFetching) {
    return (
      <ResultNote testId={`${testId}-loading`} loading>
        Loading...
      </ResultNote>
    );
  }
  if (query.error) {
    return <ResultError testId={`${testId}-error`} kind={query.error.kind} message={query.error.message} />;
  }
  if (!query.data) {
    return <ResultNote testId={`${testId}-idle`}>Click the button to read symbols info.</ResultNote>;
  }
  if (query.data.length === 0) {
    return <ResultNote testId={`${testId}-empty`}>No symbols returned.</ResultNote>;
  }

  return (
    <div data-testid={`${testId}-data`} className="border-border/70 overflow-hidden rounded-xl border">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-muted/40 text-muted-foreground text-left text-xs font-medium tracking-wide uppercase">
              <th className="px-3 py-2.5">Name</th>
              <th className="px-3 py-2.5">Status</th>
              <th className="px-3 py-2.5">Address</th>
            </tr>
          </thead>
          <tbody>
            {query.data.map((symbol) => (
              <tr
                key={`${symbol.address}-${symbol.name}`}
                className="border-border/60 hover:bg-muted/30 border-t transition-colors"
              >
                <td className="px-3 py-2.5 font-mono">{symbol.name}</td>
                <td className="px-3 py-2.5">
                  <Badge variant={symbol.status === "TRADING" ? "positive" : "secondary"}>{symbol.status}</Badge>
                </td>
                <td className="text-muted-foreground max-w-96 truncate px-3 py-2.5 font-mono">{symbol.address}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
