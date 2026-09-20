"use client";

import { DataList, DataRow } from "@/components/data-list";
import { Field } from "@/components/field";
import { ResultError, ResultNote, ResultSuccess } from "@/components/result";
import { formatUsd, isUnlimitedAllowance, WEI_DECIMALS } from "@/lib/format";
import { useAccountBalanceOf, useApproveOperationalFee, useOperationalFeeAllowance } from "@symmio/trading-react";
import { Button } from "@symmio/ui/components/button";
import { Input } from "@symmio/ui/components/input";
import { Spinner } from "@symmio/ui/components/spinner";
import { useState } from "react";
import { parseUnits, zeroAddress, type Address } from "viem";
import { SubAccountPicker } from "../inspector/subaccount-picker";
import { GaslessCard } from "./gasless-card";
import { useGaslessWriteOption } from "./gasless-write-mode-store";

/** The write this card sends — its key into the per-card session-key store. */
const APPROVE_METHOD = "approveOperationalFee";

/** What the card grants when the amount box is left alone. */
const DEFAULT_APPROVAL_USDC = "50";

interface Selection {
  subAccount?: Address;
  name?: string;
}

/**
 * Allowances and balances here are **18-decimal Core units**, not the collateral
 * token's units — the diamond keeps one internal scale and the operational fee
 * is charged in it.
 *
 * A `maxUint256` approval is still decremented by every charge, so it is not an
 * "unlimited" balance and is never printed as one; it is named for what it is,
 * and its 78-digit decimal form is not shown at all.
 */
function formatCoreAllowance(value: bigint): string {
  return isUnlimitedAllowance(value) ? "2^256 − 1 (uncapped, still decremented)" : formatUsd(value, WEI_DECIMALS);
}

/** A scheduled reduction is a Unix-seconds ETA; `0n` means none is pending. */
function formatReductionEta(readyAt: bigint): string {
  if (readyAt === 0n) return "none scheduled";
  const when = new Date(Number(readyAt) * 1000);
  const secondsAway = Number(readyAt) - Math.floor(Date.now() / 1000);
  if (secondsAway <= 0) return `${when.toLocaleString()} (elapsed)`;
  const minutesAway = Math.ceil(secondsAway / 60);
  return `${when.toLocaleString()} (in ~${minutesAway} min)`;
}

/**
 * Operational-fee allowance card: read the payer's allowance for the gasless
 * charger from the core diamond next to the Core balance that actually pays,
 * and grant a **bounded** one as the paying sub-account (via the `_call` proxy —
 * the connected wallet must own it, or the session key must hold its delegation
 * when the card's key toggle is on).
 *
 * The allowance is a cap, not a balance: a payer with a large allowance and too
 * little Core balance still fails with `OperationalFee: Insufficient balance`,
 * which is why both numbers are on screen together.
 */
export function GaslessAllowanceCard() {
  const [selection, setSelection] = useState<Selection>({});
  const [amount, setAmount] = useState(DEFAULT_APPROVAL_USDC);
  const payer = selection.subAccount;

  const allowance = useOperationalFeeAllowance({
    payer: payer ?? zeroAddress,
    query: { enabled: Boolean(payer) },
  });
  const balance = useAccountBalanceOf({ account: payer });
  const approve = useApproveOperationalFee();
  /** No relay toggle here, so this only changes the call while the key toggle is on. */
  const write = useGaslessWriteOption(APPROVE_METHOD);

  /** `null` while the box cannot describe an approval. */
  const approvalAmount = parseApproval(amount);

  function parseApproval(text: string): bigint | null {
    if (text.trim().length === 0) return null;
    try {
      const units = parseUnits(text.trim(), WEI_DECIMALS);
      return units > 0n ? units : null;
    } catch {
      return null;
    }
  }

  return (
    <GaslessCard
      testId="gasless-allowance"
      method="getOperationalFeeAllowance"
      description="The gateway can only charge a payer up to this diamond-side allowance. Grant it before relying on gasless execution — approval is routed through the sub-account so the diamond sees the right payer."
      sessionKeyMethod={APPROVE_METHOD}
    >
      <SubAccountPicker
        idPrefix="input-gasless-allowance-payer"
        selected={selection}
        onSelect={(next) => {
          setSelection(next);
          approve.reset();
        }}
        accountLabel="payer (sub-account)"
        accountEmptyHint="Pick the sub-account whose collateral pays operational fees, or enter one manually."
        selectedHintLabel="Payer"
      />

      {!payer ? (
        <ResultNote testId="gasless-allowance-idle">Select a sub-account to read its allowance.</ResultNote>
      ) : allowance.isPending ? (
        <ResultNote loading testId="gasless-allowance-loading">
          Reading allowance…
        </ResultNote>
      ) : allowance.error ? (
        <ResultError kind={allowance.error.kind} message={allowance.error.message} testId="gasless-allowance-error" />
      ) : allowance.data ? (
        <DataList>
          <DataRow label="Allowance" value={formatCoreAllowance(allowance.data.allowance)} mono />
          <DataRow label="Pending reduction" value={formatCoreAllowance(allowance.data.pendingAllowance)} mono />
          <DataRow label="Reduction ready at" value={formatReductionEta(allowance.data.reductionReadyAt)} mono />
          <DataRow
            label="Payer Core balance"
            value={balance.data !== undefined ? formatUsd(balance.data, WEI_DECIMALS) : "…"}
            mono
          />
          <DataRow
            label="Fee multiplier"
            value={`${allowance.data.feeMultiplier.toString()} bps${allowance.data.feeMultiplier === 10_000n ? " (list price)" : ""}`}
            mono
          />
        </DataList>
      ) : null}

      <Field
        label="Approval amount (USDC)"
        htmlFor="gasless-allowance-amount"
        hint="Scaled to 18-decimal Core units, the scale the diamond charges in. Approve what this payer should be able to spend on relayer fees — an uncapped approval is spent by every charge, with no ceiling to notice."
      >
        <Input
          id="gasless-allowance-amount"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          inputMode="decimal"
          placeholder={DEFAULT_APPROVAL_USDC}
          className="font-mono"
          aria-invalid={approvalAmount === null}
          data-testid="input-gasless-allowance-amount"
        />
      </Field>

      <Button
        type="button"
        size="sm"
        disabled={!payer || approvalAmount === null || approve.isPending}
        onClick={() => {
          if (!payer || approvalAmount === null) return;
          approve.mutate({ account: payer, amounts: [approvalAmount], ...write });
        }}
        data-testid="button-gasless-approve-allowance"
      >
        {approve.isPending ? (
          <>
            <Spinner className="size-4" /> Approving…
          </>
        ) : (
          "Approve allowance"
        )}
      </Button>

      {approve.error ? (
        <ResultError kind={approve.error.kind} message={approve.error.message} testId="gasless-approve-error" />
      ) : approve.isSuccess ? (
        <ResultSuccess testId="gasless-approve-result">
          Allowance granted — tx <span className="font-mono text-xs break-all">{approve.data.hash}</span>. Lowering an
          allowance is not immediate: the reduction lands at the ETA above, and the current allowance keeps applying
          until then.
        </ResultSuccess>
      ) : null}
    </GaslessCard>
  );
}
