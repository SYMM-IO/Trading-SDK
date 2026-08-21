"use client";

import { Chips } from "@/components/chips";
import { Field } from "@/components/field";
import { Modal } from "@/components/modal";
import { Numeric, ReceiptRow } from "@/components/value";
import { BALANCE_DECIMALS, isCrossMargin, spendableMargin } from "@/features/accounts/account-math";
import type { FundingAccount } from "@/features/accounts/account-provider";
import { formatUsd, shortenAddress } from "@/lib/format";
import {
  useAccountBalanceOf,
  useSymmioConfig,
  useWalletAccount,
  useWithdraw,
  useWithdrawableTime,
} from "@symmio/trading-react";
import { useState } from "react";
import { parseAmount, rescale, toAmountInput } from "./amount";
import { GatedSubmit } from "./gated-submit";
import { PendingWithdraws } from "./pending-withdraws";
import { useWriteToast } from "./use-write-toast";
import { formatCountdown } from "./withdraw-status";

export interface WithdrawModalProps {
  account: FundingAccount;
  open: boolean;
  onClose: () => void;
}

const QUICK_PICKS = ["25%", "50%", "75%", "Max"] as const;

/**
 * Withdraw from one account, and manage the requests already in flight.
 *
 * `useWithdraw` is the high-level entry point: it reads the sub-account's
 * isolation type itself and picks the path — a cross-margin (`CUSTOM`) account
 * deallocates and initiates in one atomic transaction, while a VA-backed
 * (`MARKET` / `MARKET_DIRECTION`) account only opens the request. That choice
 * also decides which balance funds the withdrawal, which is why the `Max` here
 * is read from two different places.
 */
export function WithdrawModal({ account, open, onClose }: WithdrawModalProps) {
  const { deployment } = account;
  const config = useSymmioConfig();
  const { address } = useWalletAccount();
  const runWrite = useWriteToast();
  const [input, setInput] = useState("");

  const { collateralDecimals } = config.getChainConfig(deployment.chainId).addresses;

  const availableBalance = useAccountBalanceOf({
    account: account.address,
    chainId: deployment.chainId,
  });
  const withdrawableTime = useWithdrawableTime({
    user: account.address,
    chainId: deployment.chainId,
  });
  const withdraw = useWithdraw({ account: account.address, chainId: deployment.chainId });

  /* A cross-margin account withdraws out of its allocated balance (the SDK
     deallocates first); a VA-backed account withdraws out of the available
     balance the deposit credited. */
  const crossMargin = isCrossMargin(account);
  const source = crossMargin ? spendableMargin(account) : (availableBalance.data ?? 0n);
  const maxAmount = rescale(source, BALANCE_DECIMALS, collateralDecimals);

  const amount = parseAmount(input, collateralDecimals);
  const overBalance = amount !== undefined && amount > maxAmount;
  const isValid = amount !== undefined && amount > 0n && !overBalance && Boolean(address);

  const secondsLeft = withdrawableTime.data ? Number(withdrawableTime.data) - Math.floor(Date.now() / 1000) : 0;

  const onQuickPick = (pick: string) => {
    const fraction = pick === "Max" ? 100n : BigInt(pick.replace("%", ""));
    setInput(toAmountInput((maxAmount * fraction) / 100n, collateralDecimals));
  };

  const onWithdraw = () => {
    if (amount === undefined || !address) return;
    void runWrite(
      {
        pending: "Opening withdrawal…",
        success: "Withdrawal requested",
        body: "It becomes finalizable once the cooldown elapses.",
        tone: "warn",
      },
      async () => {
        const result = await withdraw.mutateAsync({ amount, receiver: address });
        setInput("");
        return result;
      },
    );
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow={`${deployment.label} · ${deployment.chainName}`}
      title="Withdraw"
      footer={
        <>
          <GatedSubmit
            deployment={deployment}
            label="Request withdrawal"
            onSubmit={onWithdraw}
            disabled={!isValid}
            loading={withdraw.isPending}
            size="lg"
            className="w-full"
          />
          <p className="text-center text-2xs text-fg-3">
            {secondsLeft > 0
              ? `Cooldown active — a withdrawal opened now matures ${formatCountdown(secondsLeft)}.`
              : "No cooldown outstanding — a withdrawal opened now can be finalized immediately."}
          </p>
        </>
      }
    >
      <Field
        label="Amount"
        inputMode="decimal"
        placeholder="0.00"
        value={input}
        invalid={overBalance}
        onChange={(event) => setInput(event.target.value)}
        adornment={<span className="font-mono text-sm text-fg-2">USDC</span>}
        hint={
          <>
            {crossMargin ? "FREE MARGIN" : "AVAILABLE"}{" "}
            <Numeric size="sm" tone="muted">
              {formatUsd(Number(maxAmount) / 10 ** collateralDecimals, { exact: true })}
            </Numeric>
          </>
        }
        footnote={
          overBalance
            ? "More than this account can release right now."
            : crossMargin
              ? "Cross-margin account — the SDK deallocates and opens the request in one transaction."
              : "VA-backed account — this opens the withdraw request against the available balance."
        }
      />

      <Chips options={QUICK_PICKS} onChange={onQuickPick} />

      <div className="flex flex-col divide-y divide-[var(--border-subtle)]">
        <ReceiptRow
          label="From"
          value={
            <span className="text-sm text-fg-1">
              {account.name} <span className="tnum text-2xs text-fg-3">{shortenAddress(account.address)}</span>
            </span>
          }
        />
        <ReceiptRow
          label="Receiver"
          value={<span className="tnum text-sm text-fg-1">{shortenAddress(address)}</span>}
        />
      </div>

      <PendingWithdraws account={account} collateralDecimals={collateralDecimals} />
    </Modal>
  );
}
