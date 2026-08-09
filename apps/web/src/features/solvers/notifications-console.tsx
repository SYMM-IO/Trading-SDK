"use client";

import { ResultError, ResultNote } from "@/components/result";
import { StatusDot } from "@/components/status-dot";
import { MagicPinButton } from "@/features/magic-sidebar/magic-pin-button";
import { NotificationLogRow } from "@/features/notifications/notification-log-row";
import { socketStatusLabel, socketStatusTone } from "@/features/notifications/socket-status-display";
import type { Notification } from "@symmio/trading-core";
import { useNotifications } from "@symmio/trading-react";
import { Badge } from "@symmio/ui/components/badge";
import { Button } from "@symmio/ui/components/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@symmio/ui/components/card";
import { useRef, useState } from "react";
import type { Address } from "viem";
import { SubAccountPicker } from "../inspector/subaccount-picker";
import { SolverTargetSelect, useSolverTargetState } from "./solver-target";

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
 * Interactive notifications console: pick a solver and a SubAccount, subscribe,
 * and watch the live notification stream with a connection-status badge and
 * pause/clear controls. Works for both solver kinds (enigma and rasa) — the
 * selected solver's chain id and id are passed to {@link useNotifications}.
 * Renders two cards — a subscription card and a live-log card.
 */
export function NotificationsConsole() {
  const { target, setTarget } = useSolverTargetState();
  const [selection, setSelection] = useState<Selection>({});
  const [account, setAccount] = useState<Address | undefined>(undefined);
  const [paused, setPaused] = useState(false);
  const [log, setLog] = useState<LogEntry[]>([]);

  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const seqRef = useRef(0);

  const { status, error } = useNotifications({
    account,
    chainId: target.chainId,
    solverId: target.solverId,
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
          <CardDescription>
            Pick a solver and a SubAccount, then subscribe to its live notifications stream.
          </CardDescription>
          <CardAction className="flex items-center gap-2">
            <StatusDot tone={socketStatusTone(status)} pulse={status === "open"} />
            <span className="text-sm">{socketStatusLabel(status)}</span>
            <MagicPinButton methodId="notifications" input={selection.subAccount} />
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-4">
          <SolverTargetSelect value={target} onChange={setTarget} testId="select-notifications-solver" />
          <SubAccountPicker idPrefix="notifications-console" selected={selection} onSelect={setSelection} />

          <div className="flex flex-wrap items-center gap-3">
            {subscribed ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={unsubscribe}
                data-testid="notifications-unsubscribe"
              >
                Unsubscribe
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                disabled={!selection.subAccount}
                onClick={subscribe}
                data-testid="notifications-subscribe"
              >
                Subscribe
              </Button>
            )}
            {subscribed ? <span className="text-muted-foreground font-mono text-xs">{account}</span> : null}
          </div>

          {error ? <ResultError testId="notifications-error" kind={error.kind} message={error.message} /> : null}
          {!subscribed && !error ? (
            <ResultNote testId="notifications-idle">
              Pick a SubAccount and subscribe to stream notifications.
            </ResultNote>
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
              data-testid="notifications-pause"
            >
              {paused ? "Resume" : "Pause"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={log.length === 0}
              onClick={() => setLog([])}
              data-testid="notifications-clear"
            >
              Clear
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          {log.length === 0 ? (
            <ResultNote testId="notifications-log-empty">
              {subscribed ? "Waiting for notifications…" : "No notifications yet."}
            </ResultNote>
          ) : (
            <ul className="flex flex-col gap-2" data-testid="notifications-log">
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
