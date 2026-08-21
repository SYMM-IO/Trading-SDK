"use client";

import { MicroLabel } from "@/components/panel";
import { Pill, SolverPill } from "@/components/pill";
import { DataRow, DataTable, EmptyState } from "@/components/table";
import { Numeric } from "@/components/value";
import { FAMILY_PALETTE, type Deployment, type MarketFamily } from "@/config/deployments";
import type { FundingAccount } from "@/features/accounts/account-provider";
import { formatClock, formatRelativeTime, shortenAddress } from "@/lib/format";
import {
  getQuoteQueryOptions,
  NotificationType,
  type GetQuoteReturnType,
  type Notification,
  type SocketStatus,
} from "@symmio/trading-core";
import { useNotifications, useSymmioConfig } from "@symmio/trading-react";
import { useQueries, type UseQueryOptions } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AccountCell } from "./account-cell";
import { ActivityGate } from "./activity-gate";
import type { StreamStatusFilter } from "./activity-types";
import type { ActivityAccountsResult } from "./use-activity-accounts";
import { useMarketNameLookup } from "./use-market-name";

const COLUMNS =
  "minmax(104px,0.7fr) minmax(104px,0.8fr) minmax(96px,0.6fr) minmax(76px,0.5fr) minmax(88px,0.7fr) minmax(168px,1.2fr) minmax(88px,0.6fr) minmax(180px,1.4fr)";

/** Events retained in the feed. Deep enough to scroll, bounded so it cannot grow forever. */
const BUFFER_LIMIT = 200;

/** Cap on the id → market reads. A busy account can outrun any lookup budget. */
const MARKET_LOOKUP_LIMIT = 40;

/** How often relative timestamps are recomputed between events. */
const REFRESH_INTERVAL = 5_000;

/** Lifecycle colors, from the design system's state ramp — never the mode accent. */
const STATUS_COLORS: Record<NotificationType, string> = {
  [NotificationType.SUCCESS]: "var(--state-opened)",
  [NotificationType.FAILED]: "var(--state-liquidated)",
  [NotificationType.SEEN]: "var(--state-pending)",
};

const STATUS_LABELS: Record<NotificationType, string> = {
  [NotificationType.SUCCESS]: "Success",
  [NotificationType.FAILED]: "Failed",
  [NotificationType.SEEN]: "Seen",
};

/** One notification, tagged with where it arrived from and when. */
interface StreamEvent {
  key: string;
  notification: Notification;
  deployment: Deployment;
  family: MarketFamily;
  /** The sub-account whose socket delivered the frame. */
  account: FundingAccount;
  /**
   * Client arrival time. The wire's own `create_time` is optional and differs
   * per protocol, so ordering a two-solver merge on it would be unreliable.
   */
  receivedAt: number;
}

/** One live subscription's state, surfaced so a dead socket is never mistaken for a quiet one. */
interface SocketState {
  key: string;
  deployment: Deployment;
  accountName: string;
  accountAddress: string;
  status: SocketStatus;
  error: Error | null;
}

export interface LiveStreamTabProps {
  accounts: ActivityAccountsResult;
  filter: StreamStatusFilter;
}

/**
 * The merged solver event stream — both deployments, one feed.
 *
 * `useNotifications` watches a single `(chainId, solverId, account)` triple and
 * a hook cannot be called in a loop, so each in-scope account gets its own
 * subscriber component (the same shape the price feeds use) and they push into
 * one shared buffer. In the ordinary one-account-per-chain case that is exactly
 * one subscription per deployment.
 *
 * The two wires are genuinely different protocols — rasa multiplexes every
 * account onto one socket and sends bare frames, enigma opens a channel per
 * account and wraps frames in an envelope — and the SDK normalizes both into the
 * same `Notification`. That is what makes a single merged feed possible at all.
 */
