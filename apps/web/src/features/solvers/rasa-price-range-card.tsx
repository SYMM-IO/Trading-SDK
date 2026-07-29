"use client";

import { DataList, DataRow } from "@/components/data-list";
import { Field } from "@/components/field";
import { ResultError, ResultNote } from "@/components/result";
import { useMarkets, useSolverPriceRange } from "@symmio/trading-react";
import { Button } from "@symmio/ui/components/button";
import { MarketSelect, type MarketSelectItem } from "@symmio/ui/components/market-select";
import { Spinner } from "@symmio/ui/components/spinner";
import { useMemo, useState } from "react";
import { MethodCard } from "../inspector/method-card";
import { SolverTargetSelect, useSolverTargetState } from "./solver-target";

type Market = NonNullable<ReturnType<typeof useMarkets>["data"]>[number];

/**
 * Rasa-only card: acceptable price range for one symbol
 * (`/price-range/{symbol}`). The symbol field suggests the TARGET solver's own
 * markets, so the name format always matches what that solver expects.
 */
export function RasaPriceRangeCard() {
  const { target, setTarget } = useSolverTargetState({ requireKind: "rasa" });
  const marketsQuery = useMarkets({ chainId: target.chainId, solverId: target.solverId });
  const markets = useMemo(() => getOpenMarkets(marketsQuery.data ?? []), [marketsQuery.data]);
  const marketItems = useMemo(() => toMarketSelectItems(markets), [markets]);

  const [marketId, setMarketId] = useState("");
  const selectedMarket = useMemo(
    () => markets.find((market) => String(market.symbolId) === marketId),
    [marketId, markets],
  );
  const symbol = selectedMarket ? (selectedMarket.name ?? selectedMarket.symbol ?? "") : "";

  const query = useSolverPriceRange({
    chainId: target.chainId,
    solverId: target.solverId,
    symbol,
    query: { enabled: false },
  });

  return (
    <MethodCard
      testId="method-rasa-priceRange"
      name="getSolverPriceRange"
      mutability="view"
      description="Min/max acceptable prices for one symbol. Rasa-only endpoint."
    >
      <SolverTargetSelect value={target} onChange={setTarget} requireKind="rasa" testId="select-rasa-range-solver" />
      <Field label="market" htmlFor="input-rasa-range-market">
        <MarketSelect
          idPrefix="input-rasa-range-market"
          value={marketId}
          items={marketItems}
          onValueChange={setMarketId}
          placeholder={marketsQuery.isLoading ? "Loading markets..." : "Select a market..."}
        />
      </Field>
      <Button
        type="button"
        size="sm"
        disabled={!symbol || query.isFetching}
        onClick={() => void query.refetch()}
        data-testid="button-read-rasa-price-range"
      >
        {query.isFetching ? (
          <>
            <Spinner className="size-4" /> Reading...
          </>
        ) : (
          "Read"
        )}
      </Button>
      {query.error ? (
        <ResultError testId="result-rasa-priceRange-error" kind={query.error.kind} message={query.error.message} />
      ) : query.data !== undefined ? (
        <DataList data-testid="result-rasa-priceRange">
          <DataRow label="min_price" value={<span className="font-mono">{query.data.min_price}</span>} />
          <DataRow label="max_price" value={<span className="font-mono">{query.data.max_price}</span>} />
        </DataList>
      ) : (
        <ResultNote testId="result-rasa-priceRange-idle">Select a market and read.</ResultNote>
      )}
    </MethodCard>
  );
}

/** Tradable markets — a missing `state` (e.g. Rasa) counts as open. */
function getOpenMarkets(markets: readonly Market[]): Market[] {
  return markets
    .filter((market) => market.kind !== "enigma" || market.state === 2 || market.state === 3)
    .sort((a, b) => (a.symbol ?? a.name ?? "").localeCompare(b.symbol ?? b.name ?? ""));
}

function toMarketSelectItems(markets: readonly Market[]): MarketSelectItem[] {
  return markets.map((market) => {
    const id = String(market.symbolId);
    const label = market.symbol ?? market.name ?? `Market ${id}`;
    return {
      id,
      label,
      description: market.name && market.name !== label ? market.name : undefined,
      meta: `ID ${id}`,
      searchText: [id, market.symbol, market.name].filter(Boolean).join(" "),
    };
  });
}
