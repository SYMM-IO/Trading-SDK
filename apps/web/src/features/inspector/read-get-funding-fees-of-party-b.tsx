"use client";

import { DataList, DataRow } from "@/components/data-list";
import { Field } from "@/components/field";
import { ResultError, ResultNote } from "@/components/result";
import { WEI_DECIMALS } from "@/lib/format";
import { useFundingFeesOfPartyB, useMarkets, useSymmioChainId, useSymmioConfig } from "@symmio/trading-react";
import { Badge } from "@symmio/ui/components/badge";
import { Button } from "@symmio/ui/components/button";
import { Input } from "@symmio/ui/components/input";
import { MarketSelect, type MarketSelectItem } from "@symmio/ui/components/market-select";
import { Spinner } from "@symmio/ui/components/spinner";
import { formatTokenAmount, shortenAddress } from "@symmio/utils";
import { useMemo, useState } from "react";
import { isAddress, zeroAddress } from "viem";
import { MethodCard } from "./method-card";
import { formatTimestampSeconds, Section } from "./section";

type Market = NonNullable<ReturnType<typeof useMarkets>["data"]>[number];

/** The pair's `FundingFee` struct, derived structurally from the hook's return type. */
type FundingFee = NonNullable<ReturnType<typeof useFundingFeesOfPartyB>["data"]>;

/** Which side a signed rate or fee applies to, for its direction word. */
type Side = "longs" | "shorts";

/** One of the three accumulated-funding states a pair can be in. */
interface PairState {
  label: string;
  variant: "secondary" | "warning" | "info";
  /** One line on what the state means for the pair's quotes. */
  hint: string;
}

/**
 * Card for the SYMMIO core diamond's `getFundingFeesOfPartyB(symbolId, partyB)`:
 * the accumulated-funding state a solver keeps for one symbol. The market picker
 * lists the connected chain's default-solver markets, and partyB defaults to
 * that same solver, so the common read needs only a market. Wide like the other
 * positions cards, so the long 18-decimal rates never truncate.
 */
export function ReadGetFundingFeesOfPartyB() {
  const config = useSymmioConfig();
  const chainId = useSymmioChainId();
  const chainConfig = config.getChainConfig(chainId);
  const defaultSolver = chainConfig.solvers[chainConfig.defaultSolverId];
  const marketsQuery = useMarkets();
  const markets = useMemo(() => sortMarkets(marketsQuery.data ?? []), [marketsQuery.data]);
  const marketItems = useMemo(() => toMarketSelectItems(markets), [markets]);
  const [marketId, setMarketId] = useState<string>("");
  const [partyB, setPartyB] = useState<string>("");

  const selectedMarket = useMemo(
    () => markets.find((market) => String(market.symbolId) === marketId),
    [marketId, markets],
  );
  const validSymbolId = selectedMarket === undefined ? undefined : BigInt(selectedMarket.symbolId);
  const partyBInput = partyB.trim();
  /** An empty field follows the chain's default solver; anything typed must be a valid address. */
  const validPartyB =
    partyBInput.length === 0 ? defaultSolver?.address : isAddress(partyBInput) ? partyBInput : undefined;
  const partyBInvalid = partyBInput.length > 0 && validPartyB === undefined;
  const ready = validSymbolId !== undefined && validPartyB !== undefined;

  const query = useFundingFeesOfPartyB({
    symbolId: validSymbolId ?? 0n,
    partyB: validPartyB ?? zeroAddress,
    query: { enabled: false },
  });

  return (
    <MethodCard
      testId="method-getFundingFeesOfPartyB"
      name="getFundingFeesOfPartyB"
      mutability="view"
      description="Read the accumulated-funding state a solver (partyB) keeps for one symbol: current and average per-epoch rates, epoch tracking and carried-over fee snapshots."
      wide
    >
      <Field label="market" htmlFor="input-funding-fees-market">
        <MarketSelect
          idPrefix="input-funding-fees-market"
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

      <Field
        label="partyB"
        htmlFor="input-funding-fees-party-b"
        hint={
          defaultSolver
            ? `Leave empty to use the ${defaultSolver.name} solver ${shortenAddress(defaultSolver.address)}.`
            : "The solver address whose funding state to read."
        }
      >
        <Input
          id="input-funding-fees-party-b"
          data-testid="input-funding-fees-party-b"
          value={partyB}
          onChange={(event) => setPartyB(event.target.value)}
          placeholder={defaultSolver?.address ?? "0x…"}
          aria-invalid={partyBInvalid}
        />
      </Field>

      <Button
        type="button"
        size="sm"
        disabled={!ready || query.isFetching}
        onClick={() => void query.refetch()}
        data-testid="button-read-funding-fees-of-party-b"
      >
        {query.isFetching ? (
          <>
            <Spinner className="size-4" /> Reading…
          </>
        ) : (
          "Read funding state"
        )}
      </Button>

      <ResultPanel testId="result-getFundingFeesOfPartyB" query={query} />
    </MethodCard>
  );
}

