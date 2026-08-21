"use client";

import { Button } from "@/components/button";
import { MarginModeTag } from "@/components/margin-mode-tag";
import { Numeric, type NumericProps } from "@/components/value";
import { accountEquity, isCrossMargin, lockedMargin, spendableMargin } from "@/features/accounts/account-math";
import type { FundingAccount } from "@/features/accounts/account-provider";
import { useTradingDelegation } from "@/features/wallet/use-trading-delegation";
import { cn } from "@/lib/cn";
import { formatPnl, formatUsd, fromWei } from "@/lib/format";
import { getAccountBalanceInfoQueryOptions, type AccountBalanceInfo } from "@symmio/trading-core";
import {
  useAccountMarginRisk,
  useAccountUpnl,
  useSymmioConfig,
  useVirtualAccountsAddressesOfSubAccount,
} from "@symmio/trading-react";
import { useQueries, type UseQueryOptions } from "@tanstack/react-query";
import { useEffect, useState, type MouseEvent, type ReactNode } from "react";
import { AccountAddress } from "./account-address";
import { AccountDetail } from "./account-detail";
import { AccountName } from "./account-name";
import { AllocateModal } from "./allocate-modal";
import { AuthoriseModal } from "./authorise-modal";
import { DepositModal } from "./deposit-modal";
import { MarginRiskGauge } from "./margin-risk-meter";
import { usePortfolioMetricsRegistry, type TradingAccessState } from "./portfolio-metrics";
import { TradingAccessChip } from "./trading-access-chip";
import { WithdrawModal } from "./withdraw-modal";

export interface AccountRowProps {
  account: FundingAccount;
}

type OpenFlow = "deposit" | "withdraw" | "allocate" | "authorise" | undefined;

/**
 * One funding account as a ledger line: what it holds, how close it is to
 * liquidation, whether the session key may trade for it, and the three ways to
 * move money in or out.
 *
 * Every per-account SDK read is mounted here rather than in the group, because
 * a hook cannot be called in a loop — one row is one account's worth of hooks.
 * The uPnL and the access state are reported up to the page registry so the
 * header and the session-key strip can total them without re-running anything.
 */
