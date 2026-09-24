"use client";

import { DataList, DataRow } from "@/components/data-list";
import { Field } from "@/components/field";
import { ResultNote, ResultSuccess } from "@/components/result";
import { GaslessFailureNote } from "@/features/gasless/gasless-failure-note";
import { formatUsd, isUnlimitedAllowance, WEI_DECIMALS } from "@/lib/format";
import {
  useAccountBalanceOf,
  useApproveOperationalFee,
  type UseOperationalFeeAllowanceReturnType,
} from "@symmio/trading-react";
import { Button } from "@symmio/ui/components/button";
import { Input } from "@symmio/ui/components/input";
import { Spinner } from "@symmio/ui/components/spinner";
import { cn } from "@symmio/ui/lib/utils";
import { useState } from "react";
import { parseUnits, type Address } from "viem";

/** A budget that covers a long run of relayed operations without being open-ended. */
const DEFAULT_APPROVAL_USDC = "50";

/** How the first approval itself is paid for. */
type ApprovalRoute = "wallet" | "relayed";

interface Props {
  subAccount: Address;
  /** Hoisted so the rail's readiness and this step read one value. */
  allowance: UseOperationalFeeAllowanceReturnType;
  /** The wallet's native balance — `0n` means the wallet route is not available to it. */
  nativeBalance?: bigint;
}

/**
 * Grant the GaslessLayer an allowance to charge this sub-account's operational
 * fees. Without it every relayed write fails at charge time with
 * `OperationalFee: Allowance exceeded`.
 *
 * The approval is a **cap, not a balance**: the fee is still drawn from the
 * sub-account's SYMMIO collateral, so an account with a large allowance and no
 * collateral fails just the same. Both numbers are on screen together for that
 * reason.
 *
 * Paying for the approval is the one genuine chicken-and-egg in the whole
 * ladder — the write that enables relayed billing has no allowance to be billed
 * against yet. There are exactly two ways out and the step offers both: pay for
 * it from the wallet (a normal transaction, always works, needs native gas), or
 * relay it under the GaslessLayer's **daily free-operations quota**, which is
 * the only route open to a wallet that came in through the cold start. A spent
 * quota surfaces as `DailyFreeOpsLimitExceeded`, which resets at UTC midnight.
 */
export function SetupFeeAllowanceStep({ subAccount, allowance, nativeBalance }: Props) {
  const [amount, setAmount] = useState(DEFAULT_APPROVAL_USDC);
  const [chosen, setChosen] = useState<ApprovalRoute>();
  const balance = useAccountBalanceOf({ account: subAccount });
  const approve = useApproveOperationalFee();

  const cannotPayGas = nativeBalance !== undefined && nativeBalance === 0n;
  const route = chosen ?? (cannotPayGas ? "relayed" : "wallet");
  const parsed = parseApproval(amount);

  return (
    <div className="flex flex-col gap-4">
      <DataList>
        <DataRow
          label="Current allowance"
          value={allowance.data ? formatFeeBudget(allowance.data.allowance) : "—"}
          mono
        />
        <DataRow
          label="Collateral that pays"
          value={balance.data !== undefined ? `${formatUsd(balance.data)} USDC` : "—"}
          mono
        />
      </DataList>

      {balance.data === 0n ? (
        <ResultNote testId="setup-fee-allowance-empty-payer">
          This sub-account holds no collateral, so the relayer has nothing to charge. Approving here would still leave
          every relayed write failing with <span className="font-mono">Insufficient balance</span> — go back and deposit
          first.
        </ResultNote>
      ) : null}

      <Field
        label="Fee budget"
        htmlFor="setup-fee-allowance-amount"
        hint="Each charge decrements this cap. A bounded budget is deliberate — an uncapped approval is still decremented, so it buys nothing but risk."
      >
        <Input
          id="setup-fee-allowance-amount"
          value={amount}
          onChange={(event) => {
            setAmount(event.target.value);
            approve.reset();
          }}
          inputMode="decimal"
          className="font-mono"
          aria-invalid={parsed === null}
          data-testid="input-setup-fee-allowance-amount"
        />
      </Field>

      <div className="border-border/70 bg-muted/20 grid gap-2 rounded-xl border p-1.5 @xl/console:grid-cols-2">
        <RouteOption
          active={route === "wallet"}
          onClick={() => {
            setChosen("wallet");
            approve.reset();
          }}
          title="Pay from my wallet"
          detail="One prompt, costs native gas. Always works."
          testId="setup-fee-allowance-route-wallet"
        />
        <RouteOption
          active={route === "relayed"}
          onClick={() => {
            setChosen("relayed");
            approve.reset();
          }}
          title="Relay it (no gas)"
          detail="Billed to the daily free-operations quota — the only route for a wallet with no gas."
          testId="setup-fee-allowance-route-relayed"
        />
      </div>

      {cannotPayGas && route === "wallet" ? (
        <ResultNote testId="setup-fee-allowance-no-gas">
          This wallet holds no native token, so it cannot pay for the approval itself. Relay it instead.
        </ResultNote>
      ) : null}

      <Button
        type="button"
        size="lg"
        className="w-full"
        disabled={parsed === null || approve.isPending}
        onClick={() => {
          if (parsed === null) return;
          approve.mutate({ account: subAccount, amounts: [parsed], gasless: route === "relayed" });
        }}
        data-testid="button-setup-fee-allowance-approve"
      >
        {approve.isPending ? <Spinner className="size-4" /> : null}
        {parsed === null ? "Enter a budget" : route === "relayed" ? "Approve without gas" : "Approve"}
      </Button>

      {approve.error ? (
        <GaslessFailureNote error={approve.error} testId="setup-fee-allowance-error" />
      ) : approve.isSuccess ? (
        <ResultSuccess testId="setup-fee-allowance-success">
          <span className="text-foreground">
            Allowance granted. The relayer can now charge this sub-account for the operations it broadcasts.
          </span>
        </ResultSuccess>
      ) : null}
    </div>
  );
}

/**
 * Parse the budget into the **18-decimal Core units** the diamond keeps its
 * allowances in — not the collateral token's decimals.
 *
 * @param text - The field's raw text.
 * @returns The allowance, or `null` when the text cannot describe one.
 */
function parseApproval(text: string): bigint | null {
  if (text.trim().length === 0) return null;
  try {
    const units = parseUnits(text.trim(), WEI_DECIMALS);
    return units > 0n ? units : null;
  } catch {
    return null;
  }
}

/**
 * An operational-fee allowance, in the **18-decimal Core units** the diamond
 * keeps it in.
 *
 * A `maxUint256` approval is named rather than printed: it is still decremented
 * by every charge, so it is not an unlimited balance, and its 30-digit decimal
 * form is both meaningless and wide enough to blow out any column it lands in —
 * the step rail included, which is why this is shared rather than local.
 */
export function formatFeeBudget(value: bigint): string {
  return isUnlimitedAllowance(value) ? "Uncapped" : `${formatUsd(value, WEI_DECIMALS)} USDC`;
}

/** One of the step's two ways of paying for the approval. */
function RouteOption({
  active,
  onClick,
  title,
  detail,
  testId,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
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
      <span className="text-muted-foreground text-xs leading-5">{detail}</span>
    </button>
  );
}
