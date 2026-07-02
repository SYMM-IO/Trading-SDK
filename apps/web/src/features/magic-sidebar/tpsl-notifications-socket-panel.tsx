"use client";

import { StatusDot } from "@/components/status-dot";
import { PartyAField } from "@/features/inspector/party-a-field";
import { socketStatusLabel, socketStatusTone } from "@/features/websocket/socket-status-display";
import { useWatchTpSlNotifications, type TpSlNotification } from "@symm-frontier/react";
import { Badge } from "@symm-frontier/ui/components/badge";
import { JsonView } from "@symm-frontier/ui/components/json-view";
import { useRef } from "react";
import { isAddress, type Address } from "viem";
import type { MagicMethodPanelProps } from "./magic-types";
import { magicInputPersistKey, usePersistentPinState } from "./magic-value-store";

const MAX_ROWS = 50;

interface LogEntry {
  key: string;
  receivedAt: number;
  notification: TpSlNotification;
}

/**
 * Live magic-sidebar panel for the TP/SL notifications WebSocket. Pick a
 * SubAccount and stream the handler's conditional-order events (`new` /
 * `edit` / `cancel` / `trigger` / `close`). Separate from the position/quote
 * notifications panel — TP/SL uses its own `appName` channel.
 */
export function TpSlNotificationsSocketPanel({ enabled, initialInput, persistKey, seedToken }: MagicMethodPanelProps) {
  const [input, setInput] = usePersistentPinState(magicInputPersistKey(persistKey), initialInput ?? "", seedToken);
  const account = isAddress(input) ? (input as Address) : undefined;
  const active = enabled && Boolean(account);

  const [log, setLog] = usePersistentPinState<LogEntry[]>(persistKey, []);
  const seqRef = useRef(0);

  const { status, error } = useWatchTpSlNotifications({
    account,
    enabled: active,
    onNotification: (notification) => {
      seqRef.current += 1;
      const receivedAt = Date.now();
      const key = `${notification.cohQuoteId ?? notification.quoteId}-${notification.conditionalOrderType ?? "?"}-${receivedAt}-${seqRef.current}`;
      setLog((prev) => [{ key, receivedAt, notification }, ...prev].slice(0, MAX_ROWS));
    },
  });

  return (
    <div className="flex flex-col gap-3">
      <PartyAField
        idPrefix="magic-tpsl-notifications"
        label="subAccount (address)"
        value={input}
        onValueChange={setInput}
        invalid={input.length > 0 && !account}
      />

      <div className="flex items-center gap-2">
        <StatusDot tone={socketStatusTone(status)} pulse={status === "open"} />
        <span className="text-xs">{socketStatusLabel(status)}</span>
        {log.length > 0 ? (
          <button
            type="button"
            onClick={() => setLog([])}
            className="text-muted-foreground hover:text-foreground ml-auto text-xs transition-colors"
          >
            Clear
          </button>
        ) : null}
      </div>

      {error ? (
        <p className="text-destructive text-xs" role="alert">
          {error.message}
        </p>
      ) : null}

      {!active ? (
        <p className="text-muted-foreground text-xs">Enter a SubAccount address to stream TP/SL events.</p>
      ) : log.length === 0 ? (
        <p className="text-muted-foreground text-xs">Waiting for TP/SL events…</p>
      ) : (
        <ul className="flex flex-col gap-2" data-testid="magic-tpsl-notifications-list">
          {log.map((entry) => (
            <TpSlLogRow key={entry.key} entry={entry} />
          ))}
        </ul>
      )}
    </div>
  );
}

function TpSlLogRow({ entry }: { entry: LogEntry }) {
  const n = entry.notification;
  const sideLabel =
    n.conditionalOrderType === "take_profit" ? "TP" : n.conditionalOrderType === "stop_loss" ? "SL" : "—";
  return (
    <li className="border-border/60 bg-background flex flex-col gap-1 rounded-lg border px-2.5 py-2 text-xs">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-foreground font-medium">
          Quote #{n.quoteId} · {sideLabel}
        </span>
        <span className="text-muted-foreground text-[0.65rem]">{new Date(entry.receivedAt).toLocaleTimeString()}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <StateBadge state={n.state} successful={n.successful} />
        {n.cohQuoteId ? <span className="text-muted-foreground font-mono text-[0.65rem]">{n.cohQuoteId}</span> : null}
      </div>
      {!n.successful && n.errorMessage ? (
        <span className="text-destructive text-[0.7rem]">{n.errorMessage}</span>
      ) : null}
      <details className="mt-1">
        <summary className="text-muted-foreground hover:text-foreground cursor-pointer text-[0.65rem] select-none">
          Raw frame
        </summary>
        <div className="mt-1.5">
          <JsonView data={n.raw} />
        </div>
      </details>
    </li>
  );
}

function StateBadge({ state, successful }: { state: string; successful: boolean }) {
  if (!successful) return <Badge variant="destructive">Failed</Badge>;
  switch (state) {
    case "new":
    case "edit":
      return <Badge variant="positive">{state}</Badge>;
    case "pending":
      return <Badge variant="secondary">Pending</Badge>;
    case "cancel":
    case "canceled":
    case "cancelled":
      return <Badge variant="outline">Canceled</Badge>;
    case "trigger":
    case "triggered":
      return <Badge variant="warning">Triggered</Badge>;
    case "close":
      return <Badge variant="info">Close</Badge>;
    default:
      return <Badge variant="secondary">{state}</Badge>;
  }
}