export function AccountRow({ account }: AccountRowProps) {
  const { deployment } = account;
  const [flow, setFlow] = useState<OpenFlow>(undefined);
  const [expanded, setExpanded] = useState(false);
  const { report, forget } = usePortfolioMetricsRegistry();

  const { upnl, openPositionCount } = useAccountUpnl({
    account: account.address,
    chainId: deployment.chainId,
    solverId: deployment.solverId,
  });

  const crossMargin = isCrossMargin(account);

  /* Every Virtual Account under this sub-account. On a cross-margin account
     there are none — asking anyway is a wasted on-chain read for an address the
     trade will never land in — so the fan-out is gated on the isolation type. */
  const virtualAccounts = useVirtualAccountsAddressesOfSubAccount({
    subAccount: account.address,
    chainId: deployment.chainId,
    query: { enabled: !crossMargin },
  });

  /* Margin risk is read ONCE PER LIQUIDATION DOMAIN and never summed. On a
     cross-margin account the domain is the sub-account itself. On a VA-isolated
     account every VA liquidates independently, and the sub-account's own
     `balanceInfoOfPartyA` is all zeros — feeding it VA-sourced uPnL produced a
     buffer with no relationship to anything, and rendered a reassuring "no
     margin at risk" for an account whose VA could be one tick from liquidation.
     So the gauge targets a VA rather than the parent. */
  const riskAccount = crossMargin ? account.address : virtualAccounts.data?.[0];

  /* A VA-isolated account's margin lives in its Virtual Accounts, not in the
     sub-account — reading the parent reports `$0 in positions` for an account
     with open risk. One fan-out over the VA list, through the same query-options
     factory the SDK ships, keeps the figures on one cache. */
  const config = useSymmioConfig();
  const virtualBalances = useQueries({
    queries: (virtualAccounts.data ?? []).map(
      (address) =>
        getAccountBalanceInfoQueryOptions(config, {
          chainId: deployment.chainId,
          account: address,
        }) as UseQueryOptions<AccountBalanceInfo, Error, AccountBalanceInfo, readonly unknown[]>,
    ),
  });

  const virtualMargin = virtualBalances.reduce(
    (total, query) => total + (query.data ? query.data.allocatedBalance : 0n),
    0n,
  );
  const virtualLocked = virtualBalances.reduce((total, query) => total + lockedMargin(query.data), 0n);

  const marginRisk = useAccountMarginRisk({
    account: riskAccount,
    upnl: upnl ?? 0n,
    chainId: deployment.chainId,
    live: false,
  });

  const delegation = useTradingDelegation(account);
  const access: TradingAccessState =
    !delegation.sessionKey || delegation.isLoading ? "checking" : delegation.isActive ? "ready" : "missing";

  useEffect(() => {
    report(account.address, { upnl, openPositionCount, access });
  }, [report, account.address, upnl, openPositionCount, access]);

  useEffect(() => () => forget(account.address), [forget, account.address]);

  const equity = fromWei(accountEquity(account, virtualMargin));
  const free = fromWei(spendableMargin(account, upnl ?? 0n));
  const locked = fromWei(crossMargin ? lockedMargin(account.balance) : virtualLocked);
  const riskDomain = crossMargin ? "account" : "virtual-account";
  const hasRiskDomain = crossMargin || (virtualAccounts.data?.length ?? 0) > 0;

  /* Anywhere on the row that is not itself a control toggles the detail. The
     chevron is the same toggle for the keyboard. */
  const onRowClick = (event: MouseEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("button, a, input")) return;
    setExpanded((value) => !value);
  };

  return (
    <>
      <div
        onClick={onRowClick}
        className={cn(
          "prism-ledger-row cursor-pointer border-b border-line-subtle px-4 py-2.5 last:border-b-0",
          "transition-colors duration-[var(--dur-fast)] ease-[var(--ease-out)]",
          expanded ? "bg-bg-2/60" : "hover:bg-bg-2/40",
        )}
      >
        <div className="flex min-w-0 flex-col gap-0.5">
          <AccountName account={account} />
          <div className="flex min-w-0 items-center gap-2">
            <MarginModeTag crossMargin={crossMargin} />
            <AccountAddress address={account.address} />
          </div>
        </div>

        <Figure value={formatUsd(equity, { exact: true })} tone={equity > 0 ? "strong" : "muted"} />

        <Figure
          className="hidden lg:flex"
          value={formatUsd(free, { exact: true })}
          tone={free > 0 ? "default" : "muted"}
        />

        <Figure
          className="hidden lg:flex"
          value={formatUsd(locked, { exact: true })}
          tone={locked > 0 ? "default" : "muted"}
          sub={openPositionCount > 0 ? `${openPositionCount} open` : "flat"}
        />

        <Figure
          className="hidden md:flex"
          value={upnl === undefined ? "—" : formatPnl(fromWei(upnl))}
          tone={upnl === undefined ? "muted" : undefined}
          signed={upnl === undefined ? undefined : Number(upnl)}
          sub={upnl === undefined && openPositionCount > 0 ? "pricing" : undefined}
        />

        <div className="hidden md:block">
          <MarginRiskGauge
            metrics={marginRisk.metrics}
            isLoading={marginRisk.isLoading || virtualAccounts.isLoading}
            hasDomain={hasRiskDomain}
          />
        </div>

        <div className="flex">
          <TradingAccessChip delegation={delegation} onAuthorise={() => setFlow("authorise")} />
        </div>

        <div className="flex items-center justify-end gap-0.5">
          {/* The money controls leave the row on narrow screens (the detail
              repeats them there). They are wrapped rather than hidden directly
              because `Button` sets its own display, which would win. */}
          <span className="hidden md:contents">
            <Button variant="ghost" size="sm" onClick={() => setFlow("deposit")}>
              Deposit
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setFlow("withdraw")}>
              Withdraw
            </Button>
          </span>
          {/* Allocation is a cross-margin concept. On a VA-isolated account it
              moves collateral OUT of what an instant open can spend, so the
              control simply does not exist there. */}
          {crossMargin ? (
            <span className="hidden lg:contents">
              <Button variant="ghost" size="sm" onClick={() => setFlow("allocate")}>
                Allocate
              </Button>
            </span>
          ) : null}
          <button
            type="button"
            aria-expanded={expanded}
            aria-label={expanded ? "Hide account details" : "Show account details"}
            onClick={() => setExpanded((value) => !value)}
            className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-sm text-fg-3 transition-colors duration-[var(--dur-fast)] hover:bg-bg-2 hover:text-fg-0 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
          >
            <ChevronIcon
              className={cn(
                "transition-transform duration-[var(--dur-base)] ease-[var(--ease-out)]",
                expanded && "rotate-180",
              )}
            />
          </button>
        </div>
      </div>

      {expanded ? (
        <AccountDetail
          account={account}
          metrics={marginRisk.metrics}
          riskDomain={riskDomain}
          hasRiskDomain={hasRiskDomain}
          delegation={delegation}
          onAuthorise={() => setFlow("authorise")}
          onDeposit={() => setFlow("deposit")}
          onWithdraw={() => setFlow("withdraw")}
          onAllocate={crossMargin ? () => setFlow("allocate") : undefined}
        />
      ) : null}

      <DepositModal account={account} open={flow === "deposit"} onClose={() => setFlow(undefined)} />
      <WithdrawModal account={account} open={flow === "withdraw"} onClose={() => setFlow(undefined)} />
      {crossMargin ? (
        <AllocateModal account={account} open={flow === "allocate"} onClose={() => setFlow(undefined)} />
      ) : null}
      <AuthoriseModal
        account={account}
        delegation={delegation}
        open={flow === "authorise"}
        onClose={() => setFlow(undefined)}
      />
    </>
  );
}

interface FigureProps {
  value: ReactNode;
  sub?: string;
  tone?: NumericProps["tone"];
  signed?: number;
  className?: string;
}

/** A ledger figure with its optional caption. Zeros are muted so funded rows carry the weight. */
function Figure({ value, sub, tone, signed, className }: FigureProps) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-0.5", className)}>
      <Numeric size="md" tone={tone} signed={signed} className="truncate">
        {value}
      </Numeric>
      {sub ? <span className="truncate text-2xs text-fg-3">{sub}</span> : null}
    </div>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 12 12" width="11" height="11" fill="none" aria-hidden className={className}>
      <path
        d="M2.5 4.5L6 8l3.5-3.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
