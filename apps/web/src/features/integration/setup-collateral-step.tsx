"use client";

import { ResultError, ResultNote, ResultSuccess } from "@/components/result";
import { TxReceipt } from "@/components/tx-result";
import { formatUsd } from "@/lib/format";
import {
  SubAccountIsolationType,
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
import { useEffect, useState } from "react";
import { maxUint256, type Address } from "viem";
import { AmountField } from "./amount-field";
import { parseAmount } from "./parse-amount";

interface Props {
  owner?: Address;
  subAccount: Address;
  /** Isolation type of the selected sub-account — decides which balance its trades spend. */
  isolationType?: SubAccountIsolationType;
  decimals: number;
  /** The connected wallet's collateral balance, hoisted so the rail and this step agree. */
  walletBalance: UseCollateralBalanceReturnType;
}

/**
 * Move collateral from the wallet into the chosen sub-account: approve the core
 * once, then deposit.
 *
 * Collateral is a prerequisite for everything that follows, not just for
 * trading — the relayer's operational fee is drawn from this sub-account's
 * SYMMIO balance, so a gasless or session-key setup whose account is empty
 * fails at the first relayed write with `OperationalFee: Insufficient balance`,
 * and no allowance can fix that.
 *
 * A cross-margin (`CUSTOM`) sub-account spends its **allocated** balance, so
 * the step allocates by default for one; the VA isolations trade from the
 * available balance and do not.
 */
export function SetupCollateralStep({ owner, subAccount, isolationType, decimals, walletBalance }: Props) {
  const isCrossMargin = isolationType === SubAccountIsolationType.CUSTOM;
  const [amount, setAmount] = useState("");
  const [allocate, setAllocate] = useState(isCrossMargin);

  /** Follow the selected account's isolation type until the user overrides the switch. */
  useEffect(() => {
    setAllocate(isCrossMargin);
  }, [isCrossMargin]);

  const allowance = useCollateralAllowance({ owner });
  const approve = useApproveCollateral();
  const deposit = useDeposit();
  const depositAndAllocate = useDepositAndAllocate();
  const activeDeposit = allocate ? depositAndAllocate : deposit;

  const available = useAccountBalanceOf({ account: subAccount });
  const balanceInfo = useAccountBalanceInfo({ account: subAccount });

  const parsed = parseAmount(amount, decimals);
  const needsApproval = parsed !== undefined && (allowance.data ?? 0n) < parsed;
  const busy = approve.isPending || activeDeposit.isPending;

  function resetActions() {
    approve.reset();
    deposit.reset();
    depositAndAllocate.reset();
  }

  function onPrimary() {
    if (parsed === undefined) return;
    if (needsApproval) {
      approve.mutate({ amount: maxUint256 });
      return;
    }
    activeDeposit.mutate({ account: subAccount, amount: parsed });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="border-border/60 bg-muted/20 grid gap-2 rounded-xl border px-4 py-3 @lg/console:grid-cols-2">
        <BalanceReadout
          label="Available balance"
          value={available.data}
          testId="setup-collateral-available"
          emphasis={!isCrossMargin}
        />
        <BalanceReadout
          label="Allocated to margin"
          value={balanceInfo.data?.allocatedBalance}
          testId="setup-collateral-allocated"
          emphasis={isCrossMargin}
        />
      </div>

      <AmountField
        id="setup-collateral-amount"
        testId="setup-collateral-amount"
        label="Amount to deposit"
        value={amount}
        onChange={(next) => {
          setAmount(next);
          resetActions();
        }}
        decimals={decimals}
        max={walletBalance.data}
        maxLabel="in wallet"
        invalid={amount.length > 0 && parsed === undefined}
      />

      <label className="border-border/60 bg-muted/30 flex items-center justify-between gap-4 rounded-xl border px-4 py-3">
        <span className="flex flex-col">
          <span className="text-foreground text-sm font-medium">Allocate to margin</span>
          <span className="text-muted-foreground text-xs leading-5">
            {isCrossMargin
              ? "This sub-account is cross-margin, so its trades spend the allocated balance. Leave this on."
              : "Deposit straight into trading margin instead of the available balance."}
          </span>
        </span>
        <Switch
          checked={allocate}
          onCheckedChange={(next) => {
            setAllocate(next);
            resetActions();
          }}
          data-testid="toggle-setup-collateral-allocate"
        />
      </label>

      <Button
        type="button"
        size="lg"
        className="w-full"
        disabled={parsed === undefined || busy}
        onClick={onPrimary}
        data-testid="button-setup-collateral-primary"
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
    </div>
  );
}

/** One of the two balances that decide whether this step is done. */
function BalanceReadout({
  label,
  value,
  testId,
  emphasis,
}: {
  label: string;
  value?: bigint;
  testId: string;
  /** The balance this sub-account's trades actually spend. */
  emphasis: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-muted-foreground text-xs">
        {label}
        {emphasis ? " · spent by trades" : ""}
      </span>
      <span className="text-foreground font-mono text-sm" data-testid={testId}>
        {value !== undefined ? formatUsd(value) : "—"}
      </span>
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
      <ResultNote testId="setup-collateral-status" loading>
        Approving USDC… confirm in your wallet.
      </ResultNote>
    );
  }
  if (approve.error) {
    return <ResultError testId="setup-collateral-status" kind={approve.error.kind} message={approve.error.message} />;
  }
  if (deposit.isPending) {
    return (
      <ResultNote testId="setup-collateral-status" loading>
        Submitting deposit… confirm in your wallet, then waiting for the receipt.
      </ResultNote>
    );
  }
  if (deposit.error) {
    return <ResultError testId="setup-collateral-status" kind={deposit.error.kind} message={deposit.error.message} />;
  }
  if (deposit.isSuccess) {
    return (
      <ResultSuccess testId="setup-collateral-status">
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
    return <ResultNote testId="setup-collateral-status">Approved — you can deposit now.</ResultNote>;
  }
  return null;
}
