"use client";

import { useMarkets } from "@symm-frontier/react";
import { Badge } from "@symm-frontier/ui/components/badge";
import { Button } from "@symm-frontier/ui/components/button";
import { MethodCard } from "./method-card";

export function ReadMarkets() {
  const query = useMarkets();

  return (
    <MethodCard
      testId="method-getMarkets"
      name="getMarkets"
      mutability="view"
      description="Fetch all tradable markets (contract symbols) from the solver."
    >
      <Button
        type="button"
        size="sm"
        disabled={query.isFetching}
        onClick={() => void query.refetch()}
        data-testid="button-read-markets"
      >
        {query.isFetching ? "Fetching..." : "Fetch Markets"}
      </Button>

      <ResultPanel testId="result-getMarkets" query={query} />
    </MethodCard>
  );
}

function ResultPanel({ testId, query }: { testId: string; query: ReturnType<typeof useMarkets> }) {
  if (query.isLoading) {
    return (
      <div data-testid={`${testId}-loading`} className="text-muted-foreground text-sm">
        Loading...
      </div>
    );
  }
  if (query.error) {
    return (
      <div
        data-testid={`${testId}-error`}
        className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm"
      >
        <Badge variant="destructive" className="mr-2 font-mono">
          {query.error.kind}
        </Badge>
        {query.error.message}
      </div>
    );
  }
  if (!query.data) {
    return (
      <div data-testid={`${testId}-idle`} className="text-muted-foreground text-sm">
        Click the button to fetch markets.
      </div>
    );
  }
  if (query.data.length === 0) {
    return (
      <div data-testid={`${testId}-empty`} className="text-muted-foreground text-sm">
        No markets found.
      </div>
    );
  }
  return (
    <div data-testid={`${testId}-data`} className="overflow-x-auto">
      <p className="text-muted-foreground mb-2 text-xs">{query.data.length} markets found</p>
      <table className="w-full table-auto border-collapse text-sm">
        <thead>
          <tr className="border-border text-muted-foreground border-b text-left text-xs font-medium tracking-wide uppercase">
            <th className="py-2 pr-4">ID</th>
            <th className="py-2 pr-4">Symbol</th>
            <th className="py-2 pr-4">Name</th>
            <th className="py-2 pr-4">State</th>
            <th className="py-2 pr-4">Max Leverage</th>
            <th className="py-2">Trading Fee</th>
          </tr>
        </thead>
        <tbody>
          {query.data.map((market) => (
            <tr
              key={market.symbol_id}
              data-market-id={market.symbol_id}
              className="border-border/50 border-b last:border-b-0"
            >
              <td className="text-foreground py-2 pr-4 font-mono">{market.symbol_id}</td>
              <td className="text-foreground py-2 pr-4 font-mono">{market.symbol}</td>
              <td className="text-foreground py-2 pr-4">{market.name}</td>
              <td className="py-2 pr-4">
                <MarketStateBadge state={market.state} />
              </td>
              <td className="text-muted-foreground py-2 pr-4">{market.max_leverage}x</td>
              <td className="text-muted-foreground py-2">{market.trading_fee}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MarketStateBadge({ state }: { state: number | undefined }) {
  const stateLabels: Record<number, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    0: { label: "Disabled", variant: "destructive" },
    1: { label: "Close Only", variant: "secondary" },
    2: { label: "Open Only", variant: "secondary" },
    3: { label: "Enabled", variant: "default" },
  };

  const { label, variant } = stateLabels[state ?? -1] ?? { label: `Unknown (${state})`, variant: "outline" as const };

  return <Badge variant={variant}>{label}</Badge>;
}
