"use client";

import { Panel } from "@/components/panel";
import { EmptyState } from "@/components/table";
import { DEPLOYMENTS } from "@/config/deployments";
import type { FundingAccount } from "@/features/accounts/account-provider";
import { useFundingAccounts } from "@/features/accounts/account-provider";
import { usePrismMode } from "@/features/mode/mode-provider";
import { DeploymentGroup } from "@/features/portfolio/deployment-group";
import { DepositModal } from "@/features/portfolio/deposit-modal";
import { GroupBoundaryNote } from "@/features/portfolio/group-boundary-note";
import { PortfolioHeader } from "@/features/portfolio/portfolio-header";
import { PortfolioMetricsProvider } from "@/features/portfolio/portfolio-metrics";
import { TradingKeyStrip } from "@/features/portfolio/trading-key-strip";
import { WithdrawModal } from "@/features/portfolio/withdraw-modal";
import { ConnectButton } from "@/features/wallet/connect-button";
import { useWalletAccount } from "@symmio/trading-react";
import { useMemo, useState } from "react";

/**
 * Portfolio — every account, on every deployment, with the money controls.
 *
 * The page itself owns almost nothing: it resolves which accounts the palette
 * mode covers, then hands each deployment its own group. All the per-account
 * SDK reads live inside the cards, because a hook cannot be called in a loop and
 * one card is one account's worth of hooks.
 */
export default function Page() {
  const { isConnected } = useWalletAccount();
  const { accounts, byFamily, selected, isLoading, failures } = useFundingAccounts();
  const { deployments } = usePrismMode();
  const [flow, setFlow] = useState<"deposit" | "withdraw" | undefined>(undefined);

  /* The header totals follow the palette mode; the groups below always render
     every deployment, so the boundary between them stays visible even when the
     mode has narrowed the numbers. */
  const inScope = useMemo(
    () => accounts.filter((account) => deployments.some((one) => one.family === account.family)),
    [accounts, deployments],
  );

  const target = useMemo<FundingAccount | undefined>(() => {
    for (const deployment of deployments) {
      const chosen = selected[deployment.family];
      if (chosen) return chosen;
    }
    return inScope[0];
  }, [deployments, selected, inScope]);

  if (!isConnected) {
    return (
      <div className="mx-auto w-full max-w-[1180px] px-5 py-6">
        <Panel>
          <EmptyState
            title="Connect a wallet to see your accounts"
            body="Prism reads your sub-accounts on every deployment it merges. Nothing is stored — the accounts, balances and margin state all come straight from the chains."
            action={<ConnectButton />}
          />
        </Panel>
      </div>
    );
  }

  return (
    <PortfolioMetricsProvider>
      <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-4 px-5 py-6">
        <PortfolioHeader
          accounts={inScope}
          deployments={deployments}
          isLoading={isLoading}
          canFund={Boolean(target)}
          onDeposit={() => setFlow("deposit")}
          onWithdraw={() => setFlow("withdraw")}
        />

        <TradingKeyStrip accounts={accounts} />

        {DEPLOYMENTS.map((deployment) => (
          <DeploymentGroup
            key={deployment.family}
            deployment={deployment}
            accounts={byFamily[deployment.family]}
            isLoading={isLoading}
            error={failures.find((failure) => failure.deployment.family === deployment.family)?.error}
            inScope={deployments.some((one) => one.family === deployment.family)}
          />
        ))}

        <GroupBoundaryNote />
      </div>

      {target ? (
        <>
          <DepositModal account={target} open={flow === "deposit"} onClose={() => setFlow(undefined)} />
          <WithdrawModal account={target} open={flow === "withdraw"} onClose={() => setFlow(undefined)} />
        </>
      ) : null}
    </PortfolioMetricsProvider>
  );
}
