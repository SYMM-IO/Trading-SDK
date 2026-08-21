"use client";

import { Button } from "@/components/button";
import { MicroLabel } from "@/components/panel";
import type { FundingAccount } from "@/features/accounts/account-provider";
import type { TradingDelegation } from "@/features/wallet/use-trading-delegation";
import { formatDate } from "@/lib/format";
import { SubAccountIsolationType, type MarginRiskMetrics } from "@symmio/trading-core";
import { AccountAddress } from "./account-address";
import { MarginRiskFigures, type RiskDomain } from "./margin-risk-meter";
import { SelectorList } from "./selector-list";

export interface AccountDetailProps {
  account: FundingAccount;
  metrics?: MarginRiskMetrics;
  riskDomain: RiskDomain;
  hasRiskDomain: boolean;
  delegation: TradingDelegation;
  onAuthorise: () => void;
  /** The row's money controls, repeated here for widths where the row hides them. */
  onDeposit: () => void;
  onWithdraw: () => void;
  /** Absent on a VA-isolated account, where allocation does not exist. */
  onAllocate?: () => void;
}

const MODEL_NOTES: Record<SubAccountIsolationType, string> = {
  [SubAccountIsolationType.POSITION]:
    "Isolated per trade — every position opens its own Virtual Account and liquidates on its own.",
  [SubAccountIsolationType.MARKET]:
    "Isolated per market — the positions in one market share a Virtual Account and liquidate together.",
  [SubAccountIsolationType.MARKET_DIRECTION]:
    "Isolated per market and side — longs and shorts in a market each get their own Virtual Account.",
  [SubAccountIsolationType.CUSTOM]:
    "Cross-margin — every position draws on one allocated pool, and the account liquidates as a whole.",
};

/**
 * What the ledger row leaves out: the figures behind the gauge, each selector
 * the session key holds, and the account's full address.
 *
 * It opens under the row rather than in a sheet because none of it is an
 * action — it is the evidence for the row's two summaries, and the reader
 * wants it next to them.
 */
export function AccountDetail({
  account,
  metrics,
  riskDomain,
  hasRiskDomain,
  delegation,
  onAuthorise,
  onDeposit,
  onWithdraw,
  onAllocate,
}: AccountDetailProps) {
  const needsGrant = !delegation.isActive || delegation.isExpiringSoon;

  return (
    <div className="prism-ledger-span prism-rise border-b border-line-subtle bg-bg-2/60 px-4 pt-3 pb-4 last:border-b-0">
      <div className="grid gap-x-8 gap-y-4 md:grid-cols-3">
        <section className="flex min-w-0 flex-col gap-2">
          <MicroLabel>Liquidation</MicroLabel>
          <MarginRiskFigures metrics={metrics} domain={riskDomain} hasDomain={hasRiskDomain} />
        </section>

        <section className="flex min-w-0 flex-col gap-2">
          <MicroLabel>Trading access</MicroLabel>
          <SelectorList selectors={delegation.selectors} />
          <p className="text-2xs leading-relaxed text-fg-3">
            {!delegation.sessionKey
              ? "Waiting for the session key to load."
              : delegation.isActive
                ? `Authorised until ${formatDate(Number(delegation.expiresAt))}.`
                : "Checked by the contract at execution time — a missing grant fails silently, after the solver has accepted the order."}
          </p>
          {needsGrant && delegation.sessionKey ? (
            <Button variant="secondary" size="sm" className="w-fit" onClick={onAuthorise}>
              {delegation.isActive ? "Renew access" : "Authorise trading"}
            </Button>
          ) : null}
        </section>

        <section className="flex min-w-0 flex-col gap-2">
          <MicroLabel>Account</MicroLabel>
          <p className="text-sm text-fg-2">{MODEL_NOTES[account.detail.isolationType]}</p>
          <AccountAddress address={account.address} full />
          <div className="flex flex-wrap gap-1.5 pt-1 md:hidden">
            <Button variant="secondary" size="sm" onClick={onDeposit}>
              Deposit
            </Button>
            <Button variant="secondary" size="sm" onClick={onWithdraw}>
              Withdraw
            </Button>
            {onAllocate ? (
              <Button variant="secondary" size="sm" onClick={onAllocate}>
                Allocate
              </Button>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
