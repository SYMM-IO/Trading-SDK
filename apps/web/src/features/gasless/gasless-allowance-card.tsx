"use client";

import { DataList, DataRow } from "@/components/data-list";
import { Field } from "@/components/field";
import { ResultError, ResultNote, ResultSuccess, ResultWarning } from "@/components/result";
import { formatUsd, isUnlimitedAllowance, WEI_DECIMALS } from "@/lib/format";
import { OPERATIONAL_FEE_LIST_PRICE_MULTIPLIER } from "@symmio/trading-core";
import {
  useAccountBalanceOf,
  useApproveOperationalFee,
  useApproveOperationalFeeAllowance,
  useOperationalFeeAllowance,
  useSymmioChainId,
  useSymmioConfig,
} from "@symmio/trading-react";
import { Button } from "@symmio/ui/components/button";
import { Input } from "@symmio/ui/components/input";
import { Spinner } from "@symmio/ui/components/spinner";
import { cn } from "@symmio/ui/lib/utils";
import { useState } from "react";
import { parseUnits, zeroAddress, type Address } from "viem";
import { SubAccountPicker } from "../inspector/subaccount-picker";
import { GaslessCard } from "./gasless-card";
import { GaslessFeePreview } from "./gasless-fee-preview";
import { useGaslessWriteMode, useGaslessWriteOption } from "./gasless-write-mode-store";

/** The approval that also sets the fee multiplier — its key into the per-card session-key store. */
const RESET_METHOD = "approveOperationalFee";

/** The approval that leaves the fee multiplier alone — its key into the per-card session-key store. */
const KEEP_METHOD = "approveOperationalFeeAllowance";

