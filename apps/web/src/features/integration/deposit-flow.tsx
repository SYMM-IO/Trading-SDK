"use client";

import { ResultError, ResultNote, ResultSuccess } from "@/components/result";
import { TxReceipt } from "@/components/tx-result";
import { formatUsd } from "@/lib/format";
import {
  useAccountBalanceInfo,
  useAccountBalanceOf,
  useApproveCollateral,
  useCollateralAllowance,
  useDeposit,
  useDepositAndAllocate,
  type UseCollateralBalanceReturnType,
} from "@symmio/trading-react";
import { Button } from "@symmio/ui/components/button";
import { Spinner } from "@symmio/ui/components/spinner";
import { Switch } from "@symmio/ui/components/switch";
import { shortenAddress } from "@symmio/utils";
import { useEffect, useState } from "react";
import { maxUint256, type Address } from "viem";
import { WalletPanel } from "../inspector/wallet-panel";
import { AmountField } from "./amount-field";
import { FlowRail, type FlowStep } from "./flow-rail";
import { parseAmount } from "./parse-amount";
import { SubaccountStep } from "./subaccount-step";

interface Props {
  owner?: Address;
  subAccount?: Address;
  subAccountName?: string;
  onSelectSubAccount: (account: Address) => void;
  decimals: number;
  balance: UseCollateralBalanceReturnType;
  /** Connected and on the expected chain. */
  ready: boolean;
}

/**
 * Deposit wizard: Connect → Select subaccount → Deposit. Steps are navigable via
 * the rail (click a reached step to go back); the subaccount list loads in its
 * own step. The deposit step auto-detects whether an approval is still needed and
 * flips its action between Approve and Deposit.
 */
