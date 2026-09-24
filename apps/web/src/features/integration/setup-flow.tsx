"use client";

import { WalletPanel } from "@/features/inspector/wallet-panel";
import { useSessionKey } from "@/features/session-keys/use-session-key";
import { useSessionKeyDelegation } from "@/features/session-keys/use-session-key-delegation";
import { formatUsd } from "@/lib/format";
import {
  useAccountBalanceInfo,
  useAccountBalanceOf,
  useOperationalFeeAllowance,
  useSupportsGaslessService,
  useUserSubAccounts,
  type UseCollateralBalanceReturnType,
} from "@symmio/trading-react";
import { shortenAddress } from "@symmio/utils";
import { useCallback, useEffect, useMemo, useState } from "react";
import { zeroAddress, type Address } from "viem";
import { FlowLayout } from "./flow-layout";
import type { FlowStep } from "./flow-rail";
import { SetupAccountStep } from "./setup-account-step";
import { SetupCollateralStep } from "./setup-collateral-step";
import { SetupDelegationStep } from "./setup-delegation-step";
import { formatFeeBudget, SetupFeeAllowanceStep } from "./setup-fee-allowance-step";
import { SetupReadyStep } from "./setup-ready-step";
import { SetupSessionKeyStep } from "./setup-session-key-step";
import { getSetupStepIds, SETUP_STEP_LABELS, SETUP_TRACKS, type SetupStepId, type SetupTrack } from "./setup-track";
import { SetupTrackPicker } from "./setup-track-picker";
import { useNativeBalance } from "./use-native-balance";

interface Props {
  owner?: Address;
  subAccount?: Address;
  subAccountName?: string;
  onSelectSubAccount: (account: Address) => void;
  decimals: number;
  /** The connected wallet's collateral balance, shared with the other flows. */
  balance: UseCollateralBalanceReturnType;
  /** Connected and on the expected chain. */
  ready: boolean;
  /** Leave setup for the trading flows. */
  onStartTrading: () => void;
}

/**
 * Setup wizard: everything that has to be true before the other flows work,
 * arranged as the ladder the contracts actually impose.
 *
 * The three tracks are cumulative rather than alternative — gasless is the
 * wallet track plus a fee allowance, and a session key is gasless plus a
 * delegation — so switching tracks never discards finished work and the picker
 * can carry progress across all three. Completion is read from chain state on
 * every step (an allowance, a balance, a live delegation), never from a click
 * counter, so a wallet that was provisioned in another session or another tab
 * arrives here already done.
 */
