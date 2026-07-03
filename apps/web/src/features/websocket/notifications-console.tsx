"use client";

import { ResultError, ResultNote } from "@/components/result";
import { StatusDot } from "@/components/status-dot";
import { MagicPinButton } from "@/features/magic-sidebar/magic-pin-button";
import type { Notification } from "@symmio/trading-core";
import { useNotifications } from "@symmio/trading-react";
import { Badge } from "@symmio/ui/components/badge";
import { Button } from "@symmio/ui/components/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@symmio/ui/components/card";
import { useRef, useState } from "react";
import type { Address } from "viem";
import { SubAccountPicker } from "../inspector/subaccount-picker";
import { NotificationLogRow } from "./notification-log-row";
import { socketStatusLabel, socketStatusTone } from "./socket-status-display";

/** Max log rows kept on screen. */
const MAX_ROWS = 200;

interface Selection {
  subAccount?: Address;
  name?: string;
}

interface LogEntry {
  key: string;
  receivedAt: number;
  notification: Notification;
}

/**
 * Interactive notifications console: pick a SubAccount, subscribe, and watch the
 * live notification stream with a connection-status badge and pause/clear
 * controls. Renders two cards — a subscription card and a live-log card.
 */
export function NotificationsConsole() {
  const [selection, setSelection] = useState<Selection>({});
  const [account, setAccount] = useState<Address | undefined>(undefined);
  const [paused, setPaused] = useState(false);
  const [log, setLog] = useState<LogEntry[]>([]);

  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const seqRef = useRef(0);

  const { status, error } = useNotifications({
    account,
    enabled: Boolean(account),
    onNotification: (notification) => {
      if (pausedRef.current) return;
      seqRef.current += 1;
      const key = `${notification.id}-${seqRef.current}`;
      setLog((prev) => [{ key, receivedAt: Date.now(), notification }, ...prev].slice(0, MAX_ROWS));
    },
  });

  const subscribed = Boolean(account);

  const subscribe = () => {
    if (!selection.subAccount) return;
    setLog([]);
    setPaused(false);
    setAccount(selection.subAccount);
  };
  const unsubscribe = () => setAccount(undefined);

  return (
    <>
      <Card className="animate-enter-up">
        <CardHeader>
          <CardTitle>Subscription</CardTitle>
          <CardDescription>Pick a SubAccount and subscribe to its live notifications stream.</CardDescription>
          <CardAction className="flex items-center gap-2">
            <StatusDot tone={socketStatusTone(status)} pulse={status === "open"} />
            <span className="text-sm">{socketStatusLabel(status)}</span>
            <MagicPinButton methodId="notifications" input={selection.subAccount} />
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-4">
          <SubAccountPicker idPrefix="websocket" selected={selection} onSelect={setSelection} />

          <div className="flex flex-wrap items-center gap-3">
            {subscribed ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={unsubscribe}
                data-testid="websocket-unsubscribe"
              >
                Unsubscribe
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                disabled={!selection.subAccount}
                onClick={subscribe}
                data-testid="websocket-subscribe"
              >
                Subscribe
              </Button>
            )}
            {subscribed ? <span className="text-muted-foreground font-mono text-xs">{account}</span> : null}
          </div>

          {error ? <ResultError testId="websocket-error" kind={error.kind} message={error.message} /> : null}
          {!subscribed && !error ? (
            <ResultNote testId="websocket-idle">Pick a SubAccount and subscribe to stream notifications.</ResultNote>
          ) : null}
        </CardContent>
      </Card>

      <Card className="animate-enter-up">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Live log
            <Badge variant="secondary" className="font-mono">
              {log.length}
            </Badge>
          </CardTitle>
          <CardAction className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!subscribed}
              onClick={() => setPaused((p) => !p)}
              data-testid="websocket-pause"
            >
              {paused ? "Resume" : "Pause"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={log.length === 0}
              onClick={() => setLog([])}
              data-testid="websocket-clear"
            >
              Clear
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          {log.length === 0 ? (
            <ResultNote testId="websocket-log-empty">
              {subscribed ? "Waiting for notifications…" : "No notifications yet."}
            </ResultNote>
          ) : (
            <ul className="flex flex-col gap-2" data-testid="websocket-log">
              {log.map((entry) => (
                <NotificationLogRow key={entry.key} notification={entry.notification} receivedAt={entry.receivedAt} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}
