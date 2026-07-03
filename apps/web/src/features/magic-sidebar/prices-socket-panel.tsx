"use client";

import { StatusDot } from "@/components/status-dot";
import { socketStatusLabel, socketStatusTone } from "@/features/websocket/socket-status-display";
import type { EnigmaPriceTick } from "@symmio/trading-core";
import { useEnigmaPrices } from "@symmio/trading-react";
import { useRef } from "react";
import type { MagicMethodPanelProps } from "./magic-types";
import { usePersistentPinState } from "./magic-value-store";

/** Max log rows kept in the price-feed panel. */
const MAX_ROWS = 80;

interface LogEntry {
  key: string;
  receivedAt: number;
  ticks: EnigmaPriceTick[];
}

/**
 * Live magic-sidebar panel for the Enigma lowcap price WebSocket. Streams
 * incoming mark-price batches; each row shows the timestamp, batch size, and
 * the names+prices in the batch. Subscribes only while the card is expanded.
 */
export function PricesSocketPanel({ enabled, persistKey }: MagicMethodPanelProps) {
  const [log, setLog] = usePersistentPinState<LogEntry[]>(persistKey, []);
  const seqRef = useRef(0);

  const { status, error } = useEnigmaPrices({
    enabled,
    onTick: (ticks) => {
      seqRef.current += 1;
      const receivedAt = Date.now();
      const key = `${receivedAt}-${seqRef.current}`;
      setLog((prev) => [{ key, receivedAt, ticks }, ...prev].slice(0, MAX_ROWS));
    },
  });

  return (
    <div className="flex flex-col gap-3">
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

      {!enabled ? (
        <p className="text-muted-foreground text-xs">Expand the card to start streaming prices.</p>
      ) : log.length === 0 ? (
        <p className="text-muted-foreground text-xs">Waiting for price ticks…</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {log.map((entry) => (
            <PriceLogRow key={entry.key} ticks={entry.ticks} receivedAt={entry.receivedAt} />
          ))}
        </ul>
      )}
    </div>
  );
}

function PriceLogRow({ ticks, receivedAt }: { ticks: EnigmaPriceTick[]; receivedAt: number }) {
  const time = new Date(receivedAt).toLocaleTimeString();
  return (
    <li className="border-border bg-card/40 rounded-xl border px-3 py-2.5 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground font-mono text-xs tabular-nums">{time}</span>
        <span className="text-foreground/90 text-xs">
          {ticks.length} tick{ticks.length === 1 ? "" : "s"}
        </span>
      </div>
      <details className="mt-2">
        <summary className="text-muted-foreground hover:text-foreground cursor-pointer text-xs select-none">
          Prices
        </summary>
        <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5 font-mono text-[0.7rem]">
          {ticks.map((tick) => (
            <li key={tick.name} className="flex justify-between gap-2">
              <span className="text-muted-foreground truncate">{tick.name}</span>
              <span className="text-foreground">{tick.markPrice}</span>
            </li>
          ))}
        </ul>
      </details>
    </li>
  );
}
