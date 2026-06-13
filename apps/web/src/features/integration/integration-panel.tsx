"use client";

import { PageHeader } from "@/components/page-header";
import { useCollateralBalance, useSymmioConfig, useUserSubAccounts, useWalletAccount } from "@symm-frontier/react";
import { Card } from "@symm-frontier/ui/components/card";
import { useMemo, useState, type CSSProperties } from "react";
import type { Address } from "viem";
import { DepositFlow } from "./deposit-flow";
import { InstantOpenFlow } from "./instant-open-flow";
import { Segmented } from "./segmented";
import { WithdrawFlow } from "./withdraw-flow";

type Tab = "deposit" | "withdraw" | "instant-open";

/**
 * End-to-end Integration console for the SYMMIO React SDK: a product-grade
 * deposit / withdraw / instant-open wizard built entirely from
 * `@symm-frontier/react` hooks. Each flow walks Connect → Select subaccount →
 * Act, with navigable steps and data loaded in the step that needs it.
 */
export function IntegrationPanel() {
  const { address, chainId, isConnected, isOnExpectedChain } = useWalletAccount();
  const { addresses } = useSymmioConfig().getChainConfig();
  const balance = useCollateralBalance({ owner: address });
  const subAccountsQuery = useUserSubAccounts({ user: address });

  const [tab, setTab] = useState<Tab>("deposit");
  const [subAccount, setSubAccount] = useState<Address>();

  const subAccountName = useMemo(
    () => subAccountsQuery.data?.find((sub) => sub.accountAddress === subAccount)?.name || undefined,
    [subAccountsQuery.data, subAccount],
  );

  const ready = isConnected && isOnExpectedChain;

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
      <PageHeader
        eyebrow="React SDK · Integration"
        title="Move collateral, end to end"
        description="A production-grade deposit, withdraw, and instant-open wizard composed entirely from @symm-frontier/react hooks — the same surface a third-party integrator would build on."
      />

      <Card className="animate-enter-up gap-6 p-6 sm:p-8" style={{ "--enter-delay": "80ms" } as CSSProperties}>
        <Segmented
          aria-label="Deposit, withdraw, or open a position"
          options={[
            { value: "deposit", label: "Deposit" },
            { value: "withdraw", label: "Withdraw" },
            { value: "instant-open", label: "Instant Open" },
          ]}
          value={tab}
          onChange={setTab}
        />

        {tab === "deposit" ? (
          <DepositFlow
            owner={address}
            subAccount={subAccount}
            subAccountName={subAccountName}
            onSelectSubAccount={setSubAccount}
            decimals={addresses.collateralDecimals}
            balance={balance}
            ready={ready}
          />
        ) : tab === "withdraw" ? (
          <WithdrawFlow
            owner={address}
            subAccount={subAccount}
            subAccountName={subAccountName}
            onSelectSubAccount={setSubAccount}
            decimals={addresses.collateralDecimals}
            chainId={chainId}
            ready={ready}
          />
        ) : (
          <InstantOpenFlow
            owner={address}
            subAccount={subAccount}
            subAccountName={subAccountName}
            onSelectSubAccount={setSubAccount}
            ready={ready}
          />
        )}
      </Card>
    </section>
  );
}
