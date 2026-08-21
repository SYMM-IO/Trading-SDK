"use client";

import { Chips } from "@/components/chips";
import { Field } from "@/components/field";
import { Modal } from "@/components/modal";
import { Numeric, ReceiptRow } from "@/components/value";
import { BALANCE_DECIMALS } from "@/features/accounts/account-math";
import type { FundingAccount } from "@/features/accounts/account-provider";
import { formatUsd, fromWei, shortenAddress } from "@/lib/format";
import { useAccountBalanceOf, useAllocate } from "@symmio/trading-react";
import { useState } from "react";
import { parseAmount, toAmountInput } from "./amount";
import { GatedSubmit } from "./gated-submit";
import { useWriteToast } from "./use-write-toast";

export interface AllocateModalProps {
  account: FundingAccount;
  open: boolean;
  onClose: () => void;
}

const QUICK_PICKS = ["25%", "50%", "75%", "Max"] as const;

/**
 * Promote an idle deposit into a cross-margin account's tradeable pool.
 *
 * **This flow only makes sense for a cross-margin (`CUSTOM`) sub-account**, and
 * the account card only offers it for one. A cross-margin account trades out of
 * its *allocated* balance, so allocating is what makes a deposit usable.
 *
 * On a VA-isolated account it is the exact opposite: an instant open spends the
 * **available** balance, and `allocate` moves collateral out of it — a control
 * once labelled "Add margin" here that reliably made the ticket's ceiling
 * smaller. Topping up an isolated position is a different call entirely
 * (`useAddMargin` against the position's Virtual Account), which is why it lives
 * on the position row rather than on the account.
 *
 * Amounts are 18-decimal: AccountLayer balances are always 1e18-scaled,
 * whatever the collateral token's own decimals are.
 */
export function AllocateModal({ account, open, onClose }: AllocateModalProps) {
  const { deployment } = account;
  const runWrite = useWriteToast();
  const [input, setInput] = useState("");

  const availableBalance = useAccountBalanceOf({
    account: account.address,
    chainId: deployment.chainId,
  });
  const allocate = useAllocate();

  const available = availableBalance.data ?? 0n;
  const amount = parseAmount(input, BALANCE_DECIMALS);
  const overBalance = amount !== undefined && amount > available;
  const isValid = amount !== undefined && amount > 0n && !overBalance;

  const onQuickPick = (pick: string) => {
    const fraction = pick === "Max" ? 100n : BigInt(pick.replace("%", ""));
    setInput(toAmountInput((available * fraction) / 100n, BALANCE_DECIMALS));
  };

  const onAllocate = () => {
    if (amount === undefined) return;
    void runWrite({ pending: "Allocating…", success: "Collateral allocated" }, async () => {
      const result = await allocate.mutateAsync({
        account: account.address,
        amount,
        chainId: deployment.chainId,
      });
      setInput("");
      onClose();
      return result;
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow={`${deployment.label} · ${account.name}`}
      title="Allocate collateral"
      footer={
        <GatedSubmit
          deployment={deployment}
          label="Allocate to margin"
          onSubmit={onAllocate}
          disabled={!isValid}
          loading={allocate.isPending}
          size="lg"
          className="w-full"
        />
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
          availableBalance.isLoading ? (
            "Loading…"
          ) : (
            <>
              IDLE{" "}
              <Numeric size="sm" tone="muted">
                {formatUsd(fromWei(available), { exact: true })}
              </Numeric>
            </>
          )
        }
        footnote={
          overBalance
            ? "More than this account has sitting idle."
            : "Moves deposited-but-unallocated collateral into the cross-margin pool positions draw on."
        }
      />

      <Chips options={QUICK_PICKS} onChange={onQuickPick} />

      <div className="flex flex-col divide-y divide-[var(--border-subtle)]">
        <ReceiptRow
          label="Account"
          value={
            <span className="text-sm text-fg-1">
              {account.name} <span className="tnum text-2xs text-fg-3">{shortenAddress(account.address)}</span>
            </span>
          }
        />
        <ReceiptRow
          label="Allocated now"
          value={
            <Numeric size="sm" tone="strong">
              {formatUsd(fromWei(account.balance?.allocatedBalance), { exact: true })}
            </Numeric>
          }
        />
      </div>
    </Modal>
  );
}
