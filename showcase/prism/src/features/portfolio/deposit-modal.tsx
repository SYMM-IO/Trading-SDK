"use client";

import { Chips } from "@/components/chips";
import { Field } from "@/components/field";
import { Modal } from "@/components/modal";
import { Numeric, ReceiptRow } from "@/components/value";
import { isCrossMargin } from "@/features/accounts/account-math";
import type { FundingAccount } from "@/features/accounts/account-provider";
import { formatUsd, shortenAddress } from "@/lib/format";
import {
  useApproveCollateral,
  useCollateralAllowance,
  useCollateralBalance,
  useDeposit,
  useDepositAndAllocate,
  useSymmioConfig,
  useWalletAccount,
} from "@symmio/trading-react";
import { useState } from "react";
import { parseAmount, toAmountInput } from "./amount";
import { FlowStep } from "./flow-step";
import { GatedSubmit } from "./gated-submit";
import { useWriteToast } from "./use-write-toast";

export interface DepositModalProps {
  account: FundingAccount;
  open: boolean;
  onClose: () => void;
}

const QUICK_PICKS = ["25%", "50%", "75%", "Max"] as const;

/**
 * Fund one account: ERC20 approve, then the deposit its margin model can spend.
 *
 * **Which deposit depends on the account's isolation type, and getting it wrong
 * strands the money.** SYMMIO keeps deposited collateral in two places:
 *
 * - A **cross-margin** (`CUSTOM`) account trades out of its *allocated* pool, so
 *   `depositAndAllocateForAccount` is right — one transaction, immediately
 *   tradeable.
 * - A **VA-isolated** account trades out of its *available* balance, and
 *   allocating moves collateral out of exactly that. Depositing-and-allocating
 *   into one, as this modal used to do for every account, produced a deposit the
 *   portfolio reported as full equity while the ticket read `AVAIL $0.00` — and
 *   which this app had no flow to move back, because its withdraw path draws on
 *   the available balance too.
 *
 * The approval leg is the same either way, and its spender is the SYMMIO core
 * rather than the AccountLayer — which is what `useApproveCollateral` already
 * targets.
 */
export function DepositModal({ account, open, onClose }: DepositModalProps) {
  const { deployment } = account;
  const config = useSymmioConfig();
  const { address } = useWalletAccount();
  const runWrite = useWriteToast();
  const [input, setInput] = useState("");

  const { collateralDecimals } = config.getChainConfig(deployment.chainId).addresses;

  const walletBalance = useCollateralBalance({ owner: address, chainId: deployment.chainId });
  const allowance = useCollateralAllowance({ owner: address, chainId: deployment.chainId });
  const approve = useApproveCollateral();
  const crossMargin = isCrossMargin(account);
  const depositOnly = useDeposit();
  const depositAndAllocate = useDepositAndAllocate();
  const deposit = crossMargin ? depositAndAllocate : depositOnly;

  const amount = parseAmount(input, collateralDecimals);
  const available = walletBalance.data ?? 0n;
  const approved = allowance.data ?? 0n;

  const overBalance = amount !== undefined && amount > available;
  const isValid = amount !== undefined && amount > 0n && !overBalance;
  /* An empty field is not "needs approval": showing step 1 active before the
     user has typed anything made the flow look like it had already begun. */
  const needsApproval = amount !== undefined && approved < amount;

  const submitting = approve.isPending || depositOnly.isPending || depositAndAllocate.isPending;

  const onQuickPick = (pick: string) => {
    const fraction = pick === "Max" ? 100n : BigInt(pick.replace("%", ""));
    setInput(toAmountInput((available * fraction) / 100n, collateralDecimals));
  };

  const onApprove = () => {
    if (amount === undefined) return;
    void runWrite({ pending: "Approving collateral…", success: "Collateral approved" }, () =>
      approve.mutateAsync({ amount, chainId: deployment.chainId }),
    );
  };

  const onDeposit = () => {
    if (amount === undefined) return;
    void runWrite(
      {
        pending: `Depositing to ${account.name}…`,
        success: "Deposit confirmed",
        body: `${formatUsd(Number(amount) / 10 ** collateralDecimals, { exact: true })} ${crossMargin ? "allocated" : "available"} on ${deployment.chainName}.`,
      },
      async () => {
        const result = await deposit.mutateAsync({
          account: account.address,
          amount,
          chainId: deployment.chainId,
        });
        setInput("");
        onClose();
        return result;
      },
    );
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow={`${deployment.label} · ${deployment.chainName}`}
      title="Deposit"
      footer={
        <>
          <GatedSubmit
            deployment={deployment}
            label={needsApproval ? "Approve collateral" : crossMargin ? "Deposit & allocate" : "Deposit"}
            onSubmit={needsApproval ? onApprove : onDeposit}
            disabled={!isValid}
            loading={submitting}
            size="lg"
            className="w-full"
          />
          <p className="text-center text-2xs text-fg-3">
            Funds land on {deployment.chainName} and stay inside the {deployment.label} group.
          </p>
        </>
      }
    >
      <div className="flex flex-col gap-2 rounded-md border border-line-subtle bg-bg-2 p-3">
        <FlowStep
          index={1}
          label="Approve collateral"
          state={needsApproval ? "active" : "done"}
          detail={`Allowance ${formatUsd(Number(approved) / 10 ** collateralDecimals, { exact: true })}`}
        />
        <FlowStep
          index={2}
          label={crossMargin ? "Deposit & allocate" : "Deposit"}
          state={needsApproval ? "idle" : "active"}
          detail={crossMargin ? "One transaction into the cross-margin pool" : "Credits the balance an order spends"}
        />
      </div>

      <Field
        label="Amount"
        inputMode="decimal"
        placeholder="0.00"
        value={input}
        invalid={overBalance}
        onChange={(event) => setInput(event.target.value)}
        adornment={<span className="font-mono text-sm text-fg-2">USDC</span>}
        hint={
          walletBalance.isLoading ? (
            "Loading…"
          ) : (
            <>
              WALLET{" "}
              <Numeric size="sm" tone="muted">
                {formatUsd(Number(available) / 10 ** collateralDecimals, { exact: true })}
              </Numeric>
            </>
          )
        }
        footnote={
          overBalance
            ? "More than the wallet holds on this chain."
            : `Collateral token has ${collateralDecimals} decimals — the SDK takes the raw amount.`
        }
      />

      <Chips options={QUICK_PICKS} onChange={onQuickPick} />

      <div className="flex flex-col divide-y divide-[var(--border-subtle)]">
        <ReceiptRow
          label="Destination"
          value={
            <span className="text-sm text-fg-1">
              {account.name} <span className="tnum text-2xs text-fg-3">{shortenAddress(account.address)}</span>
            </span>
          }
        />
        <ReceiptRow
          label="Credited to"
          value={
            <span className="text-sm text-fg-1">
              {crossMargin ? "Allocated (cross-margin) balance" : "Available balance — what an instant open spends"}
            </span>
          }
        />
      </div>
    </Modal>
  );
}
