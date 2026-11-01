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
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import type { Address } from "viem";
import { CancelCloseFlow } from "./cancel-close-flow";
import { CancelLimitFlow } from "./cancel-limit-flow";
import { CloseAllFlow } from "./close-all-flow";
import { DepositFlow } from "./deposit-flow";
import { InstantCloseFlow } from "./instant-close-flow";
import { InstantOpenFlow } from "./instant-open-flow";
import {
  flowSearchEntryId,
  INTEGRATION_CONSOLE_ID,
  INTEGRATION_FLOW_GROUPS,
  toIntegrationFlowId,
  type IntegrationFlowId,
  type IntegrationFlowMeta,
} from "./integration-flows";
import { Segmented, type SegmentedOption } from "./segmented";
import { SetupFlow } from "./setup-flow";
import { TpSlFlow } from "./tpsl-flow";
import { WithdrawFlow } from "./withdraw-flow";

/** A flow group as switcher options. Grouping and labels live in {@link INTEGRATION_FLOW_GROUPS}, which search reads too. */
function toOptions(flows: readonly IntegrationFlowMeta[]): readonly SegmentedOption<IntegrationFlowId>[] {
  return flows.map((flow) => ({ value: flow.id, label: flow.label }));
}

const SETUP_FLOWS = toOptions(INTEGRATION_FLOW_GROUPS.setup);
const COLLATERAL_FLOWS = toOptions(INTEGRATION_FLOW_GROUPS.collateral);
const POSITION_FLOWS = toOptions(INTEGRATION_FLOW_GROUPS.position);
const CANCEL_FLOWS = toOptions(INTEGRATION_FLOW_GROUPS.cancel);

/**
 * Follows the `?flow=` query, so a link or a search hit can open the console on a
 * given flow. Its own Suspense boundary keeps `useSearchParams` from opting the
 * rest of the page out of static rendering.
 */
function FlowFromUrl({ onFlow }: { onFlow: (flow: IntegrationFlowId) => void }) {
  const flow = toIntegrationFlowId(useSearchParams().get("flow"));

  useEffect(() => {
    if (flow) onFlow(flow);
  }, [flow, onFlow]);

  return null;
}

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

  const [tab, setTab] = useState<IntegrationFlowId>("setup");
  const [subAccount, setSubAccount] = useState<Address>();

  /**
   * Switch flows and keep `?flow=` in step, so the address bar always names the
   * open flow — and a search hit for the flow already showing is never a no-op
   * against a stale query. `replaceState` updates `useSearchParams` without a
   * navigation.
   */
  const selectFlow = useCallback((flow: IntegrationFlowId) => {
    setTab(flow);
    const url = new URL(window.location.href);
    url.searchParams.set("flow", flow);
    window.history.replaceState(null, "", url);
  }, []);

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
  /** A flow this solver does not offer (a cancel flow named in a link, say) falls back to Setup. */
  const activeTab = flowGroups.some((group) => group.some((option) => option.value === tab)) ? tab : "setup";

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

        <Suspense fallback={null}>
          <FlowFromUrl onFlow={setTab} />
        </Suspense>

        <Card
          id={INTEGRATION_CONSOLE_ID}
          data-search-entries={flowGroups
            .flatMap((group) => group.map((option) => flowSearchEntryId(option.value)))
            .join(" ")}
          className="animate-enter-up scroll-mt-24 gap-6 p-4 @xl/console:p-6 @3xl/console:p-8"
          style={{ "--enter-delay": "80ms" } as CSSProperties}
        >
          <Segmented
            aria-label="Set up an account, move collateral, or open, close, and cancel positions"
            groups={flowGroups}
            value={activeTab}
            onChange={selectFlow}
          />

          <div className="min-h-96">
            {activeTab === "setup" ? (
              <SetupFlow
                owner={address}
                subAccount={subAccount}
                subAccountName={subAccountName}
                onSelectSubAccount={setSubAccount}
                decimals={addresses.collateralDecimals}
                balance={balance}
                ready={ready}
                onStartTrading={() => selectFlow("instant-open")}
              />
            ) : activeTab === "deposit" ? (
              <DepositFlow
                owner={address}
                subAccount={subAccount}
                subAccountName={subAccountName}
                onSelectSubAccount={setSubAccount}
                decimals={addresses.collateralDecimals}
                balance={balance}
                ready={ready}
              />
            ) : activeTab === "withdraw" ? (
              <WithdrawFlow
                owner={address}
                subAccount={subAccount}
                subAccountName={subAccountName}
                onSelectSubAccount={setSubAccount}
                decimals={addresses.collateralDecimals}
                chainId={chainId}
                ready={ready}
              />
            ) : activeTab === "instant-open" ? (
              <InstantOpenFlow
                owner={address}
                subAccount={subAccount}
                subAccountName={subAccountName}
                onSelectSubAccount={setSubAccount}
                ready={ready}
              />
            ) : activeTab === "instant-close" ? (
              <InstantCloseFlow
                owner={address}
                subAccount={subAccount}
                subAccountName={subAccountName}
                onSelectSubAccount={setSubAccount}
                ready={ready}
              />
            ) : activeTab === "close-all" ? (
              <CloseAllFlow
                owner={address}
                subAccount={subAccount}
                subAccountName={subAccountName}
                onSelectSubAccount={setSubAccount}
                ready={ready}
              />
            ) : activeTab === "tpsl" ? (
              <TpSlFlow
                owner={address}
                subAccount={subAccount}
                subAccountName={subAccountName}
                onSelectSubAccount={setSubAccount}
                ready={ready}
              />
            ) : activeTab === "cancel-limit" ? (
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
