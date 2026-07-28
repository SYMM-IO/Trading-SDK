"use client";

import { DataList, DataRow } from "@/components/data-list";
import { Field } from "@/components/field";
import { ResultError, ResultNote } from "@/components/result";
import { WEI_DECIMALS } from "@/lib/format";
import { useFeeForUser, useMarkets, useSymmioConfig } from "@symmio/trading-react";
import { Button } from "@symmio/ui/components/button";
import { Input } from "@symmio/ui/components/input";
import { MarketSelect, type MarketSelectItem } from "@symmio/ui/components/market-select";
import { Spinner } from "@symmio/ui/components/spinner";
import { formatTokenAmount, formatWithCommas, rawToDecimal, shortenAddress } from "@symmio/utils";
import { useMemo, useState } from "react";
import { isAddress, zeroAddress, type Address } from "viem";
import { MethodCard } from "./method-card";
import { SubAccountPicker } from "./subaccount-picker";

type Market = NonNullable<ReturnType<typeof useMarkets>["data"]>[number];

interface Selection {
  subAccount?: Address;
  name?: string;
}

function formatFeeBps(raw: bigint): string {
  const basisPoints = rawToDecimal(raw, WEI_DECIMALS).times(10_000);
  return `${formatWithCommas(basisPoints, { dynamicDecimals: 4, maxDecimals: 8 })} bps`;
}

export function ReadFeeForUser() {
  const { addresses } = useSymmioConfig().getChainConfig();
  const marketsQuery = useMarkets();
  const markets = useMemo(() => getOpenMarkets(marketsQuery.data ?? []), [marketsQuery.data]);
  const marketItems = useMemo(() => toMarketSelectItems(markets), [markets]);
  const [selection, setSelection] = useState<Selection>({});
  const [marketId, setMarketId] = useState<string>("");
  const [affiliate, setAffiliate] = useState<string>("");

  const selectedMarket = useMemo(
    () => markets.find((market) => String(market.symbol_id) === marketId),
    [marketId, markets],
  );
  const validSymbolId = selectedMarket?.symbol_id;
  const validAffiliate = isAddress(affiliate) ? (affiliate as Address) : undefined;
  const affiliateInvalid = affiliate.length > 0 && !validAffiliate;
  const ready = Boolean(selection.subAccount) && validSymbolId !== undefined && !affiliateInvalid;

  const query = useFeeForUser({
    user: selection.subAccount ?? zeroAddress,
    symbolId: validSymbolId ?? 0,
    affiliate: validAffiliate,
    query: { enabled: false },
  });

  return (
    <MethodCard
      testId="method-getFeeForUser"
      name="getFeeForUser"
      mutability="view"
      description="Read the open and close fee rates for a user/account and SYMMIO symbol id."
    >
      <SubAccountPicker
        idPrefix="fee-user"
        selected={selection}
        onSelect={setSelection}
        accountLabel="user/account"
        accountEmptyHint="Pick a subaccount or enter any SYMMIO account address."
        selectedHintLabel="Account"
      />

      <Field label="market" htmlFor="input-fee-market">
        <MarketSelect
          idPrefix="input-fee-market"
          value={marketId}
          items={marketItems}
          onValueChange={setMarketId}
          placeholder={marketsQuery.isLoading ? "Loading markets..." : "Select a market..."}
          disabled={marketsQuery.isLoading}
          searchPlaceholder="Search symbol, name, or ID..."
          emptyLabel="No open Enigma markets."
          emptyResultsLabel="No markets match this search."
          clearLabel="Clear market"
        />
      </Field>

      <Field
        label="affiliate (optional)"
        htmlFor="input-fee-affiliate"
        hint={`Leave empty to use configured affiliate ${shortenAddress(addresses.affiliatesAddress)}.`}
      >
        <Input
          id="input-fee-affiliate"
          data-testid="input-fee-affiliate"
          value={affiliate}
          onChange={(event) => setAffiliate(event.target.value)}
          placeholder={addresses.affiliatesAddress}
          aria-invalid={affiliateInvalid}
        />
      </Field>

      <Button
        type="button"
        size="sm"
        disabled={!ready || query.isFetching}
        onClick={() => void query.refetch()}
        data-testid="button-read-fee-for-user"
      >
        {query.isFetching ? (
          <>
            <Spinner className="size-4" /> Reading…
          </>
        ) : (
          "Read fee"
        )}
      </Button>

      <ResultPanel testId="result-getFeeForUser" query={query} />
    </MethodCard>
  );
}

function getOpenMarkets(markets: Market[]): Market[] {
  return markets
    .filter(
      // Solvers that omit `state` (e.g. Rasa) are treated as tradable; only an
      // explicit non-open state filters a market out.
      (market) =>
        market.symbol_id !== undefined && (market.state === undefined || market.state === 2 || market.state === 3),
    )
    .sort((a, b) => (a.symbol ?? a.name ?? "").localeCompare(b.symbol ?? b.name ?? ""));
}

function toMarketSelectItems(markets: Market[]): MarketSelectItem[] {
  return markets.map((market) => {
    const id = String(market.symbol_id);
    const label = getMarketLabel(market);
    const name = market.name && market.name !== label ? market.name : undefined;

    return {
      id,
      label,
      description: name ? `${name} · max ${market.max_leverage ?? "1"}x` : `Max ${market.max_leverage ?? "1"}x`,
      meta: `ID ${id}`,
      searchText: [id, market.symbol, market.name].filter(Boolean).join(" "),
    };
  });
}

function getMarketLabel(market: Market): string {
  return market.symbol ?? market.name ?? `Market ${market.symbol_id}`;
}

function ResultPanel({ testId, query }: { testId: string; query: ReturnType<typeof useFeeForUser> }) {
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
    return <ResultNote testId={`${testId}-idle`}>Fill the fields and run the read to see fee rates.</ResultNote>;
  }

  return (
    <DataList data-testid={`${testId}-data`}>
      <DataRow
        label="openFee"
        value={formatFeeBps(query.data.openFee)}
        mono
        copyValue={query.data.openFee.toString()}
      />
      <DataRow
        label="closeFee"
        value={formatFeeBps(query.data.closeFee)}
        mono
        copyValue={query.data.closeFee.toString()}
      />
      <DataRow label="isSet" value={query.data.isSet ? "true" : "false"} mono />
      <DataRow
        label="openFee raw"
        value={formatTokenAmount(query.data.openFee, WEI_DECIMALS, { maxFractionDigits: WEI_DECIMALS })}
        mono
      />
      <DataRow
        label="closeFee raw"
        value={formatTokenAmount(query.data.closeFee, WEI_DECIMALS, { maxFractionDigits: WEI_DECIMALS })}
        mono
      />
    </DataList>
  );
}
