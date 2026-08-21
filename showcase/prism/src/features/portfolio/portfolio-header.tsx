"use client";

import { Button } from "@/components/button";
import { Panel } from "@/components/panel";
import { Skeleton } from "@/components/table";
import { Numeric, Stat } from "@/components/value";
import type { Deployment } from "@/config/deployments";
import { accountEquity } from "@/features/accounts/account-math";
import type { FundingAccount } from "@/features/accounts/account-provider";
import { formatPnl, formatUsd, fromWei } from "@/lib/format";
import { useMemo } from "react";
import { AllocationBar, type AllocationSlice } from "./allocation-bar";
import { usePortfolioTotals } from "./portfolio-metrics";

export interface PortfolioHeaderProps {
  /** Accounts inside the palette mode's deployments — what the totals cover. */
  accounts: readonly FundingAccount[];
  /** The deployments those accounts belong to, in `DEPLOYMENTS` order. */
  deployments: readonly Deployment[];
  isLoading: boolean;
  onDeposit: () => void;
  onWithdraw: () => void;
  /** False until there is an account to fund. */
  canFund: boolean;
}

/**
 * The one-glance summary: what the portfolio is worth, what it is making, and
 * the two buttons that change either number.
 *
 * Equity and unrealized PnL are additive across accounts, so they are totalled
 * here. Margin risk is not, and deliberately is not shown — it lives on each
 * account card instead.
 */
export function PortfolioHeader({
  accounts,
  deployments,
  isLoading,
  onDeposit,
  onWithdraw,
  canFund,
}: PortfolioHeaderProps) {
  const addresses = useMemo(() => accounts.map((account) => account.address), [accounts]);
  const totals = usePortfolioTotals(addresses);

  const equity = accounts.reduce((total, account) => total + fromWei(accountEquity(account)), 0);

  const slices = useMemo<AllocationSlice[]>(
    () =>
      deployments.map((deployment) => ({
        family: deployment.family,
        label: deployment.label,
        value: accounts
          .filter((account) => account.family === deployment.family)
          .reduce((total, account) => total + fromWei(accountEquity(account)), 0),
      })),
    [accounts, deployments],
  );

  return (
    <Panel className="p-4">
      <div className="flex flex-wrap items-end gap-x-10 gap-y-5">
        <Stat
          label="Total equity"
          value={
            isLoading && accounts.length === 0 ? (
              <Skeleton className="h-7 w-32" />
            ) : (
              <span className="tnum text-3xl font-semibold text-fg-0">{formatUsd(equity, { exact: true })}</span>
            )
          }
          sub={
            deployments.length > 1
              ? "Across every group Prism merges"
              : `Covers the ${deployments[0]?.label ?? ""} group only`
          }
        />

        <Stat
          label="Unrealized P&L"
          value={
            totals.upnl === undefined ? (
              <Numeric size="xl" tone="muted">
                —
              </Numeric>
            ) : (
              <Numeric size="xl" signed={Number(totals.upnl)}>
                {formatPnl(fromWei(totals.upnl))}
              </Numeric>
            )
          }
          sub={totals.upnl === undefined ? "waiting on live marks" : "marked live off each feed"}
        />

        <Stat
          label="Open positions"
          value={
            <Numeric size="xl" tone="strong">
              {totals.openPositions}
            </Numeric>
          }
          sub={`${accounts.length} funding account${accounts.length === 1 ? "" : "s"}`}
        />

        <div className="ml-auto flex gap-2">
          <Button variant="primary" size="md" disabled={!canFund} onClick={onDeposit}>
            Deposit
          </Button>
          <Button variant="secondary" size="md" disabled={!canFund} onClick={onWithdraw}>
            Withdraw
          </Button>
        </div>
      </div>

      <div className="mt-4 border-t border-line-subtle pt-4">
        <AllocationBar slices={slices} />
      </div>
    </Panel>
  );
}