export function LiveStreamTab({ accounts, filter }: LiveStreamTabProps) {
  const [events, setEvents] = useState<readonly StreamEvent[]>([]);
  const [sockets, setSockets] = useState<Readonly<Record<string, SocketState>>>({});
  const sequence = useRef(0);
  const marketName = useMarketNameLookup();
  useIntervalRefresh(REFRESH_INTERVAL);

  const pushEvent = useCallback((account: FundingAccount, notification: Notification) => {
    const { deployment } = account;
    sequence.current += 1;
    const event: StreamEvent = {
      key: `${deployment.family}:${sequence.current}`,
      notification,
      deployment,
      family: deployment.family,
      account,
      receivedAt: Date.now(),
    };
    setEvents((current) => [event, ...current].slice(0, BUFFER_LIMIT));
  }, []);

  const reportSocket = useCallback((state: SocketState) => {
    setSockets((current) => {
      const previous = current[state.key];
      if (previous && previous.status === state.status && previous.error === state.error) return current;
      return { ...current, [state.key]: state };
    });
  }, []);

  const visible = useMemo(
    () => (filter === "all" ? events : events.filter((event) => event.notification.type === filter)),
    [events, filter],
  );

  const marketByQuote = useQuoteMarkets(events);
  const socketStates = accounts.accounts.map((account) => sockets[socketKey(account)]).filter(isPresent);

  return (
    <ActivityGate accounts={accounts} columns={COLUMNS} cells={8}>
      {accounts.accounts.map((account) => (
        <AccountStream key={socketKey(account)} account={account} onEvent={pushEvent} onStatus={reportSocket} />
      ))}

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-line-subtle px-4 py-3">
        {socketStates.length === 0 ? (
          <span className="text-sm text-fg-3">No sockets — no sub-account in scope to subscribe for.</span>
        ) : null}

        {socketStates.map((socket) => (
          <div key={socket.key} className="flex items-center gap-2">
            <SolverPill family={socket.deployment.family} />
            <span
              aria-hidden
              className={socket.status === "open" ? "prism-pulse size-[6px] rounded-full" : "size-[6px] rounded-full"}
              style={{ background: SOCKET_COLORS[socket.status] }}
            />
            <span className="text-sm text-fg-2">{SOCKET_LABELS[socket.status]}</span>
            <span className="max-w-[160px] truncate text-2xs text-fg-3">
              {`${socket.accountName} · ${shortenAddress(socket.accountAddress)}`}
            </span>
            {socket.error ? <span className="text-2xs text-short">{socket.error.message}</span> : null}
          </div>
        ))}

        <span className="ml-auto text-2xs text-fg-3">
          {`${visible.length} of ${events.length} buffered · newest first`}
        </span>
      </div>

      <DataTable
        columns={COLUMNS}
        head={
          <>
            <MicroLabel>Solver</MicroLabel>
            <MicroLabel>Account</MicroLabel>
            <MicroLabel>Received</MicroLabel>
            <MicroLabel>Quote</MicroLabel>
            <MicroLabel>Market</MicroLabel>
            <MicroLabel>Action</MicroLabel>
            <MicroLabel>Status</MicroLabel>
            <MicroLabel>Detail</MicroLabel>
          </>
        }
      >
        {visible.map((event) => {
          const { notification } = event;
          const quoteId = onchainQuoteId(notification);
          const symbolId = quoteId === undefined ? undefined : marketByQuote.get(`${event.family}:${quoteId}`);
          const detail = detailOf(notification);

          return (
            <DataRow key={event.key} columns={COLUMNS} accent={FAMILY_PALETTE[event.family].base}>
              <SolverPill family={event.family} />

              <AccountCell name={event.account.name} address={event.account.address} />

              <span className="flex min-w-0 flex-col">
                <Numeric size="sm" tone="muted">
                  {formatClock(event.receivedAt)}
                </Numeric>
                <span className="text-2xs text-fg-3">{formatRelativeTime(event.receivedAt)}</span>
              </span>

              <Numeric size="sm" tone={quoteId === undefined ? "muted" : "default"}>
                {quoteId === undefined ? `temp ${notification.tempQuoteId}` : `#${quoteId}`}
              </Numeric>

              <span className="truncate font-display text-md font-semibold text-fg-0">
                {symbolId === undefined ? "—" : marketName(event.family, symbolId)}
              </span>

              <span className="tnum truncate text-sm text-fg-1">{notification.lastSeenAction ?? "—"}</span>

              <Pill
                color={STATUS_COLORS[notification.type]}
                background={`color-mix(in srgb, ${STATUS_COLORS[notification.type]} 13%, transparent)`}
                border={`color-mix(in srgb, ${STATUS_COLORS[notification.type]} 26%, transparent)`}
              >
                {STATUS_LABELS[notification.type]}
              </Pill>

              <span className="truncate text-sm text-fg-3">{detail}</span>
            </DataRow>
          );
        })}
      </DataTable>

      {visible.length === 0 ? (
        <EmptyState
          title={events.length === 0 ? "Waiting for events" : "No events match this filter"}
          body={
            events.length === 0
              ? "The stream carries this sub-account's own order lifecycle — sent, locked, filled, closed. Place or close a position and it lands here within a second."
              : "Events are still arriving; widen the status filter to see them."
          }
        />
      ) : null}
    </ActivityGate>
  );
}