export function SetupFlow({
  owner,
  subAccount,
  subAccountName,
  onSelectSubAccount,
  decimals,
  balance,
  ready,
  onStartTrading,
}: Props) {
  const relayerAvailable = useSupportsGaslessService();
  const [chosenTrack, setChosenTrack] = useState<SetupTrack>();
  const [step, setStep] = useState(0);
  const [withdraw, setWithdraw] = useState(false);

  /**
   * The relayer tracks are unreachable without a relayer, so a chain switch can
   * invalidate a choice that was legal when it was made.
   */
  const requested = chosenTrack ?? (relayerAvailable ? "session-key" : "wallet");
  const track: SetupTrack = !relayerAvailable && requested !== "wallet" ? "wallet" : requested;

  const subAccounts = useUserSubAccounts({ user: owner });
  const accounts = useMemo(() => subAccounts.data ?? [], [subAccounts.data]);
  const isolationType = accounts.find((sub) => sub.accountAddress === subAccount)?.isolationType;

  /**
   * A wallet that has exactly one sub-account has no choice to make, and the
   * cold start always lands exactly one — so selecting it here is what lets the
   * settlement carry the wizard straight into the collateral step.
   */
  useEffect(() => {
    const only = accounts.length === 1 ? accounts[0]?.accountAddress : undefined;
    if (!subAccount && only) onSelectSubAccount(only);
  }, [accounts, subAccount, onSelectSubAccount]);

  const nativeBalance = useNativeBalance(owner);
  const available = useAccountBalanceOf({ account: subAccount });
  const balanceInfo = useAccountBalanceInfo({ account: subAccount });
  const allowance = useOperationalFeeAllowance({
    payer: subAccount ?? zeroAddress,
    query: { enabled: Boolean(subAccount) && relayerAvailable },
  });

  const { sessionKeyAddress, state, metadata } = useSessionKey();
  const sessionKeyReady = Boolean(sessionKeyAddress && state.isReady);
  const delegation = useSessionKeyDelegation({
    subAccount,
    sessionKey: sessionKeyAddress ?? undefined,
    sessionKeyExpiresAtMs: metadata?.expiresAt ?? state.expiresAt ?? undefined,
    withdraw,
  });

  const fundedBalance = (available.data ?? 0n) + (balanceInfo.data?.allocatedBalance ?? 0n);

  const done: Readonly<Record<SetupStepId, boolean>> = {
    connect: ready,
    account: Boolean(subAccount),
    collateral: fundedBalance > 0n,
    "fee-allowance": (allowance.data?.allowance ?? 0n) > 0n,
    "session-key": sessionKeyReady,
    delegation: delegation.isReady,
    /** The terminus is reached, never "done" — nothing follows it to unlock. */
    ready: false,
  };

  const hints: Readonly<Record<SetupStepId, string>> = {
    connect: ready && owner ? shortenAddress(owner) : "Connect your wallet",
    account: subAccount ? (subAccountName ?? shortenAddress(subAccount)) : "Create or choose an account",
    collateral: fundedBalance > 0n ? `${formatUsd(fundedBalance)} USDC in the account` : "Fund the account",
    "fee-allowance": allowance.data
      ? `${formatFeeBudget(allowance.data.allowance)} budget`
      : "Let the relayer charge its fee",
    "session-key": sessionKeyAddress ? shortenAddress(sessionKeyAddress) : "No key in this browser",
    delegation: delegation.isReady
      ? "Granted"
      : `${delegation.missingSelectors.length} of ${delegation.requiredSelectors.length} missing`,
    ready: "Start trading",
  };

  const stepIds = getSetupStepIds(track);

  /**
   * A step is reachable once every step before it is done. The order is not
   * cosmetic — the relayer bills its fee to the sub-account's collateral against
   * a diamond-side allowance, so each rung genuinely needs the one below it.
   */
  const firstOpen = stepIds.findIndex((id) => !done[id]);
  const maxReachable = firstOpen === -1 ? stepIds.length - 1 : firstOpen;

  const current = Math.min(step, maxReachable);

  /** Unlock and move forward to the furthest reachable step as prerequisites complete. */
  useEffect(() => {
    setStep((previous) => Math.max(previous, maxReachable));
  }, [maxReachable]);

  /** Progress on every track at once, so the picker can show what switching would cost. */
  const completedByTrack = Object.fromEntries(
    SETUP_TRACKS.map((info) => [
      info.value,
      getSetupStepIds(info.value).filter((id) => id !== "ready" && done[id]).length,
    ]),
  ) as Record<SetupTrack, number>;

  const steps: FlowStep[] = stepIds.map((id) => ({
    label: SETUP_STEP_LABELS[id],
    hint: hints[id],
    done: done[id],
  }));

  const refetchAccounts = useCallback(() => {
    void subAccounts.refetch();
  }, [subAccounts]);

  const activeStep = stepIds[current];

  return (
    <div className="flex flex-col gap-6">
      <SetupTrackPicker
        value={track}
        onChange={(next) => {
          setChosenTrack(next);
          setStep(0);
        }}
        relayerAvailable={relayerAvailable}
        completedByTrack={completedByTrack}
      />

      <FlowLayout steps={steps} current={current} maxReachable={maxReachable} onStepClick={setStep}>
        {activeStep === "connect" ? (
          <WalletPanel />
        ) : activeStep === "account" ? (
          <SetupAccountStep
            owner={owner}
            selected={subAccount}
            onSelect={onSelectSubAccount}
            relayerAvailable={relayerAvailable}
            nativeBalance={nativeBalance.data}
            hasAccounts={accounts.length > 0}
            onSettled={refetchAccounts}
          />
        ) : activeStep === "collateral" && subAccount ? (
          <SetupCollateralStep
            owner={owner}
            subAccount={subAccount}
            isolationType={isolationType}
            decimals={decimals}
            walletBalance={balance}
          />
        ) : activeStep === "fee-allowance" && subAccount ? (
          <SetupFeeAllowanceStep subAccount={subAccount} allowance={allowance} nativeBalance={nativeBalance.data} />
        ) : activeStep === "session-key" ? (
          <SetupSessionKeyStep />
        ) : activeStep === "delegation" ? (
          <SetupDelegationStep
            delegation={delegation}
            withdraw={withdraw}
            onWithdrawChange={setWithdraw}
            hasSessionKey={sessionKeyReady}
          />
        ) : activeStep === "ready" ? (
          <SetupReadyStep
            track={track}
            complete={stepIds.every((id) => id === "ready" || done[id])}
            onStartTrading={onStartTrading}
          />
        ) : null}
      </FlowLayout>
    </div>
  );
}
