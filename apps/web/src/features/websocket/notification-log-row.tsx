"use client";

import { NotificationType, type Notification } from "@theoldvarorg/core";
import { Badge } from "@theoldvarorg/ui/components/badge";
import { JsonView } from "@theoldvarorg/ui/components/json-view";

const TYPE_VARIANT = {
  [NotificationType.SUCCESS]: "positive",
  [NotificationType.FAILED]: "destructive",
  [NotificationType.SEEN]: "secondary",
} as const;

interface Props {
  notification: Notification;
  /** Client-side arrival time (ms epoch). */
  receivedAt: number;
}

/** One row in the live notifications log: time, type chip, quote, and a collapsible raw frame. */
export function NotificationLogRow({ notification, receivedAt }: Props) {
  const time = new Date(receivedAt).toLocaleTimeString();

  return (
    <li className="border-border bg-card/40 rounded-xl border px-3 py-2.5 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground font-mono text-xs tabular-nums">{time}</span>
        <Badge variant={TYPE_VARIANT[notification.type]} className="font-mono">
          {notification.type}
        </Badge>
        <span className="text-foreground/90">quote #{notification.quoteId}</span>
        {notification.lastSeenAction ? (
          <span className="text-muted-foreground truncate font-mono text-xs">{notification.lastSeenAction}</span>
        ) : null}
      </div>
      <details className="mt-2">
        <summary className="text-muted-foreground hover:text-foreground cursor-pointer text-xs select-none">
          Raw frame
        </summary>
        <div className="mt-2">
          <JsonView data={notification.raw} />
        </div>
      </details>
    </li>
  );
}
