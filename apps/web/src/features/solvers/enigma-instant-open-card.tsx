"use client";

import { Field } from "@/components/field";
import { ResultError, ResultNote } from "@/components/result";
import { formatUsd } from "@/lib/format";
import {
  PositionType,
  useAccountBalanceOf,
  useEnigmaPriceServicePricesByNames,
  useFeeForUser,
  useInstantOpenAuto,
  useLockedParams,
  useMarkets,
} from "@symm-frontier/react";
import { Badge } from "@symm-frontier/ui/components/badge";
import { Button } from "@symm-frontier/ui/components/button";
import { Input } from "@symm-frontier/ui/components/input";
import { MarketSelect, type MarketSelectItem } from "@symm-frontier/ui/components/market-select";
import { Spinner } from "@symm-frontier/ui/components/spinner";
import { cn } from "@symm-frontier/ui/lib/utils";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Address } from "viem";
import { MethodCard } from "../inspector/method-card";
import { SubAccountPicker } from "../inspector/subaccount-picker";
import { useSessionKey } from "../session-keys/use-session-key";

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
  const balanceQuery = useAccountBalanceOf({ account: selectedAccount.subAccount });

  const selectedMarket = useMemo(
    () => markets.find((market) => String(market.symbol_id) === marketId),
    [marketId, markets],
  );
  const maxLeverage = getMaxLeverage(selectedMarket);
  const validInitialMargin = parsePositiveNumber(initialMargin);
  const validSlippage = parseNonNegativeNumber(slippage);
  const notional = validInitialMargin === undefined ? undefined : validInitialMargin * leverage;
  const marketName = selectedMarket?.name;

  useEffect(() => {
    setLeverage((current) => clampLeverage(current, maxLeverage));
  }, [maxLeverage]);

  const priceQuery = useEnigmaPriceServicePricesByNames({
    names: marketName ? [marketName] : [],
    query: { enabled: Boolean(marketName), staleTime: 5_000 },
  });

  const lockedParamsQuery = useLockedParams({
    symbol: marketName ?? "",
    leverage,
    query: { enabled: Boolean(marketName) && leverage > 0, staleTime: 30_000 },
  });

  const feeQuery = useFeeForUser({
    user: selectedAccount.subAccount ?? "0x0000000000000000000000000000000000000000",
    symbolId: selectedMarket?.symbol_id !== undefined ? BigInt(selectedMarket.symbol_id) : 0n,
    query: { enabled: Boolean(selectedAccount.subAccount && selectedMarket?.symbol_id), staleTime: 30_000 },
  });

  const mutation = useInstantOpenAuto();
  const { sessionKeyAddress, owner: sessionKeyOwner } = useSessionKey();

  const readyChecks = {
    market: Boolean(selectedMarket && marketName),
    account: Boolean(selectedAccount.subAccount),
    margin: validInitialMargin !== undefined,
    slippage: validSlippage !== undefined,
    session: Boolean(sessionKeyAddress),
  };
  const allReady = Object.values(readyChecks).every(Boolean);
  const canSubmit = allReady && !mutation.isPending;

  async function handleSubmit() {
    if (!canSubmit) return;
    const cachedMarkPrice = marketName ? priceQuery.data?.[marketName]?.markPrice : undefined;
    const cachedLocked = lockedParamsQuery.data;
    const cachedFees = feeQuery.data;
    if (
      !selectedMarket ||
      !marketName ||
      !selectedAccount.subAccount ||
      validInitialMargin === undefined ||
      validSlippage === undefined ||
      !sessionKeyAddress
    ) {
      return;
    }

    await mutation.mutateAsync({
      subAccountAddress: selectedAccount.subAccount,
      from: sessionKeyAddress,
      market: {
        id: Number(selectedMarket.symbol_id ?? 0),
        name: marketName,
        pricePrecision: Number(selectedMarket.price_precision ?? 0),
        quantityPrecision: Number(selectedMarket.quantity_precision ?? 0),
      },
      positionType: side === "long" ? PositionType.LONG : PositionType.SHORT,
      initialMargin,
      leverage,
      slippage: validSlippage,
      lockedParamPercent: cachedLocked,
      markPrice: cachedMarkPrice !== undefined ? String(cachedMarkPrice) : undefined,
      feeRates: cachedFees,
    });
  }

  return (
    <MethodCard
      testId="method-enigma-instant-open"
      name="instantOpen"
      mutability="nonpayable"
      description="Open a lowcap instant position via the InstantLayer v2 flow."
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
          markPrice={marketName ? priceQuery.data?.[marketName]?.markPrice : undefined}
        />
      </div>

      <SessionKeyRow address={sessionKeyAddress} owner={sessionKeyOwner} />

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          disabled={!canSubmit}
          onClick={() => void handleSubmit()}
          data-testid="button-enigma-instant-open-submit"
        >
          {mutation.isPending ? (
            <>
              <Spinner className="size-4" /> Sending...
            </>
          ) : (
            "Send instant open"
          )}
        </Button>
        <SubmitStatus ready={allReady} readyChecks={readyChecks} mutation={mutation} />
      </div>
    </MethodCard>
  );
}

