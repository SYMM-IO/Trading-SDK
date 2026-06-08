"use client";

import { Field } from "@/components/field";
import { ResultError, ResultNote } from "@/components/result";
import { TableSkeleton } from "@/components/skeletons";
import { WEI_DECIMALS, formatUsd } from "@/lib/format";
import { useOnchainContractMarkets } from "@symm-frontier/react";
import { Badge } from "@symm-frontier/ui/components/badge";
import { Button } from "@symm-frontier/ui/components/button";
import { Input } from "@symm-frontier/ui/components/input";
import { Spinner } from "@symm-frontier/ui/components/spinner";
import { formatTokenAmount, formatWithCommas, rawToDecimal } from "@symm-frontier/utils";
import { useMemo, useState } from "react";
import { MethodCard } from "./method-card";

type Market = NonNullable<ReturnType<typeof useOnchainContractMarkets>["data"]>[number];

function parseUint(value: string): bigint | undefined {
  if (!/^\d+$/.test(value.trim())) return undefined;
  return BigInt(value.trim());
}

function formatFixedPoint(raw: bigint): string {
  return formatTokenAmount(raw, WEI_DECIMALS, { maxFractionDigits: WEI_DECIMALS });
}

function formatTradingFeeBps(raw: bigint): string {
  const basisPoints = rawToDecimal(raw, WEI_DECIMALS).times(10_000);
  return `${formatWithCommas(basisPoints, { dynamicDecimals: 4, maxDecimals: 8 })} bps`;
}

export function ReadOnchainContractMarkets() {
  const [start, setStart] = useState("0");
  const [size, setSize] = useState("100");

  const validStart = parseUint(start);
  const validSize = parseUint(size);
  const ready = validStart !== undefined && validSize !== undefined;
  const query = useOnchainContractMarkets({
    start: validStart ?? 0n,
    size: validSize ?? 0n,
    query: { enabled: false },
  });

  return (
    <MethodCard
      testId="method-getOnchainContractMarkets"
      name="getOnchainContractMarkets"
      mutability="view"
      description="Read paginated on-chain contract markets from SYMMIO core getSymbols."
      wide
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="start" htmlFor="input-onchain-markets-start">
          <Input
            id="input-onchain-markets-start"
            data-testid="input-onchain-markets-start"
            value={start}
            onChange={(event) => setStart(event.target.value)}
            placeholder="0"
            inputMode="numeric"
            aria-invalid={start.length > 0 && validStart === undefined}
          />
        </Field>

        <Field label="size" htmlFor="input-onchain-markets-size">
          <Input
            id="input-onchain-markets-size"
            data-testid="input-onchain-markets-size"
            value={size}
            onChange={(event) => setSize(event.target.value)}
            placeholder="100"
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
          data-testid="button-read-onchain-contract-markets"
        >
          {query.isFetching ? (
            <>
              <Spinner className="size-4" /> Reading…
            </>
          ) : (
            "Read on-chain markets"
          )}
        </Button>

        {query.data ? (
          <span className="text-muted-foreground font-mono text-xs">
            {query.data.length} market{query.data.length === 1 ? "" : "s"}
          </span>
        ) : null}
      </div>

      <ResultPanel testId="result-getOnchainContractMarkets" query={query} />
    </MethodCard>
  );
}

function ResultPanel({ testId, query }: { testId: string; query: ReturnType<typeof useOnchainContractMarkets> }) {
  const [search, setSearch] = useState("");

  const visible = useMemo(() => {
    if (!query.data) return [];
    const term = search.trim().toLowerCase();
    return query.data.filter(
      (market) =>
        term.length === 0 || market.name.toLowerCase().includes(term) || market.symbolId.toString().includes(term),
    );
  }, [query.data, search]);

  if (query.isLoading) {
    return <TableSkeleton rows={6} columns={9} alignEndFrom={4} testId={`${testId}-loading`} />;
  }
  if (query.error) {
    return <ResultError testId={`${testId}-error`} kind={query.error.kind} message={query.error.message} />;
  }
  if (!query.data) {
    return <ResultNote testId={`${testId}-idle`}>Run the read to fetch on-chain contract markets.</ResultNote>;
  }
  if (query.data.length === 0) {
    return <ResultNote testId={`${testId}-empty`}>No on-chain contract markets found.</ResultNote>;
  }

  return (
    <div data-testid={`${testId}-data`} className="flex flex-col gap-3">
      <div className="relative">
        <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2">
          <SearchIcon />
        </span>
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search name or ID…"
          className="pl-9"
          data-testid="onchain-markets-search"
          aria-label="Search on-chain contract markets"
        />
      </div>

      <p className="text-muted-foreground text-xs">
        Showing <span className="text-foreground font-medium">{visible.length}</span> of {query.data.length}
      </p>

      {visible.length === 0 ? (
        <div className="border-border/60 bg-muted/20 text-muted-foreground rounded-xl border px-3 py-6 text-center text-sm">
          No on-chain markets match this search.
        </div>
      ) : (
        <div className="border-border/70 overflow-hidden rounded-xl border">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-muted/40 text-muted-foreground text-left text-xs font-medium tracking-wide uppercase">
                  <th className="px-3 py-2.5">ID</th>
                  <th className="px-3 py-2.5">Name</th>
                  <th className="px-3 py-2.5">Valid</th>
                  <th className="px-3 py-2.5 text-right">minAcceptableQuoteValue</th>
                  <th className="px-3 py-2.5 text-right">minAcceptablePortionLF</th>
                  <th className="px-3 py-2.5 text-right">Trading fee</th>
                  <th className="px-3 py-2.5 text-right">Max leverage</th>
                  <th className="px-3 py-2.5 text-right">Funding epoch</th>
                  <th className="px-3 py-2.5 text-right">Funding window</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((market) => (
                  <MarketRow key={market.symbolId.toString()} market={market} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function MarketRow({ market }: { market: Market }) {
  return (
    <tr
      data-market-id={market.symbolId.toString()}
      className="border-border/60 hover:bg-muted/30 border-t transition-colors"
    >
      <td className="text-muted-foreground px-3 py-2.5 font-mono">{market.symbolId.toString()}</td>
      <td className="text-foreground px-3 py-2.5 font-mono font-medium">{market.name}</td>
      <td className="px-3 py-2.5">
        <Badge variant={market.isValid ? "positive" : "destructive"}>{market.isValid ? "true" : "false"}</Badge>
      </td>
      <td className="text-foreground px-3 py-2.5 text-right font-mono">{formatUsd(market.minAcceptableQuoteValue)}</td>
      <td className="text-muted-foreground px-3 py-2.5 text-right font-mono">
        {formatFixedPoint(market.minAcceptablePortionLF)}
      </td>
      <td className="text-muted-foreground px-3 py-2.5 text-right font-mono">
        {formatTradingFeeBps(market.tradingFee)}
      </td>
      <td className="text-muted-foreground px-3 py-2.5 text-right font-mono">
        {formatFixedPoint(market.maxLeverage)}x
      </td>
      <td className="text-muted-foreground px-3 py-2.5 text-right font-mono">
        {market.fundingRateEpochDuration.toString()}s
      </td>
      <td className="text-muted-foreground px-3 py-2.5 text-right font-mono">
        {market.fundingRateWindowTime.toString()}s
      </td>
    </tr>
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
