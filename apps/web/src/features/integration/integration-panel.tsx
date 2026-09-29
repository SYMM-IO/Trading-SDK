"use client";

import { PageHeader } from "@/components/page-header";
import {
  useCollateralBalance,
  useSupportsLimitOrder,
  useSymmioConfig,
  useUserSubAccounts,
  useWalletAccount,
} from "@symmio/trading-react";
import { Card } from "@symmio/ui/components/card";
import { useMemo, useState, type CSSProperties } from "react";
import type { Address } from "viem";
import { CancelCloseFlow } from "./cancel-close-flow";
import { CancelLimitFlow } from "./cancel-limit-flow";
import { CloseAllFlow } from "./close-all-flow";
import { DepositFlow } from "./deposit-flow";
import { InstantCloseFlow } from "./instant-close-flow";
import { InstantOpenFlow } from "./instant-open-flow";
import { Segmented, type SegmentedOption } from "./segmented";
import { SetupFlow } from "./setup-flow";
import { TpSlFlow } from "./tpsl-flow";
import { WithdrawFlow } from "./withdraw-flow";

type Tab =
  | "setup"
  | "deposit"
  | "withdraw"
  | "instant-open"
  | "instant-close"
  | "close-all"
  | "tpsl"
  | "cancel-limit"
  | "cancel-close";

/**
 * Flows grouped by what they act on: setup gets the account into a state where
 * anything else can run, collateral moves in and out of a subaccount, position
 * flows act on an open position, and cancel flows retract a request that has
 * not settled yet. The split is the only grouping cue the switcher needs.
 */
const SETUP_FLOWS: readonly SegmentedOption<Tab>[] = [{ value: "setup", label: "Setup" }];

const COLLATERAL_FLOWS: readonly SegmentedOption<Tab>[] = [
  { value: "deposit", label: "Deposit" },
  { value: "withdraw", label: "Withdraw" },
];

const POSITION_FLOWS: readonly SegmentedOption<Tab>[] = [
  { value: "instant-open", label: "Instant Open" },
  { value: "instant-close", label: "Instant Close" },
  { value: "close-all", label: "Close All" },
  { value: "tpsl", label: "TP/SL" },
];

const CANCEL_FLOWS: readonly SegmentedOption<Tab>[] = [
  { value: "cancel-limit", label: "Cancel Limit" },
  { value: "cancel-close", label: "Cancel Close" },
];

/**
 * Integration console for the SYMMIO React SDK: setup, then product-grade flows
 * — deposit, withdraw, instant open, instant close, close all, TP/SL, and (on
 * solvers that support LIMIT orders) cancel limit and cancel close — built
 * entirely from `@symmio/trading-react` hooks. Setup comes first because every
 * other flow presumes its outcome: a funded sub-account, and whatever the
 * chosen dispatch mode needs on top of it. Each flow walks Connect → Select
 * subaccount → Act, with navigable steps and data loaded in the step that needs
 * it. The console sizes itself from its own container so it stays usable while
 * the magic sidebar is docked beside it.
 */
export function IntegrationPanel() {
  const { address, chainId, isConnected, isOnExpectedChain } = useWalletAccount();
  const { addresses } = useSymmioConfig().getChainConfig();
  const balance = useCollateralBalance({ owner: address });
  const subAccountsQuery = useUserSubAccounts({ user: address });

  const [tab, setTab] = useState<Tab>("setup");
  const [subAccount, setSubAccount] = useState<Address>();

  const subAccountName = useMemo(
    () => subAccountsQuery.data?.find((sub) => sub.accountAddress === subAccount)?.name || undefined,
    [subAccountsQuery.data, subAccount],
  );

  const ready = isConnected && isOnExpectedChain;

  /** The cancel track is only offered on solvers that support LIMIT orders (majors / rasa). */
  const supportsLimit = useSupportsLimitOrder();
  const flowGroups = useMemo(
    () =>
      supportsLimit
        ? [SETUP_FLOWS, COLLATERAL_FLOWS, POSITION_FLOWS, CANCEL_FLOWS]
        : [SETUP_FLOWS, COLLATERAL_FLOWS, POSITION_FLOWS],
    [supportsLimit],
  );

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
          title="From setup to close"
          description="Start at Setup to get an account ready — with a gasless relayer, with a session key, or with neither — then run the production flows: fund a subaccount, open and close instantly, set TP/SL, cancel a resting request, exit everything at once. All composed from @symmio/trading-react hooks, on the same surface a third-party integrator builds on."
        />

        <Card
          className="animate-enter-up gap-6 p-4 @xl/console:p-6 @3xl/console:p-8"
          style={{ "--enter-delay": "80ms" } as CSSProperties}
        >
          <Segmented
            aria-label="Set up an account, move collateral, or open, close, and cancel positions"
            groups={flowGroups}
            value={tab}
            onChange={setTab}
          />

          <div className="min-h-96">
            {tab === "setup" ? (
              <SetupFlow
                owner={address}
                subAccount={subAccount}
                subAccountName={subAccountName}
                onSelectSubAccount={setSubAccount}
                decimals={addresses.collateralDecimals}
                balance={balance}
                ready={ready}
                onStartTrading={() => setTab("instant-open")}
              />
            ) : tab === "deposit" ? (
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
            ) : tab === "tpsl" ? (
              <TpSlFlow
                owner={address}
                subAccount={subAccount}
                subAccountName={subAccountName}
                onSelectSubAccount={setSubAccount}
                ready={ready}
              />
            ) : tab === "cancel-limit" ? (
              <CancelLimitFlow
                owner={address}
                subAccount={subAccount}
                subAccountName={subAccountName}
                onSelectSubAccount={setSubAccount}
                ready={ready}
              />
            ) : (
              <CancelCloseFlow
                owner={address}
                subAccount={subAccount}
                subAccountName={subAccountName}
                onSelectSubAccount={setSubAccount}
                ready={ready}
              />
            )}
          </div>
        </Card>
      </section>
    </div>
  );
}
