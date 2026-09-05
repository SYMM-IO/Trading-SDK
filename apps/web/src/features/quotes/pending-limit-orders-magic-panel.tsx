"use client";
import { PartyAField } from "@/features/inspector/party-a-field";
import { calculateQuoteLeverage, PositionType, QuoteStatus, type UnifiedQuote } from "@symmio/trading-core";
import { useLimitOrders, useMarkets } from "@symmio/trading-react";
import { shortenAddress } from "@symmio/utils";
import { useMemo, useState } from "react";
import { formatUnits, isAddress, zeroAddress, type Address } from "viem";
import type { MagicMethodPanelProps } from "../magic-sidebar/magic-types";
import { magicInputPersistKey, usePersistentPinState } from "../magic-sidebar/magic-value-store";
import { QuoteLifecycleBadge } from "./quote-lifecycle-badge";

const WEI_DECIMALS = 18;

/** Format an 18-decimal-wei bigint for display, trimmed to a few fraction digits. */
function formatWei(value: bigint): string {
  return Number(formatUnits(value, WEI_DECIMALS)).toLocaleString(undefined, { maximumFractionDigits: 6 });
}

/**
 * Magic-sidebar panel: a partyA's **LIMIT orders** as a table.
 *
 * Reads the reconciled off-chain + on-chain list (`useLimitOrders`): a just-sent
 * order shows instantly as an off-chain row and flips to on-chain once it anchors
 * — the lifecycle badge shows which. Each row expands (like an open-quote row) to
 * show partyB, the locked-margin legs, and leverage. Polls while the card is
 * expanded (`enabled`) and a valid address is entered.
 */
export function PendingLimitOrdersMagicPanel({
  intervalMs,
  enabled,
  initialInput,
  persistKey,
  seedToken,
}: MagicMethodPanelProps) {
  const [input, setInput] = usePersistentPinState(magicInputPersistKey(persistKey), initialInput ?? "", seedToken);
  const partyA = isAddress(input) ? (input as Address) : undefined;
  const active = enabled && Boolean(partyA);

  const { quotes, isLoading, error } = useLimitOrders({
    partyA,
    live: active,
    query: { enabled: active, refetchInterval: active && intervalMs > 0 ? intervalMs : false },
  });

  // Resolve symbolId → ticker so the table shows the market symbol, not a raw id.
  const marketsQuery = useMarkets();
  const symbolBySymbolId = useMemo(
    () => new Map((marketsQuery.data ?? []).map((market) => [market.symbolId, market.symbol])),
    [marketsQuery.data],
  );

  /** Expanded row keys (a row toggles its own detail block, like an open-quote row). */
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  function toggle(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <PartyAField
        idPrefix="magic-pending-limit-orders"
        label="partyA (subaccount or VA address)"
        value={input}
        onValueChange={setInput}
        invalid={input.length > 0 && !partyA}
      />

      {!active ? (
        <p className="text-muted-foreground text-xs">Enter a partyA address to load limit orders.</p>
      ) : error ? (
        <p className="text-destructive text-xs">{error.message}</p>
      ) : isLoading ? (
        <p className="text-muted-foreground text-xs">Loading limit orders…</p>
      ) : quotes.length === 0 ? (
        <p className="text-muted-foreground text-xs">No limit orders for this partyA.</p>
      ) : (
        <div className="overflow-x-auto" data-testid="magic-pending-limit-orders-table">
          <table className="w-full text-xs">
            <thead className="text-muted-foreground border-border/70 border-b">
              <tr className="[&>th]:px-2 [&>th]:py-1.5 [&>th]:text-left [&>th:first-child]:text-left [&>th:not(:nth-child(2))]:text-right">
                <th />
                <th>Quote</th>
                <th>Market</th>
                <th>Side</th>
                <th>Qty</th>
                <th>Limit price</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {quotes.map((quote) => (
                <LimitOrderRow
                  key={quote.key}
                  quote={quote}
                  market={symbolBySymbolId.get(Number(quote.symbolId)) ?? `#${quote.symbolId.toString()}`}
                  open={expanded.has(quote.key)}
                  onToggle={() => toggle(quote.key)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function LimitOrderRow({
  quote,
  market,
  open,
  onToggle,
}: {
  quote: UnifiedQuote;
  market: string;
  open: boolean;
  onToggle: () => void;
}) {
  const leverage = calculateQuoteLeverage({
    quantity: quote.quantity,
    requestedOpenPrice: quote.requestedOpenPrice,
    openedPrice: quote.openedPrice,
    lockedValues: quote.lockedValues,
  });
  const label = quote.quoteId !== undefined ? `Q#${quote.quoteId.toString()}` : `#${quote.tempQuoteId ?? "—"}`;
  const status = quote.quoteStatus !== undefined ? (QuoteStatus[quote.quoteStatus] ?? quote.quoteStatus) : quote.origin;

  return (
    <>
      <tr
        onClick={onToggle}
        data-testid={`magic-pending-limit-order-${quote.key}`}
        className="border-border/40 hover:bg-muted/40 cursor-pointer border-b [&>td]:px-2 [&>td]:py-1.5 [&>td:first-child]:text-left [&>td:not(:nth-child(2))]:text-right [&>td:not(:nth-child(2))]:font-mono"
      >
        <td>
          <span
            aria-hidden
            className={`text-muted-foreground inline-block text-[0.65rem] transition-transform ${open ? "rotate-90" : ""}`}
          >
            ▸
          </span>
        </td>
        <td>{label}</td>
        <td>{market}</td>
        <td className={quote.positionType === PositionType.LONG ? "text-emerald-500" : "text-destructive"}>
          {quote.positionType === PositionType.LONG ? "Long" : "Short"}
        </td>
        <td>{formatWei(quote.quantity)}</td>
        <td>{formatWei(quote.requestedOpenPrice)}</td>
        <td className="!text-left">
          <QuoteLifecycleBadge lifecycle={quote.lifecycle} />
        </td>
      </tr>
      {open ? (
        <tr className="border-border/40 border-b" data-testid={`magic-pending-limit-order-details-${quote.key}`}>
          <td colSpan={7} className="bg-muted/20 px-3 py-2">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
              <Detail label="status" value={String(status)} />
              <Detail
                label="partyB"
                value={!quote.partyB || quote.partyB === zeroAddress ? "—" : shortenAddress(quote.partyB)}
              />
              <Detail label="leverage" value={`${leverage}x`} />
              <Detail label="CVA" value={formatWei(quote.lockedValues.cva)} />
              <Detail label="LF" value={formatWei(quote.lockedValues.lf)} />
              <Detail label="partyA MM" value={formatWei(quote.lockedValues.partyAmm)} />
              <Detail label="partyB MM" value={formatWei(quote.lockedValues.partyBmm)} />
            </dl>
          </td>
        </tr>
      ) : null}
    </>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-foreground font-mono">{value}</dd>
    </div>
  );
}
