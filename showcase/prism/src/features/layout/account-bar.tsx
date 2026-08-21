"use client";

import { Numeric } from "@/components/value";
import { accountEquity } from "@/features/accounts/account-math";
import { useFundingAccounts } from "@/features/accounts/account-provider";
import { usePrismMode } from "@/features/mode/mode-provider";
import { ConnectButton } from "@/features/wallet/connect-button";
import { formatUsd, fromWei } from "@/lib/format";
import { useWalletAccount } from "@symmio/trading-react";
import Link from "next/link";

/**
 * Total equity across the in-scope deployments, plus the wallet control.
 *
 * The figure sums `allocatedBalance` over every funding account the mode covers
 * — in unified mode that spans two chains, which is the whole point.
 */
export function AccountBar() {
  const { isConnected } = useWalletAccount();
  const { accounts, isLoading } = useFundingAccounts();
  const { deployments } = usePrismMode();

  const inScope = accounts.filter((account) => deployments.some((deployment) => deployment.family === account.family));
  const equity = inScope.reduce((total, account) => total + fromWei(accountEquity(account)), 0);

  return (
    <div className="flex items-center gap-2.5">
      {isConnected ? (
        <Link
          href="/portfolio"
          className="flex flex-col items-end justify-center gap-1 rounded-md px-2 py-1 leading-none transition-colors duration-[var(--dur-fast)] hover:bg-bg-2 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
        >
          <span className="text-2xs font-semibold tracking-[var(--tracking-mega)] text-fg-3 uppercase">Equity</span>
          {isLoading && inScope.length === 0 ? (
            <span className="prism-pulse block h-3 w-16 rounded-sm bg-bg-3" />
          ) : (
            <Numeric size="sm" tone="strong">
              {formatUsd(equity, { exact: true })}
            </Numeric>
          )}
        </Link>
      ) : null}

      {isConnected ? (
        <Link
          href="/portfolio"
          className="inline-flex h-7 cursor-pointer items-center justify-center rounded-md border border-transparent bg-accent px-3 text-sm font-semibold whitespace-nowrap text-fg-inverse transition-all duration-[var(--dur-fast)] hover:brightness-110 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-1 focus-visible:outline-none"
        >
          Deposit
        </Link>
      ) : null}

      <ConnectButton />
    </div>
  );
}
