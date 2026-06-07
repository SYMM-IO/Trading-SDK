"use client";

import { Field } from "@/components/field";
import { ResultNote } from "@/components/result";
import { formatUsd } from "@/lib/format";
import { useAccountBalanceOf, useMarkets } from "@symm-frontier/react";
import { Badge } from "@symm-frontier/ui/components/badge";
import { Button } from "@symm-frontier/ui/components/button";
import { Input } from "@symm-frontier/ui/components/input";
import { MarketSelect, type MarketSelectItem } from "@symm-frontier/ui/components/market-select";
import { cn } from "@symm-frontier/ui/lib/utils";
import { useEffect, useMemo, useState } from "react";
import type { Address } from "viem";
import { MethodCard } from "../inspector/method-card";
import { SubAccountPicker } from "../inspector/subaccount-picker";

type Market = NonNullable<ReturnType<typeof useMarkets>["data"]>[number];
type TradeSide = "long" | "short";

interface SelectedSubAccount {
  subAccount?: Address;
  name?: string;
}

const TRADE_SIDES = [
  { value: "long", label: "Long" },
  { value: "short", label: "Short" },
] as const;

export function EnigmaInstantOpenCard() {
  const marketsQuery = useMarkets();
  const markets = useMemo(() => getOpenMarkets(marketsQuery.data ?? []), [marketsQuery.data]);
  const marketItems = useMemo(() => toMarketSelectItems(markets), [markets]);
  const [marketId, setMarketId] = useState("");
  const [selectedAccount, setSelectedAccount] = useState<SelectedSubAccount>({});
  const [side, setSide] = useState<TradeSide>("long");
  const [initialMargin, setInitialMargin] = useState("");
  const [leverage, setLeverage] = useState(1);
  const [slippage, setSlippage] = useState("5");
  const balanceQuery = useAccountBalanceOf({
    account: selectedAccount.subAccount,
  });

  const selectedMarket = useMemo(
    () => markets.find((market) => String(market.symbol_id) === marketId),
    [marketId, markets],
  );
  const maxLeverage = getMaxLeverage(selectedMarket);
  const validInitialMargin = parsePositiveNumber(initialMargin);
  const validSlippage = parseNonNegativeNumber(slippage);
  const notional = validInitialMargin === undefined ? undefined : validInitialMargin * leverage;

  useEffect(() => {
    setLeverage((current) => clampLeverage(current, maxLeverage));
  }, [maxLeverage]);

  return (
    <MethodCard
      testId="method-enigma-instant-open"
      name="instantOpen"
      mutability="nonpayable"
      description="Prepare an Enigma instant open order with a selected market, trading account, margin, side, and leverage."
      wide
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
        <div className="space-y-4">
          <Field label="market" htmlFor="enigma-instant-open-market">
            <MarketSelect
              idPrefix="enigma-instant-open-market"
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

          <SubAccountPicker
            idPrefix="enigma-instant-open-account"
            selected={selectedAccount}
            onSelect={setSelectedAccount}
            ownerLabel="owner"
            accountLabel="subaccount"
            accountEmptyHint="Select a subaccount or enter an address."
            selectedHintLabel="Subaccount"
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="side">
              <TradeSideControl value={side} onChange={setSide} />
            </Field>

            <Field
              label="initialMargin"
              htmlFor="enigma-instant-open-initial-margin"
              action={<AvailableBalanceLabel query={balanceQuery} />}
              hint="Collateral amount in dollars."
            >
              <Input
                id="enigma-instant-open-initial-margin"
                value={initialMargin}
                onChange={(event) => setInitialMargin(event.target.value)}
                placeholder="0.00"
                inputMode="decimal"
                aria-invalid={initialMargin.length > 0 && validInitialMargin === undefined}
                data-testid="enigma-instant-open-initial-margin"
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(140px,180px)]">
            <Field
              label={
                <span className="inline-flex items-center gap-2">
                  leverage <span className="text-foreground font-mono text-sm">{leverage}x</span>
                </span>
              }
              htmlFor="enigma-instant-open-leverage"
              hint={
                selectedMarket
                  ? `Max ${maxLeverage}x for ${selectedMarket.symbol ?? selectedMarket.name}.`
                  : "Select a market first."
              }
            >
              <input
                id="enigma-instant-open-leverage"
                type="range"
                min={1}
                max={maxLeverage}
                step={1}
                value={leverage}
                disabled={!selectedMarket}
                onChange={(event) => setLeverage(Number(event.target.value))}
                className="accent-primary h-9 w-full disabled:opacity-50"
                data-testid="enigma-instant-open-leverage"
              />
            </Field>

            <Field label="slippage (%)" htmlFor="enigma-instant-open-slippage" hint="Percent tolerance.">
              <Input
                id="enigma-instant-open-slippage"
                value={slippage}
                onChange={(event) => setSlippage(event.target.value)}
                placeholder="5"
                inputMode="decimal"
                aria-invalid={slippage.length > 0 && validSlippage === undefined}
                data-testid="enigma-instant-open-slippage"
              />
            </Field>
          </div>
        </div>

        <TradeDraftSummary
          market={selectedMarket}
          account={selectedAccount.subAccount}
          side={side}
          initialMargin={validInitialMargin}
          leverage={leverage}
          slippage={validSlippage}
          notional={notional}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" disabled data-testid="button-enigma-instant-open-submit">
          Send instant open
        </Button>
        <ResultNote testId="result-enigma-instant-open-idle">
          Price, locked params, fee data, delegation, and signed operation submit are next.
        </ResultNote>
      </div>
    </MethodCard>
  );
}

