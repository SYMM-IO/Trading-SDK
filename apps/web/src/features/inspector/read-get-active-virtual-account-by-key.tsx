"use client";

import { AddressTag } from "@/components/address-tag";
import { Field } from "@/components/field";
import { ResultError, ResultNote, ResultSuccess } from "@/components/result";
import { useActiveVirtualAccountByKey, useMarkets } from "@symmio/trading-react";
import { Button } from "@symmio/ui/components/button";
import { MarketSelect, type MarketSelectItem } from "@symmio/ui/components/market-select";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@symmio/ui/components/select";
import { Spinner } from "@symmio/ui/components/spinner";
import { useMemo, useState } from "react";
import { isAddress } from "viem";
import { MethodCard } from "./method-card";
import { SubAccountField } from "./subaccount-field";
import { VIRTUAL_ACCOUNT_ISOLATION_OPTIONS } from "./virtual-account-isolation";

type Market = NonNullable<ReturnType<typeof useMarkets>["data"]>[number];

/**
 * Card for `getActiveVirtualAccountByKey` (`AccountLayer.getActiveVAByKey`):
 * the Virtual Account currently active for a subaccount's isolation key — the
 * VA new quotes on that market and side are routed into under single-VA mode —
 * or none. Where `getPredictedNextVirtualAccount` answers "where would the next
 * position go", this answers "which VA holds the position now".
 */
export function ReadGetActiveVirtualAccountByKey() {
  const [input, setInput] = useState<string>("");
  const [isolationText, setIsolationText] = useState<string>("");
  const [marketId, setMarketId] = useState<string>("");
  const marketsQuery = useMarkets();
  const markets = useMemo(() => sortMarkets(marketsQuery.data ?? []), [marketsQuery.data]);
  const marketItems = useMemo(() => toMarketSelectItems(markets), [markets]);

  const validSubAccount = isAddress(input) ? input : undefined;
  const isolationType = VIRTUAL_ACCOUNT_ISOLATION_OPTIONS.find(
    (option) => String(option.value) === isolationText,
  )?.value;
  const symbolId = marketId.length > 0 ? BigInt(marketId) : undefined;
  const ready = validSubAccount !== undefined && isolationType !== undefined && symbolId !== undefined;

  const query = useActiveVirtualAccountByKey({
    subAccount: validSubAccount,
    isolationType,
    symbolId,
    query: { enabled: false },
  });

  return (
    <MethodCard
      testId="method-getActiveVirtualAccountByKey"
      name="getActiveVirtualAccountByKey"
      mutability="view"
      description="Read the Virtual Account (VA) a subaccount has active for one isolation key — market and isolation type — or none."
    >
      <SubAccountField
        idPrefix="active-va-subaccount"
        label="subAccount (subaccount address)"
        value={input}
        onValueChange={setInput}
        invalid={input.length > 0 && !validSubAccount}
      />

      <Field
        label="isolationType"
        htmlFor="active-va-isolation"
        hint={
          <>
            How the VA groups positions. <span className="font-mono">isolationTypeForSide(side)</span> gives a trade
            side’s.
          </>
        }
      >
        <Select value={isolationText} onValueChange={setIsolationText}>
          <SelectTrigger id="active-va-isolation" data-testid="select-active-va-isolation">
            <SelectValue placeholder="Pick an isolation type" />
          </SelectTrigger>
          <SelectContent>
            {VIRTUAL_ACCOUNT_ISOLATION_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={String(option.value)} description={option.hint}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label="symbolId (market)" htmlFor="active-va-market">
        <MarketSelect
          idPrefix="active-va-market"
          value={marketId}
          items={marketItems}
          onValueChange={setMarketId}
          placeholder={marketsQuery.isLoading ? "Loading markets..." : "Select a market..."}
          disabled={marketsQuery.isLoading}
          searchPlaceholder="Search symbol, name, or ID..."
          emptyLabel="The solver lists no markets."
          emptyResultsLabel="No markets match this search."
          clearLabel="Clear market"
        />
      </Field>

      <Button
        type="button"
        size="sm"
        disabled={!ready || query.isFetching}
        onClick={() => void query.refetch()}
        data-testid="button-read-active-va"
      >
        {query.isFetching ? (
          <>
            <Spinner className="size-4" /> Reading…
          </>
        ) : (
          "Read"
        )}
      </Button>

      <ResultPanel testId="result-getActiveVirtualAccountByKey" query={query} />
    </MethodCard>
  );
}

function sortMarkets(markets: readonly Market[]): Market[] {
  return [...markets].sort((a, b) => getMarketLabel(a).localeCompare(getMarketLabel(b)));
}

function toMarketSelectItems(markets: Market[]): MarketSelectItem[] {
  return markets.map((market) => {
    const id = String(market.symbolId);
    const label = getMarketLabel(market);
    const name = market.name && market.name !== label ? market.name : undefined;

    return {
      id,
      label,
      description: name,
      meta: `ID ${id}`,
      searchText: [id, market.symbol, market.name].filter(Boolean).join(" "),
    };
  });
}

function getMarketLabel(market: Market): string {
  return market.symbol || market.name || `Market ${market.symbolId}`;
}

function ResultPanel({ testId, query }: { testId: string; query: ReturnType<typeof useActiveVirtualAccountByKey> }) {
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
  if (query.data === undefined) {
    return (
      <ResultNote testId={`${testId}-idle`}>Pick a subaccount, an isolation type and a market, then read.</ResultNote>
    );
  }
  if (query.data === null) {
    return (
      <ResultNote testId={`${testId}-none`}>
        No VA is active for this key — the next position on it opens a new one.
      </ResultNote>
    );
  }
  return (
    <ResultSuccess testId={`${testId}-data`}>
      <span className="text-foreground">Active VA</span> <AddressTag address={query.data} />
    </ResultSuccess>
  );
}
