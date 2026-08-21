"use client";

import { Chips } from "@/components/chips";
import { Field } from "@/components/field";
import { Modal } from "@/components/modal";
import { Segmented } from "@/components/segmented";
import { Numeric, ReceiptRow } from "@/components/value";
import type { Deployment } from "@/config/deployments";
import { BALANCE_DECIMALS } from "@/features/accounts/account-math";
import type { FundingAccount } from "@/features/accounts/account-provider";
import { parseAmount, toAmountInput } from "@/features/portfolio/amount";
import { GatedSubmit } from "@/features/portfolio/gated-submit";
import { useWriteToast } from "@/features/portfolio/use-write-toast";
import { formatUsd, fromWei, shortenAddress } from "@/lib/format";
import { useAccountBalanceInfo, useAccountBalanceOf, useAddMargin, useRemoveMargin } from "@symmio/trading-react";
import { useState } from "react";
import type { Address } from "viem";

const QUICK_PICKS = ["25%", "50%", "75%", "Max"] as const;

const MODES = [
  { value: "add" as const, label: "Add" },
  { value: "remove" as const, label: "Remove" },
];

export interface PositionMarginModalProps {
  /** The deployment the Virtual Account lives on. */
  deployment: Deployment;
  /** The parent sub-account collateral moves to and from. */
  account: FundingAccount;
  /** The Virtual Account this position lives in. */
  virtualAccount: Address;
  open: boolean;
  onClose: () => void;
}

/**
 * Top up or draw down the margin behind **one isolated position**, grouped or not.
 *
 * The unit is the Virtual Account, which is also why this takes one rather than
 * a row: under `MARKET_DIRECTION` isolation several quotes share a single VA, so
 * topping up "a position" tops up every quote folded into it at once. There is
 * no per-quote margin to move underneath that.
 *
 * This is the call the account card used to mislabel. `addMargin` moves
 * collateral from the parent sub-account's available balance into a specific
 * Virtual Account, so it belongs to a position, not to an account — there is no
 * VA to target from an account card, and the account-level `allocate` it reached
 * for instead moves collateral the *other* way on a VA-isolated account.
 *
 * `removeMargin` is the inverse and needs a fresh Muon uPnL attestation, which
 * the SDK fetches: a VA cannot release margin without proving what it is
 * currently worth.
 *
 * Amounts are 18-decimal — the internal allocated-balance unit, not the
 * collateral token's own decimals.
 */
export function PositionMarginModal({ deployment, account, virtualAccount, open, onClose }: PositionMarginModalProps) {
  const runWrite = useWriteToast();
  const [mode, setMode] = useState<"add" | "remove">("add");
  const [input, setInput] = useState("");

  const parentBalance = useAccountBalanceOf({
    account: account.address,
    chainId: deployment.chainId,
  });
  const vaBalance = useAccountBalanceInfo({ account: virtualAccount, chainId: deployment.chainId });

  const addMargin = useAddMargin();
  const removeMargin = useRemoveMargin();

  /* Adding draws on the parent's spendable balance; removing draws on what the
     VA holds beyond its locked legs. */
  const parentAvailable = parentBalance.data ?? 0n;
  const vaLocked = vaBalance.data
    ? vaBalance.data.lockedCVA + vaBalance.data.lockedLF + vaBalance.data.lockedPartyAMM
    : 0n;
  const vaFree = vaBalance.data ? maxZero(vaBalance.data.allocatedBalance - vaLocked) : 0n;
  const ceiling = mode === "add" ? parentAvailable : vaFree;

  const amount = parseAmount(input, BALANCE_DECIMALS);
  const overBalance = amount !== undefined && amount > ceiling;
  const isValid = amount !== undefined && amount > 0n && !overBalance;
  const isPending = addMargin.isPending || removeMargin.isPending;

  const onSubmit = () => {
    if (amount === undefined) return;
    void runWrite(
      mode === "add"
        ? { pending: "Adding margin…", success: "Margin added" }
        : { pending: "Removing margin…", success: "Margin removed", tone: "warn" },
      async () => {
        const result =
          mode === "add"
            ? await addMargin.mutateAsync({ virtualAccount, amount, chainId: deployment.chainId })
            : await removeMargin.mutateAsync({ virtualAccount, amount, chainId: deployment.chainId });
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
      eyebrow={`${deployment.label} · ${account.name}`}
      title="Position margin"
      footer={
        <GatedSubmit
          deployment={deployment}
          label={mode === "add" ? "Add margin" : "Remove margin"}
          onSubmit={onSubmit}
          disabled={!isValid}
          loading={isPending}
          size="lg"
          className="w-full"
        />
      }
    >
      <Segmented options={MODES} value={mode} onChange={setMode} size="sm" />

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
            {mode === "add" ? "FROM ACCOUNT" : "FREE IN VA"}{" "}
            <Numeric size="sm" tone="muted">
              {formatUsd(fromWei(ceiling), { exact: true })}
            </Numeric>
          </>
        }
        footnote={
          overBalance
            ? mode === "add"
              ? "More than the parent account has available."
              : "More than this position can release without unlocking its margin."
            : mode === "add"
              ? "Moves collateral from the account into this position, pushing its liquidation price away."
              : "Releases collateral back to the account. The solver attests the position's value first."
        }
      />

      <Chips
        options={QUICK_PICKS}
        onChange={(pick) => {
          const fraction = pick === "Max" ? 100n : BigInt(pick.replace("%", ""));
          setInput(toAmountInput((ceiling * fraction) / 100n, BALANCE_DECIMALS));
        }}
      />

      <div className="flex flex-col divide-y divide-[var(--border-subtle)]">
        <ReceiptRow
          label="Virtual account"
          value={<span className="tnum text-sm text-fg-1">{shortenAddress(virtualAccount)}</span>}
        />
        <ReceiptRow
          label="Margin in position"
          value={
            <Numeric size="sm" tone="strong">
              {formatUsd(fromWei(vaBalance.data?.allocatedBalance), { exact: true })}
            </Numeric>
          }
        />
        <ReceiptRow
          label="Locked against the trade"
          value={<Numeric size="sm">{formatUsd(fromWei(vaLocked), { exact: true })}</Numeric>}
        />
      </div>
    </Modal>
  );
}

function maxZero(value: bigint): bigint {
  return value > 0n ? value : 0n;
}
