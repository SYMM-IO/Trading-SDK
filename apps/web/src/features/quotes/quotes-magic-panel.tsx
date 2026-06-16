"use client";
import { StatusDot } from "@/components/status-dot";
import { PartyAField } from "@/features/inspector/party-a-field";
import { socketStatusLabel, socketStatusTone } from "@/features/websocket/socket-status-display";
import { useManagedQuotes } from "@symm-frontier/react";
import { useState } from "react";
import { isAddress, type Address } from "viem";
import type { MagicMethodPanelProps } from "../magic-sidebar/magic-types";
import { QuotesTable } from "./quotes-table";

/**
 * Live magic-sidebar panel for the managed quotes feed: pick a partyA (seeded
 * from the source card) and watch its reconciled quote list. `intervalMs` is the
 * base poll cadence (the feed accelerates itself off the notifications socket);
 * the feed runs only while the card is expanded (`enabled`) and a valid address
 * is entered.
 */
export function QuotesMagicPanel({ intervalMs, enabled, initialInput }: MagicMethodPanelProps) {
  const [input, setInput] = useState(() => initialInput ?? "");
  const partyA = isAddress(input) ? (input as Address) : undefined;
  const active = enabled && Boolean(partyA);

  const { quotes, accounts, isLoading, socketStatus } = useManagedQuotes({
    partyA,
    live: true,
    enabled: active,
    pollingInterval: intervalMs,
    includeVirtualAccounts: true,
  });

  console.log("%%%%%%%%%%%%%%%%%%%%", quotes, accounts, isLoading, socketStatus);

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
            {quotes.length} quote{quotes.length === 1 ? "" : "s"}
            {accounts.length > 1 ? ` · ${accounts.length} accts` : ""}
          </span>
        ) : null}
      </div>

      {!active ? (
        <p className="text-muted-foreground text-xs">Enter a partyA address to start the quote feed.</p>
      ) : isLoading ? (
        <p className="text-muted-foreground text-xs">Loading quotes…</p>
      ) : (
        <QuotesTable
          testId="magic-managed-quotes-table"
          quotes={quotes}
          hidePagination
          emptyMessage="No quotes for this partyA yet."
        />
      )}
    </div>
  );
}