export function DepositFlow({
  owner,
  subAccount,
  subAccountName,
  onSelectSubAccount,
  decimals,
  balance,
  ready,
}: Props) {
  const [step, setStep] = useState(0);
  const [amount, setAmount] = useState<string>("");
  const [allocate, setAllocate] = useState<boolean>(false);

  const allowance = useCollateralAllowance({ owner });
  const approve = useApproveCollateral();
  const deposit = useDeposit();
  const depositAndAllocate = useDepositAndAllocate();
  const activeDeposit = allocate ? depositAndAllocate : deposit;

  // Resulting subaccount balance, per mode: a plain deposit lands in the
  // AVAILABLE balance (`balanceOf`); "allocate to margin" lands in the ALLOCATED
  // balance (`balanceInfo.allocatedBalance`). Both refetch after the deposit
  // settles (the mutation invalidates them), so the shown value updates to the new balance.
  const availableBalance = useAccountBalanceOf({ account: subAccount, query: { enabled: !allocate } });
  const marginBalance = useAccountBalanceInfo({ account: subAccount, query: { enabled: allocate } });

  const parsed = parseAmount(amount, decimals);
  const needsApproval = parsed !== undefined && (allowance.data ?? 0n) < parsed;
  const busy = approve.isPending || activeDeposit.isPending;

  const maxStep = !ready ? 0 : !subAccount ? 1 : 2;
  const current = Math.min(step, maxStep);

  /** Unlock and move forward to the furthest reachable step as prerequisites complete. */
  useEffect(() => {
    setStep((previous) => Math.max(previous, maxStep));
  }, [maxStep]);

  /** Clear stale approve/deposit results whenever the inputs that produced them change. */
  function resetActions() {
    approve.reset();
    deposit.reset();
    depositAndAllocate.reset();
  }

  function onPrimary() {
    if (!subAccount || parsed === undefined) return;
    if (needsApproval) {
      approve.mutate({ amount: maxUint256 });
      return;
    }
    activeDeposit.mutate({ account: subAccount, amount: parsed });
  }

  const steps: FlowStep[] = [
    { label: "Connect wallet", hint: ready && owner ? shortenAddress(owner) : "Connect your wallet", done: ready },
    {
      label: "Select subaccount",
      hint: subAccount ? (subAccountName ?? shortenAddress(subAccount)) : "Choose where to deposit",
      done: Boolean(subAccount),
    },
    {
      label: "Deposit",
      hint: needsApproval ? "Approval needed first" : parsed !== undefined ? "Ready to deposit" : "Enter an amount",
      done: activeDeposit.isSuccess,
    },
  ];

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_220px]">
      <div className="flex min-h-60 flex-col gap-5">
        {current === 0 ? (
          <WalletPanel />
        ) : current === 1 ? (
          <SubaccountStep
            owner={owner}
            selected={subAccount}
            onSelect={(account) => {
              onSelectSubAccount(account);
              resetActions();
              setStep(2);
            }}
          />
        ) : (
          <>
            <AmountField
              id="integration-deposit-amount"
              testId="integration-deposit-amount"
              label="Amount to deposit"
              value={amount}
              onChange={(next) => {
                setAmount(next);
                resetActions();
              }}
              decimals={decimals}
              max={balance.data}
              maxLabel="in wallet"
              invalid={amount.length > 0 && parsed === undefined}
            />

            <label className="border-border/60 bg-muted/30 flex items-center justify-between gap-4 rounded-xl border px-4 py-3">
              <span className="flex flex-col">
                <span className="text-foreground text-sm font-medium">Allocate to margin</span>
                <span className="text-muted-foreground text-xs leading-5">
                  Deposit straight into trading margin instead of the available balance.
                </span>
              </span>
              <Switch
                checked={allocate}
                onCheckedChange={(next) => {
                  setAllocate(next);
                  resetActions();
                }}
                data-testid="toggle-allocate"
              />
            </label>

            <Button
              type="button"
              size="lg"
              disabled={parsed === undefined || busy}
              onClick={onPrimary}
              data-testid="button-deposit-primary"
              className="w-full"
            >
              {busy ? <Spinner className="size-4" /> : null}
              {parsed === undefined
                ? "Enter an amount"
                : needsApproval
                  ? "Approve USDC"
                  : allocate
                    ? "Deposit & allocate"
                    : "Deposit"}
            </Button>

            <StatusArea approve={approve} deposit={activeDeposit} approved={!needsApproval && parsed !== undefined} />

            {subAccount ? (
              <div className="border-border/60 bg-muted/20 flex items-center justify-between rounded-lg border px-4 py-2.5 text-sm">
                <span className="text-muted-foreground">
                  {allocate ? "Subaccount margin (allocated) balance" : "Subaccount available balance"}
                </span>
                <span className="text-foreground font-mono" data-testid="integration-deposit-subaccount-balance">
                  {allocate
                    ? marginBalance.data
                      ? formatUsd(marginBalance.data.allocatedBalance)
                      : "—"
                    : availableBalance.data !== undefined
                      ? formatUsd(availableBalance.data)
                      : "—"}
                </span>
              </div>
            ) : null}
          </>
        )}
      </div>

      <div className="lg:border-border/50 lg:border-l lg:pl-8">
        <FlowRail steps={steps} current={current} maxReachable={maxStep} onStepClick={setStep} />
      </div>
    </div>
  );
}

function StatusArea({
  approve,
  deposit,
  approved,
}: {
  approve: ReturnType<typeof useApproveCollateral>;
  deposit: ReturnType<typeof useDeposit>;
  approved: boolean;
}) {
  if (approve.isPending) {
    return (
      <ResultNote testId="integration-deposit-status" loading>
        Approving USDC… confirm in your wallet.
      </ResultNote>
    );
  }
  if (approve.error) {
    return (
      <ResultError testId="integration-deposit-status" kind={approve.error.kind} message={approve.error.message} />
    );
  }
  if (deposit.isPending) {
    return (
      <ResultNote testId="integration-deposit-status" loading>
        Submitting deposit… confirm in your wallet, then waiting for the receipt.
      </ResultNote>
    );
  }
  if (deposit.error) {
    return (
      <ResultError testId="integration-deposit-status" kind={deposit.error.kind} message={deposit.error.message} />
    );
  }
  if (deposit.isSuccess) {
    return (
      <ResultSuccess testId="integration-deposit-status">
        <span className="text-foreground">Deposit confirmed.</span>
        <TxReceipt
          hash={deposit.data.hash}
          receipt={
            deposit.data.receipt
              ? { blockNumber: deposit.data.receipt.blockNumber, status: String(deposit.data.receipt.status) }
              : undefined
          }
        />
      </ResultSuccess>
    );
  }
  if (approve.isSuccess && approved) {
    return <ResultNote testId="integration-deposit-status">Approved — you can deposit now.</ResultNote>;
  }
  return null;
}