function TradeSideControl({ value, onChange }: { value: TradeSide; onChange: (value: TradeSide) => void }) {
  return (
    <div
      role="tablist"
      aria-label="Trade side"
      className="bg-muted/70 ring-border/70 inline-flex h-9 w-full items-center gap-1 rounded-xl p-1 ring-1"
    >
      {TRADE_SIDES.map((option) => {
        const active = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            data-testid={`enigma-instant-open-side-${option.value}`}
            className={cn(
              "focus-visible:ring-ring/40 h-7 flex-1 rounded-lg text-sm font-medium transition-all outline-none focus-visible:ring-2",
              active
                ? option.value === "long"
                  ? "bg-positive/15 text-positive ring-positive/30 ring-1"
                  : "bg-destructive/15 text-destructive ring-destructive/30 ring-1"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function TradeDraftSummary({
  market,
  account,
  side,
  initialMargin,
  leverage,
  slippage,
  notional,
}: {
  market?: Market;
  account?: Address;
  side: TradeSide;
  initialMargin?: number;
  leverage: number;
  slippage?: number;
  notional?: number;
}) {
  return (
    <div className="border-border/70 bg-muted/20 flex flex-col gap-3 rounded-xl border p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Draft</span>
        <Badge variant={side === "long" ? "positive" : "destructive"}>{side}</Badge>
      </div>

      <SummaryRow
        label="market"
        value={market ? (market.symbol ?? market.name ?? String(market.symbol_id)) : "Not selected"}
      />
      <SummaryRow label="subaccount" value={account ?? "Not selected"} mono={Boolean(account)} />
      <SummaryRow
        label="initialMargin"
        value={initialMargin === undefined ? "0.00" : formatUsdNumber(initialMargin)}
        mono
      />
      <SummaryRow label="leverage" value={`${leverage}x`} mono />
      <SummaryRow label="slippage" value={slippage === undefined ? "Not set" : formatPercentNumber(slippage)} mono />
      <SummaryRow label="notional" value={notional === undefined ? "0.00" : formatUsdNumber(notional)} mono />
    </div>
  );
}

function AvailableBalanceLabel({ query }: { query: ReturnType<typeof useAccountBalanceOf> }) {
  if (query.isLoading) {
    return <span className="text-muted-foreground text-xs">available: loading...</span>;
  }
  if (query.error) {
    return <span className="text-destructive text-xs">available: unavailable</span>;
  }
  if (query.data === undefined) {
    return <span className="text-muted-foreground text-xs">available: select subaccount</span>;
  }

  return (
    <span className="text-muted-foreground text-xs">
      available: <span className="text-foreground font-mono">{formatUsd(query.data)}</span>
    </span>
  );
}

function SummaryRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="border-border/60 flex items-center justify-between gap-3 border-t pt-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("text-foreground max-w-[70%] truncate text-right", mono && "font-mono")}>{value}</span>
    </div>
  );
}

function getOpenMarkets(markets: Market[]): Market[] {
  return markets
    .filter((market) => market.symbol_id !== undefined && (market.state === 2 || market.state === 3))
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

function getMaxLeverage(market?: Market): number {
  if (!market) return 1;
  const parsed = Math.floor(Number(market.max_leverage ?? 1));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function clampLeverage(value: number, maxLeverage: number): number {
  return Math.max(1, Math.min(maxLeverage, Math.floor(value)));
}

function parsePositiveNumber(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function parseNonNegativeNumber(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function formatUsdNumber(value: number): string {
  return `$${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

function formatPercentNumber(value: number): string {
  return `${value.toLocaleString("en-US", { maximumFractionDigits: 4 })}%`;
}
