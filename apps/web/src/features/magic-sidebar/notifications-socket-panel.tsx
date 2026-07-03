"use client";

import { StatusDot } from "@/components/status-dot";
import { PartyAField } from "@/features/inspector/party-a-field";
import { NotificationLogRow } from "@/features/websocket/notification-log-row";
import { socketStatusLabel, socketStatusTone } from "@/features/websocket/socket-status-display";
import type { Notification } from "@symmio/trading-core";
import { useNotifications } from "@symmio/trading-react";
import { useRef } from "react";
import { isAddress, type Address } from "viem";
import type { MagicMethodPanelProps } from "./magic-types";
import { magicInputPersistKey, usePersistentPinState } from "./magic-value-store";

/** Max log rows kept in a sidebar socket panel. */
const MAX_ROWS = 50;

interface LogEntry {
  key: string;
  receivedAt: number;
  notification: Notification;
}

/**
 * Live magic-sidebar panel for the notifications WebSocket: pick a SubAccount (or
 * VA) and stream its position/quote state events. Subscribes only while the card
 * is expanded (`enabled`) and a valid address is entered; collapsing the card or
 * closing the sidebar unmounts the panel and closes the socket.
 */
export function NotificationsSocketPanel({ enabled, initialInput, persistKey, seedToken }: MagicMethodPanelProps) {
  const [input, setInput] = usePersistentPinState(magicInputPersistKey(persistKey), initialInput ?? "", seedToken);
  const account = isAddress(input) ? (input as Address) : undefined;
  const active = enabled && Boolean(account);

  const [log, setLog] = usePersistentPinState<LogEntry[]>(persistKey, []);
  const seqRef = useRef(0);

  const { status, error } = useNotifications({
    account,
    enabled: active,
    onNotification: (notification) => {
      seqRef.current += 1;
      const receivedAt = Date.now();
      /** `receivedAt` namespaces the key per session so a new entry never collides with a persisted one. */
      const key = `${notification.id}-${receivedAt}-${seqRef.current}`;
      setLog((prev) => [{ key, receivedAt, notification }, ...prev].slice(0, MAX_ROWS));
    },
  });

  return (
    <div className="flex flex-col gap-3">
      <PartyAField
        idPrefix="magic-notifications"
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
        <p className="text-muted-foreground text-xs">Enter a SubAccount address to stream notifications.</p>
      ) : log.length === 0 ? (
        <p className="text-muted-foreground text-xs">Waiting for notifications…</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {log.map((entry) => (
            <NotificationLogRow key={entry.key} notification={entry.notification} receivedAt={entry.receivedAt} />
          ))}
        </ul>
      )}
    </div>
  );
}