/** What the approval does to the payer's fee multiplier, which picks the diamond write it sends. */
type MultiplierChoice = "reset" | "keep";

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
 *
 * The diamond has two approvals, and the card names which one it sends. The
 * fee multiplier is the payer's own priority signal, kept on the same allowance:
 * `approveOperationalFeeWithMultiplier` (the SDK's `approveOperationalFee`) also
 * sets it — to list price, here — while the two-argument `approveOperationalFee`
 * (the SDK's `approveOperationalFeeAllowance`) leaves it alone. Only the first is
 * in a session key's grant set, so the key can sign a reset but not a keep.
 */
export function GaslessAllowanceCard() {
  const [selection, setSelection] = useState<Selection>({});
  const [amount, setAmount] = useState(DEFAULT_APPROVAL_USDC);
  const [choice, setChoice] = useState<MultiplierChoice>("reset");
  const payer = selection.subAccount;

  const allowance = useOperationalFeeAllowance({
    payer: payer ?? zeroAddress,
    query: { enabled: Boolean(payer) },
  });
  const balance = useAccountBalanceOf({ account: payer });
  const resetApprove = useApproveOperationalFee();
  const keepApprove = useApproveOperationalFeeAllowance();
  /** No relay toggle here, so these only change the call while the key toggle is on. */
  const resetWrite = useGaslessWriteOption(RESET_METHOD);
  const keepWrite = useGaslessWriteOption(KEEP_METHOD);
  /** Whether each approval will relay — the key toggle, or the chain config's execution mode. */
  const resetRelayed = useGaslessWriteMode(RESET_METHOD).enabled;
  const keepRelayed = useGaslessWriteMode(KEEP_METHOD).enabled;
  const chainId = useSymmioChainId();
  const gaslessLayerAddress = useSymmioConfig().getChainConfig(chainId).gasless?.gaslessLayerAddress;

  const keep = choice === "keep";
  const approve = keep ? keepApprove : resetApprove;
  const method = keep ? KEEP_METHOD : RESET_METHOD;
  const relayed = keep ? keepRelayed : resetRelayed;

  /** `null` while the box cannot describe an approval. */
  const approvalAmount = parseApproval(amount);
  const currentMultiplier = allowance.data?.feeMultiplier;

  /**
   * The exact approval the button sends. The GaslessLayer prices a batch from
   * its own calldata, so the preview follows the multiplier choice.
   */
  const approvalCall =
    gaslessLayerAddress && approvalAmount !== null
      ? [
          keep
            ? { functionName: "approveOperationalFee", args: [[gaslessLayerAddress], [approvalAmount]] }
            : {
                functionName: "approveOperationalFeeWithMultiplier",
                args: [[gaslessLayerAddress], [approvalAmount], [OPERATIONAL_FEE_LIST_PRICE_MULTIPLIER]],
              },
        ]
      : undefined;

  function parseApproval(text: string): bigint | null {
    if (text.trim().length === 0) return null;
    try {
      const units = parseUnits(text.trim(), WEI_DECIMALS);
      return units > 0n ? units : null;
    } catch {
      return null;
    }
  }

  function resetApprovals() {
    resetApprove.reset();
    keepApprove.reset();
  }

  return (
    <GaslessCard
      testId="gasless-allowance"
      method="getOperationalFeeAllowance"
      description="The gateway can only charge a payer up to this diamond-side allowance. Grant it before relying on gasless execution — approval is routed through the sub-account so the diamond sees the right payer."
      sessionKeyMethod={method}
    >
      <SubAccountPicker
        idPrefix="input-gasless-allowance-payer"
        selected={selection}
        onSelect={(next) => {
          setSelection(next);
          resetApprovals();
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
            value={`${allowance.data.feeMultiplier.toString()} bps${allowance.data.feeMultiplier === OPERATIONAL_FEE_LIST_PRICE_MULTIPLIER ? " (list price)" : ""}`}
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

      <div className="@container">
        <div className="border-border/70 bg-muted/20 grid gap-2 rounded-xl border p-1.5 @2xl:grid-cols-2">
          <MultiplierOption
            active={!keep}
            onClick={() => {
              setChoice("reset");
              resetApprovals();
            }}
            title="Reset multiplier"
            method="approveOperationalFeeWithMultiplier"
            detail="Sets the allowance and puts the fee multiplier at list price. A session key can sign it."
            testId="gasless-allowance-multiplier-reset"
          />
          <MultiplierOption
            active={keep}
            onClick={() => {
              setChoice("keep");
              resetApprovals();
            }}
            title="Keep multiplier"
            method="approveOperationalFee"
            detail="Sets the allowance only; the fee multiplier stays as it is."
            testId="gasless-allowance-multiplier-keep"
          />
        </div>
      </div>

      {!keep && currentMultiplier !== undefined && currentMultiplier !== OPERATIONAL_FEE_LIST_PRICE_MULTIPLIER ? (
        <ResultWarning testId="gasless-allowance-multiplier-warning">
          {`This payer’s fee multiplier is ${currentMultiplier.toString()} bps. Resetting puts it back to list price (${OPERATIONAL_FEE_LIST_PRICE_MULTIPLIER.toString()} bps) — choose Keep multiplier to leave it.`}
        </ResultWarning>
      ) : null}

      <Button
        type="button"
        size="sm"
        disabled={!payer || approvalAmount === null || approve.isPending}
        onClick={() => {
          if (!payer || approvalAmount === null) return;
          if (keep) keepApprove.mutate({ account: payer, amounts: [approvalAmount], ...keepWrite });
          else resetApprove.mutate({ account: payer, amounts: [approvalAmount], ...resetWrite });
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

      {relayed ? (
        <GaslessFeePreview account={payer} calls={approvalCall} labels={[method]} testId="gasless-allowance-fee" />
      ) : null}
    </GaslessCard>
  );
}

/** One of the card's two approvals, named by its effect on the fee multiplier. */
function MultiplierOption({
  active,
  onClick,
  title,
  method,
  detail,
  testId,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  /** The diamond function the option sends. */
  method: string;
  detail: string;
  testId: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      data-testid={testId}
      className={cn(
        "focus-visible:ring-ring/40 flex flex-col gap-1 rounded-lg px-3 py-2.5 text-left transition-all outline-none focus-visible:ring-2",
        active ? "bg-background ring-border shadow-sm ring-1" : "hover:bg-muted/50",
      )}
    >
      <span className={cn("text-sm font-medium", active ? "text-foreground" : "text-muted-foreground")}>{title}</span>
      <span className="text-muted-foreground font-mono text-[0.7rem] wrap-anywhere">{method}</span>
      <span className="text-muted-foreground text-xs leading-5">{detail}</span>
    </button>
  );
}
