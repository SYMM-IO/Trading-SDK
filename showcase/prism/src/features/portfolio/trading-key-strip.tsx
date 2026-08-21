"use client";

import { Button } from "@/components/button";
import { MicroLabel, Panel } from "@/components/panel";
import { Numeric } from "@/components/value";
import type { FundingAccount } from "@/features/accounts/account-provider";
import { useSessionKey } from "@/features/session-key/use-session-key";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format";
import { useMemo, useState } from "react";
import { AccountAddress } from "./account-address";
import { useTradingAccessTally, type TradingAccessTally } from "./portfolio-metrics";

export interface TradingKeyStripProps {
  /** Every account across every deployment — the key is one per wallet, not per group. */
  accounts: readonly FundingAccount[];
}

/**
 * The session key, in one line, with how many accounts have authorised it.
 *
 * Instant trading works by signing orders with a **local key** the sub-account
 * has delegated to, so the order never opens a wallet prompt. The key is one
 * piece of state per wallet — which is why it is a strip above the groups and
 * not a column — while each account's grant is that account's business and
 * lives on its ledger row. Two things fail silently without this strip:
 *
 * - **The key itself.** It lives in this browser. Rotating it — or clearing site
 *   data — invalidates every grant made to the old one, and the next order fails
 *   on-chain rather than at the click. So rotation asks twice.
 * - **The tally.** The contract checks the delegation at execution time, after
 *   the solver has already accepted the request, so an account without a grant
 *   looks exactly like one whose orders vanish. `3 of 7` says which is which.
 */
export function TradingKeyStrip({ accounts }: TradingKeyStripProps) {
  const sessionKey = useSessionKey();
  const addresses = useMemo(() => accounts.map((account) => account.address), [accounts]);
  const tally = useTradingAccessTally(addresses);
  const [confirming, setConfirming] = useState(false);

  const rotate = () => {
    void sessionKey.rotate().finally(() => setConfirming(false));
  };

  return (
    <Panel className="flex flex-col gap-2 px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <KeyIcon />
        <MicroLabel>Session key</MicroLabel>
        {sessionKey.address ? (
          <AccountAddress address={sessionKey.address} lead={10} tail={8} size="sm" />
        ) : (
          <span className="text-sm text-fg-3">
            {sessionKey.isLoading ? "Creating a key for this wallet…" : "No key yet"}
          </span>
        )}
        {sessionKey.state.expiresAt ? (
          <span className="text-2xs text-fg-3">valid until {formatDate(sessionKey.state.expiresAt)}</span>
        ) : null}

        <Tally tally={tally} className="ml-auto" />

        {confirming ? (
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="text-2xs text-warn">Every account will need authorising again.</span>
            <Button variant="danger" size="sm" loading={sessionKey.isLoading} onClick={rotate}>
              Rotate anyway
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
              Keep it
            </Button>
          </span>
        ) : (
          <Button variant="ghost" size="sm" disabled={!sessionKey.address} onClick={() => setConfirming(true)}>
            Rotate key
          </Button>
        )}
      </div>

      <p className="text-2xs leading-relaxed text-fg-3">
        Orders are signed by this key in your browser, not by your wallet, so a trade never opens a prompt. Each account
        authorises it once, on-chain — a new key, from rotating or from cleared site data, has to be authorised again.
      </p>

      {sessionKey.error ? <p className="text-2xs text-warn">{sessionKey.error.message}</p> : null}
    </Panel>
  );
}

function Tally({ tally, className }: { tally: TradingAccessTally; className?: string }) {
  const settled = tally.total - tally.checking;
  const color =
    tally.total === 0 || settled === 0
      ? "var(--fg-3)"
      : tally.ready === tally.total
        ? "var(--long-500)"
        : "var(--warn-500)";

  return (
    <span className={cn("inline-flex items-center gap-2 text-sm text-fg-2", className)}>
      <span
        aria-hidden
        className={cn("size-[6px] shrink-0 rounded-full", tally.checking > 0 && "prism-pulse")}
        style={{ background: color }}
      />
      {tally.total === 0 ? (
        "No accounts yet"
      ) : (
        <span>
          <Numeric size="sm" tone="strong">
            {tally.ready}
          </Numeric>{" "}
          of{" "}
          <Numeric size="sm" tone="strong">
            {tally.total}
          </Numeric>{" "}
          {tally.total === 1 ? "account" : "accounts"} authorised
          {tally.checking > 0 ? <span className="text-fg-3"> · checking</span> : null}
        </span>
      )}
    </span>
  );
}

function KeyIcon() {
  return (
    <svg viewBox="0 0 16 16" width="13" height="13" fill="none" aria-hidden className="shrink-0 text-fg-3">
      <circle cx="5.5" cy="10.5" r="3" stroke="currentColor" strokeWidth="1.4" />
      <path d="M7.8 8.2L14 2m-2.5 2.5l2 2M9.5 6.5l2 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