/** Socket-status colors, reusing the lifecycle ramp so nothing new is invented. */
const SOCKET_COLORS: Record<SocketStatus, string> = {
  open: "var(--state-opened)",
  connecting: "var(--state-pending)",
  reconnecting: "var(--state-pending)",
  closing: "var(--state-close-pending)",
  closed: "var(--state-closed)",
};

const SOCKET_LABELS: Record<SocketStatus, string> = {
  open: "Live",
  connecting: "Connecting",
  reconnecting: "Reconnecting",
  closing: "Closing",
  closed: "Closed",
};

interface AccountStreamProps {
  account: FundingAccount;
  onEvent: (account: FundingAccount, notification: Notification) => void;
  onStatus: (state: SocketState) => void;
}

/** One account's live subscription. Renders nothing; it only reports upward. */
function AccountStream({ account, onEvent, onStatus }: AccountStreamProps) {
  const { deployment } = account;

  const handleNotification = useCallback(
    (notification: Notification) => onEvent(account, notification),
    [account, onEvent],
  );

  const { status, error } = useNotifications({
    account: account.address,
    chainId: deployment.chainId,
    solverId: deployment.solverId,
    onNotification: handleNotification,
    /** The feed keeps its own merged buffer, so the hook's copy stays minimal. */
    limit: 1,
  });

  useEffect(() => {
    onStatus({
      key: socketKey(account),
      deployment,
      accountName: account.name,
      accountAddress: account.address,
      status,
      error,
    });
  }, [account, deployment, status, error, onStatus]);

  return null;
}

/**
 * Resolve each streamed quote id to the market it trades.
 *
 * The wire identifies a position by quote id and nothing else — no symbol, no
 * market id — so the feed would otherwise show a bare number. `getQuote` is a
 * single storage read and a quote's market never changes, so the results are
 * cached indefinitely and only the newest ids are ever looked up.
 */
function useQuoteMarkets(events: readonly StreamEvent[]): ReadonlyMap<string, number> {
  const config = useSymmioConfig();

  const targets = useMemo(() => {
    const seen = new Set<string>();
    const collected: { key: string; chainId: number; quoteId: bigint }[] = [];

    for (const event of events) {
      const quoteId = onchainQuoteId(event.notification);
      if (quoteId === undefined) continue;
      const key = `${event.family}:${quoteId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      collected.push({ key, chainId: event.deployment.chainId, quoteId });
      if (collected.length >= MARKET_LOOKUP_LIMIT) break;
    }

    return collected;
  }, [events]);

  const queries = useQueries({
    queries: targets.map(
      (target) =>
        ({
          ...getQuoteQueryOptions(config, { chainId: target.chainId, quoteId: target.quoteId }),
          staleTime: Number.POSITIVE_INFINITY,
        }) as UseQueryOptions<GetQuoteReturnType, Error, GetQuoteReturnType, readonly unknown[]>,
    ),
  });

  return useMemo(() => {
    const resolved = new Map<string, number>();
    targets.forEach((target, index) => {
      const quote = queries[index]?.data;
      if (quote) resolved.set(target.key, Number(quote.symbolId));
    });
    return resolved;
  }, [targets, queries]);
}

/**
 * Re-render on an interval so relative timestamps stay honest between events.
 *
 * A quiet feed would otherwise freeze at "3s ago" until the next notification
 * arrived, which reads as a stalled socket rather than a calm one.
 */
function useIntervalRefresh(intervalMs: number): void {
  const [, setTick] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setTick((value) => value + 1), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
}

/** The on-chain quote id, or `undefined` while the order still carries a temp id. */
function onchainQuoteId(notification: Notification): bigint | undefined {
  const parsed = Number(notification.quoteId);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return BigInt(parsed);
}

/** The most useful thing the frame says beyond its status. */
function detailOf(notification: Notification): string {
  if (notification.failureMessage) return notification.failureMessage;
  if (notification.failureType) {
    return notification.errorCode === null
      ? notification.failureType
      : `${notification.failureType} (${notification.errorCode})`;
  }
  if (notification.filledAmountClose) {
    return `closed ${notification.filledAmountClose} @ ${notification.avgPriceClose || "—"}`;
  }
  if (notification.filledAmountOpen) {
    return `opened ${notification.filledAmountOpen} @ ${notification.avgPriceOpen || "—"}`;
  }
  return notification.stateType ?? "—";
}

/** Stable identity for one subscription. */
function socketKey(account: FundingAccount): string {
  return `${account.family}:${account.address}`;
}

/** Narrowing guard for the sparse socket lookup. */
function isPresent<T>(value: T | undefined): value is T {
  return value !== undefined;
}