function SubmitStatus({
  ready,
  readyChecks,
  mutation,
}: {
  ready: boolean;
  readyChecks: Record<string, boolean>;
  mutation: ReturnType<typeof useInstantOpenAuto>;
}) {
  if (mutation.isPending) {
    return (
      <ResultNote testId="result-enigma-instant-open-loading" loading>
        Signing operations and submitting to hedger...
      </ResultNote>
    );
  }
  if (mutation.error) {
    return (
      <ResultError
        testId="result-enigma-instant-open-error"
        kind={mutation.error.kind}
        message={mutation.error.message}
      />
    );
  }
  if (mutation.data?.success) {
    const tempQuoteId = mutation.data.tempQuoteId ?? "(none)";
    return (
      <ResultNote testId="result-enigma-instant-open-success">
        Submitted. tempQuoteId: <span className="font-mono">{tempQuoteId}</span>
      </ResultNote>
    );
  }
  if (!ready) {
    const missing = Object.entries(readyChecks)
      .filter(([, ok]) => !ok)
      .map(([key]) => key)
      .join(", ");
    return (
      <ResultNote testId="result-enigma-instant-open-idle">
        Missing: <span className="font-mono">{missing}</span>
      </ResultNote>
    );
  }
  return <ResultNote testId="result-enigma-instant-open-ready">Ready to submit.</ResultNote>;
}

function SessionKeyRow({ address, owner }: { address: Address | null | undefined; owner: Address | undefined }) {
  const ready = Boolean(address);

  return (
    <div
      data-testid="enigma-instant-open-session-key"
      className="border-border/70 bg-muted/20 flex flex-wrap items-center gap-3 rounded-xl border p-3 text-sm"
    >
      <span
        className={cn("size-2 rounded-full", ready ? "bg-positive" : "bg-warning")}
        aria-hidden
      />
      <span className="text-muted-foreground font-medium tracking-wide uppercase text-xs">sessionKey</span>
      <Badge variant={ready ? "positive" : "warning"} className="tracking-wide uppercase">
        {ready ? "ready" : "missing"}
      </Badge>

      {ready ? (
        <span
          className="text-foreground ml-auto max-w-[60%] truncate font-mono"
          data-testid="enigma-instant-open-session-key-address"
        >
          {address}
        </span>
      ) : (
        <span className="text-muted-foreground ml-auto inline-flex items-center gap-2">
          {owner ? "Not initialized for the connected wallet." : "Connect a wallet to initialize."}
          <Button asChild type="button" size="sm" variant="ghost" disabled={!owner}>
            <Link href="/session-keys" data-testid="enigma-instant-open-session-key-init">
              Initialize
            </Link>
          </Button>
        </span>
      )}
    </div>
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
  markPrice,
}: {
  market?: Market;
  account?: Address;
  side: TradeSide;
  initialMargin?: number;
  leverage: number;
  slippage?: number;
  notional?: number;
  markPrice?: number;
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
        label="markPrice"
        value={markPrice === undefined ? "Not loaded" : formatUsdNumber(markPrice)}
        mono={markPrice !== undefined}
      />
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
