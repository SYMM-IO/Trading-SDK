"use client";

import { PageHeader } from "@/components/page-header";
import { useCollateralBalance, useSymmioConfig, useUserSubAccounts, useWalletAccount } from "@symmio/trading-react";
import { Card } from "@symmio/ui/components/card";
import { useMemo, useState, type CSSProperties } from "react";
import type { Address } from "viem";
import { CloseAllFlow } from "./close-all-flow";
import { DepositFlow } from "./deposit-flow";
import { InstantCloseFlow } from "./instant-close-flow";
import { InstantOpenFlow } from "./instant-open-flow";
import { Segmented, type SegmentedOption } from "./segmented";
import { TpSlFlow } from "./tpsl-flow";
import { WithdrawFlow } from "./withdraw-flow";

type Tab = "deposit" | "withdraw" | "instant-open" | "instant-close" | "close-all" | "tpsl";

/**
 * Flows grouped by what they act on: the first track moves collateral in and out
 * of a subaccount, the second acts on positions. The split is the only grouping
 * cue the switcher needs.
 */
const FLOW_GROUPS: readonly (readonly SegmentedOption<Tab>[])[] = [
  [
    { value: "deposit", label: "Deposit" },
    { value: "withdraw", label: "Withdraw" },
  ],
  [
    { value: "instant-open", label: "Instant Open" },
    { value: "instant-close", label: "Instant Close" },
    { value: "close-all", label: "Close All" },
    { value: "tpsl", label: "TP/SL" },
  ],
];

/**
 * Integration console for the SYMMIO React SDK: six product-grade flows —
 * deposit, withdraw, instant open, instant close, close all, TP/SL — built
 * entirely from `@symmio/trading-react` hooks. Each flow walks Connect → Select
 * subaccount → Act, with navigable steps and data loaded in the step that needs
 * it. The console sizes itself from its own container so it stays usable while
 * the magic sidebar is docked beside it.
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
    /**
     * `@container/console` — not a media query — is what every width decision on
     * this page keys off. The magic sidebar docks by reserving a right gutter on
     * the app shell, so the console can be squeezed to a narrow column while the
     * viewport stays wide; viewport breakpoints would keep laying out for a
     * width the console does not have. The container sits outside the padding so
     * container-driven padding can never feed back into the measurement.
     */
    <div className="@container/console mx-auto w-full max-w-5xl">
      <section className="flex w-full flex-col gap-8 px-4 py-12 @xl/console:px-6 @xl/console:py-16 @3xl/console:px-8">
        <PageHeader
          eyebrow="React SDK · Integration"
          title="From deposit to close"
          description="Six production flows — fund a subaccount, open and close instantly, set TP/SL, exit everything at once — composed entirely from @symmio/trading-react hooks. The same surface a third-party integrator builds on."
        />

        <Card
          className="animate-enter-up gap-6 p-4 @xl/console:p-6 @3xl/console:p-8"
          style={{ "--enter-delay": "80ms" } as CSSProperties}
        >
          <Segmented
            aria-label="Move collateral, or open and close positions"
            groups={FLOW_GROUPS}
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
          ) : tab === "instant-open" ? (
            <InstantOpenFlow
              owner={address}
              subAccount={subAccount}
              subAccountName={subAccountName}
              onSelectSubAccount={setSubAccount}
              ready={ready}
            />
          ) : tab === "instant-close" ? (
            <InstantCloseFlow
              owner={address}
              subAccount={subAccount}
              subAccountName={subAccountName}
              onSelectSubAccount={setSubAccount}
              ready={ready}
            />
          ) : tab === "close-all" ? (
            <CloseAllFlow
              owner={address}
              subAccount={subAccount}
              subAccountName={subAccountName}
              onSelectSubAccount={setSubAccount}
              ready={ready}
            />
          ) : (
            <TpSlFlow
              owner={address}
              subAccount={subAccount}
              subAccountName={subAccountName}
              onSelectSubAccount={setSubAccount}
              ready={ready}
            />
          )}
        </Card>
      </section>
    </div>
  );
}
