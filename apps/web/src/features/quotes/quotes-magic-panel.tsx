"use client";
import { StatusDot } from "@/components/status-dot";
import { PartyAField } from "@/features/inspector/party-a-field";
import { socketStatusLabel, socketStatusTone } from "@/features/websocket/socket-status-display";
import type { UnifiedQuote } from "@theoldvarorg/core";
import { useManagedQuotes } from "@theoldvarorg/react";
import { useEffect, useRef } from "react";
import { isAddress, type Address } from "viem";
import type { MagicMethodPanelProps } from "../magic-sidebar/magic-types";
import { magicInputPersistKey, usePersistentPinState } from "../magic-sidebar/magic-value-store";
import { QuotesTable } from "./quotes-table";

/**
 * Live magic-sidebar panel for the managed quotes feed: pick a partyA (seeded
 * from the source card) and watch its reconciled quote list. `intervalMs` is the
 * base poll cadence (the feed accelerates itself off the notifications socket);
 * the feed runs only while the card is expanded (`enabled`) and a valid address
 * is entered.
 */
/** Persisted snapshot of the last loaded quote feed, restored on reload. */
interface QuotesSnapshot {
  quotes: UnifiedQuote[];
  accounts: Address[];
}

export function QuotesMagicPanel({ intervalMs, enabled, initialInput, persistKey, seedToken }: MagicMethodPanelProps) {
  const [input, setInput] = usePersistentPinState(magicInputPersistKey(persistKey), initialInput ?? "", seedToken);
  const partyA = isAddress(input) ? (input as Address) : undefined;
  const active = enabled && Boolean(partyA);

  const { quotes, accounts, isLoading, socketStatus } = useManagedQuotes({
    partyA,
    live: true,
    enabled: active,
    pollingInterval: intervalMs,
    includeVirtualAccounts: true,
  });

  /**
   * Keep the last loaded feed so a reload shows it instantly instead of
   * "Loading quotes…". Persist only when the row set actually changes (the feed
   * recomputes its arrays every poll), comparing a cheap key+account signature.
   */
  const [snapshot, setSnapshot] = usePersistentPinState<QuotesSnapshot>(persistKey, { quotes: [], accounts: [] });
  const lastSignatureRef = useRef<string | null>(null);
  useEffect(() => {
    if (!active || isLoading) return;
    const signature = `${accounts.join(",")}::${quotes.map((quote) => quote.key).join(",")}`;
    if (signature === lastSignatureRef.current) return;
    lastSignatureRef.current = signature;
    setSnapshot({ quotes, accounts });
  }, [active, isLoading, quotes, accounts, setSnapshot]);

  const hasLive = active && !isLoading;
  const displayQuotes = hasLive ? quotes : snapshot.quotes;
  const displayAccounts = hasLive ? accounts : snapshot.accounts;

  return (
    <div className="flex flex-col gap-3">
      <PartyAField
        idPrefix="magic-managed-quotes"
        label="partyA (subaccount or VA address)"
        value={input}
        onValueChange={setInput}
        invalid={input.length > 0 && !partyA}
      />

      <div className="flex items-center gap-2 text-xs">
        <StatusDot tone={socketStatusTone(socketStatus)} pulse={socketStatus === "open"} />
        <span className="text-muted-foreground">{socketStatusLabel(socketStatus)}</span>
        {active ? (
          <span className="text-muted-foreground ml-auto" title="Quotes · sub-account + Virtual Accounts scanned">
            {displayQuotes.length} quote{displayQuotes.length === 1 ? "" : "s"}
            {displayAccounts.length > 1 ? ` · ${displayAccounts.length} accts` : ""}
          </span>
        ) : null}
      </div>

      {!active ? (
        <p className="text-muted-foreground text-xs">Enter a partyA address to start the quote feed.</p>
      ) : isLoading && snapshot.quotes.length === 0 ? (
        <p className="text-muted-foreground text-xs">Loading quotes…</p>
      ) : (
        <QuotesTable
          testId="magic-managed-quotes-table"
          quotes={displayQuotes}
          hidePagination
          emptyMessage="No quotes for this partyA yet."
        />
      )}
    </div>
  );
}
