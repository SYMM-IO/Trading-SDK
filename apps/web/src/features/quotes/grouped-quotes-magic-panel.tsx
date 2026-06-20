"use client";
import { StatusDot } from "@/components/status-dot";
import { PartyAField } from "@/features/inspector/party-a-field";
import { socketStatusLabel, socketStatusTone } from "@/features/websocket/socket-status-display";
import type { QuoteGroup } from "@symm-frontier/core";
import { useGroupedQuotes } from "@symm-frontier/react";
import { useEffect, useRef } from "react";
import { isAddress, type Address } from "viem";
import type { MagicMethodPanelProps } from "../magic-sidebar/magic-types";
import { magicInputPersistKey, usePersistentPinState } from "../magic-sidebar/magic-value-store";
import { GroupedQuotesTable } from "./grouped-quotes-table";

/** Persisted snapshot of the last loaded grouped feed, restored on reload. */
interface GroupedQuotesSnapshot {
  groups: QuoteGroup[];
  accounts: Address[];
}

/**
 * Live magic-sidebar panel for the grouped-positions feed: pick a partyA (seeded
 * from the source card) and watch its quotes folded into one row per market +
 * side (`MARKET_DIRECTION`), each row expandable to its underlying quotes.
 * Mirrors {@link QuotesMagicPanel} but renders the grouped view; the feed runs
 * only while the card is expanded (`enabled`) and a valid address is entered.
 */
export function GroupedQuotesMagicPanel({
  intervalMs,
  enabled,
  initialInput,
  persistKey,
  seedToken,
}: MagicMethodPanelProps) {
  const [input, setInput] = usePersistentPinState(magicInputPersistKey(persistKey), initialInput ?? "", seedToken);
  const partyA = isAddress(input) ? (input as Address) : undefined;
  const active = enabled && Boolean(partyA);

  const { groups, accounts, isLoading, socketStatus } = useGroupedQuotes({
    partyA,
    live: true,
    enabled: active,
    pollingInterval: intervalMs,
    includeVirtualAccounts: true,
  });

  /**
   * Keep the last loaded feed so a reload shows it instantly instead of
   * "Loading positions…". Persist only when the group set actually changes
   * (the feed recomputes its arrays every poll), comparing a cheap signature.
   */
  const [snapshot, setSnapshot] = usePersistentPinState<GroupedQuotesSnapshot>(persistKey, {
    groups: [],
    accounts: [],
  });
  const lastSignatureRef = useRef<string | null>(null);
  useEffect(() => {
    if (!active || isLoading) return;
    const signature = `${accounts.join(",")}::${groups.map((group) => `${group.key}#${group.metrics.quoteCount}`).join(",")}`;
    if (signature === lastSignatureRef.current) return;
    lastSignatureRef.current = signature;
    setSnapshot({ groups, accounts });
  }, [active, isLoading, groups, accounts, setSnapshot]);

  const hasLive = active && !isLoading;
  const displayGroups = hasLive ? groups : snapshot.groups;
  const displayAccounts = hasLive ? accounts : snapshot.accounts;

  return (
    <div className="flex flex-col gap-3">
      <PartyAField
        idPrefix="magic-grouped-quotes"
        label="partyA (subaccount or VA address)"
        value={input}
        onValueChange={setInput}
        invalid={input.length > 0 && !partyA}
      />

      <div className="flex items-center gap-2 text-xs">
        <StatusDot tone={socketStatusTone(socketStatus)} pulse={socketStatus === "open"} />
        <span className="text-muted-foreground">{socketStatusLabel(socketStatus)}</span>
        {active ? (
          <span
            className="text-muted-foreground ml-auto"
            title="Grouped positions · sub-account + Virtual Accounts scanned"
          >
            {displayGroups.length} group{displayGroups.length === 1 ? "" : "s"}
            {displayAccounts.length > 1 ? ` · ${displayAccounts.length} accts` : ""}
          </span>
        ) : null}
      </div>

      {!active ? (
        <p className="text-muted-foreground text-xs">Enter a partyA address to start the grouped feed.</p>
      ) : isLoading && snapshot.groups.length === 0 ? (
        <p className="text-muted-foreground text-xs">Loading positions…</p>
      ) : (
        <GroupedQuotesTable
          testId="magic-grouped-quotes-table"
          groups={displayGroups}
          hidePagination
          emptyMessage="No grouped positions for this partyA yet."
        />
      )}
    </div>
  );
}