/**
 * Every market the solver lists, by label. Unlike the fee card, none are filtered
 * by trading state: a close-only market still accrues funding on its open positions.
 */
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
      description: name ? `${name} · max ${market.maxLeverage}x` : `Max ${market.maxLeverage}x`,
      meta: `ID ${id}`,
      searchText: [id, market.symbol, market.name].filter(Boolean).join(" "),
    };
  });
}

function getMarketLabel(market: Market): string {
  return market.symbol || market.name || `Market ${market.symbolId}`;
}

/**
 * The pair's state, per the three states `FundingFee` documents: no epoch
 * duration means accumulated funding is not configured; a duration with no
 * start means it is configured but nothing accrues yet; otherwise it accrues.
 */
function getPairState(fee: FundingFee): PairState {
  if (fee.epochDuration === 0n) {
    return {
      label: "Not configured",
      variant: "secondary",
      hint: "No epoch duration: accumulated funding is off for this pair.",
    };
  }
  if (fee.startEpoch === 0n && fee.startEpochTimeStamp === 0n) {
    return {
      label: "Not started",
      variant: "warning",
      hint: "A duration is set but the solver has not posted a rate, so nothing accrues yet.",
    };
  }
  return { label: "Accruing", variant: "info", hint: "Open quotes on this pair accrue funding every epoch." };
}

/**
 * A signed 18-decimal value at full precision. Per-epoch rates are
 * price-adjusted, so on a low-priced market they sit far below the 6 decimals
 * the quote card rounds to.
 */
function formatSignedFixedPoint(raw: bigint): string {
  const magnitude = formatTokenAmount(raw < 0n ? -raw : raw, WEI_DECIMALS);
  return raw < 0n ? `-${magnitude}` : magnitude;
}

/** Epoch length in seconds, with a compact `8h` / `1h 30m` reading once it spans a minute. */
function formatEpochDuration(seconds: bigint): string {
  const total = Number(seconds);
  if (total < 60) return `${seconds} s`;
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const rest = total % 60;
  const parts = [hours && `${hours}h`, minutes && `${minutes}m`, rest && `${rest}s`].filter(Boolean);
  return `${seconds} s (${parts.join(" ")})`;
}

function ResultPanel({ testId, query }: { testId: string; query: ReturnType<typeof useFundingFeesOfPartyB> }) {
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
    return (
      <ResultNote testId={`${testId}-idle`}>Pick a market and run the read to see the pair’s funding state.</ResultNote>
    );
  }

  const fee = query.data;
  const state = getPairState(fee);

  return (
    <div data-testid={`${testId}-data`} className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={state.variant}>{state.label}</Badge>
        <span className="text-muted-foreground text-xs">{state.hint}</span>
      </div>

      <div className="grid grid-cols-1 gap-x-8 gap-y-5 @5xl:grid-cols-2">
        <div className="flex flex-col gap-5">
          <Section title="Rates · per epoch">
            <DataList>
              <SignedFeeRow label="currentLongRate" raw={fee.currentLongRate} side="longs" />
              <SignedFeeRow label="currentShortRate" raw={fee.currentShortRate} side="shorts" />
              <SignedFeeRow label="accumulatedLongRate" raw={fee.accumulatedLongRate} side="longs" />
              <SignedFeeRow label="accumulatedShortRate" raw={fee.accumulatedShortRate} side="shorts" />
            </DataList>
          </Section>

          <Section title="Snapshots">
            <DataList>
              <SignedFeeRow label="snapshotLongFee" raw={fee.snapshotLongFee} side="longs" />
              <SignedFeeRow label="snapshotShortFee" raw={fee.snapshotShortFee} side="shorts" />
            </DataList>
          </Section>
        </div>

        <Section title="Epochs">
          <DataList>
            <DataRow label="epochDuration" value={formatEpochDuration(fee.epochDuration)} mono />
            <DataRow label="startEpoch" value={fee.startEpoch.toString()} mono />
            <DataRow label="startEpochTimeStamp" value={formatTimestampSeconds(fee.startEpochTimeStamp)} />
            <DataRow label="lastUpdatedEpoch" value={fee.lastUpdatedEpoch.toString()} mono />
            <DataRow label="lastUpdatedTimeStamp" value={formatTimestampSeconds(fee.lastUpdatedTimeStamp)} />
          </DataList>
        </Section>
      </div>

      <p className="text-muted-foreground text-xs leading-5">
        Raw contract values. Rates and fees are per unit, 18-decimal and price-adjusted, with a positive value meaning
        that side pays; the accumulated rates are a weighted average per epoch, not a running total. Epochs are absolute
        indices (timestamp ÷ epochDuration).
      </p>
    </div>
  );
}

/**
 * One raw, cost-positive rate or fee row, with its direction spelled out so the
 * sign never has to be decoded. The copy button yields the raw integer.
 */
function SignedFeeRow({ label, raw, side }: { label: string; raw: bigint; side: Side }) {
  return (
    <DataRow
      label={label}
      value={
        raw === 0n ? (
          formatSignedFixedPoint(raw)
        ) : (
          <>
            {formatSignedFixedPoint(raw)}
            <span className="text-muted-foreground ml-1.5 font-sans text-xs">{`${side} ${raw > 0n ? "pay" : "receive"}`}</span>
          </>
        )
      }
      mono
      copyValue={raw.toString()}
    />
  );
}
