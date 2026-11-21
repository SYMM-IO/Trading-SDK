"use client";

import { formatUsd, WEI_DECIMALS } from "@/lib/format";
import { Button } from "@symmio/ui/components/button";
import { Spinner } from "@symmio/ui/components/spinner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@symmio/ui/components/tooltip";
import { cn } from "@symmio/ui/lib/utils";
import { shortenAddress } from "@symmio/utils";
import { useState, type ReactNode } from "react";
import type { Address } from "viem";

/** One charge in a payer's fee, in 18-decimal Core units. */
export interface FundingChargeRow {
  /** What the charge is for, e.g. the call's name or "Wallet creation". */
  label: string;
  /** The kind of charge, shown muted after the label. */
  kind: string;
  amount18: bigint;
}

/** Why a payer cannot be charged: too little balance, too little fee allowance, or both. */
export type FundingShortage = "balance" | "allowance";

/** One charged payer, in 18-decimal Core units. */
export interface FundingPayerRow {
  payer: Address;
  charges: readonly FundingChargeRow[];
  fee18: bigint;
  balanceNow18: bigint;
  balanceAfter18: bigint;
  missingBalance18: bigint;
  allowance18: bigint;
  missingAllowance18: bigint;
  /** Empty when the payer is covered. */
  missing: readonly FundingShortage[];
}

/** What the funding line shows. */
export type FundingLineState =
  /** Nothing read yet: the line offers the check. */
  | { status: "unchecked"; disabled?: boolean }
  | { status: "checking" }
  /** The read failed: `summary` inline when the reason is known (default "check unavailable"), `detail` on hover. */
  | { status: "failed"; summary?: string; detail: string }
  | { status: "ready"; payers: readonly FundingPayerRow[] };

interface Props {
  state: FundingLineState;
  onCheck: () => void;
  /** Extra controls under the line, e.g. the balance-change editor. */
  children?: ReactNode;
  testId: string;
}

function usdc(amount18: bigint): string {
  return `${formatUsd(amount18, WEI_DECIMALS)} USDC`;
}

/** Allowances granted as "unlimited" are far above this; showing their digits says nothing. */
const UNLIMITED_ALLOWANCE = 2n ** 128n;

function allowanceText(amount18: bigint): string {
  return amount18 >= UNLIMITED_ALLOWANCE ? "unlimited" : usdc(amount18);
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

/**
 * One hairline row under the fee line: whether every quoted payer can still pay
 * its fee after the batch. A one-line total follows; the per-payer breakdown
 * opens on click, and opens by itself when a payer is short.
 */
export function GaslessFundingLine({ state, onCheck, children, testId }: Props) {
  return (
    <div data-testid={testId} data-status={state.status} className="space-y-2.5">
      <div className="border-border/70 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-dashed pt-3 text-xs">
        <span className="text-muted-foreground font-medium tracking-wide uppercase">Fee funding</span>
        <FundingStatus state={state} onCheck={onCheck} testId={testId} />
      </div>
      {state.status === "ready" && state.payers.length > 0 ? (
        <FundingSummary payers={state.payers} testId={testId} />
      ) : null}
      {children}
    </div>
  );
}

function FundingStatus({ state, onCheck, testId }: Omit<Props, "children">) {
  const check = (label: string) => (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="h-7 px-2.5 text-xs"
      disabled={state.status === "unchecked" && state.disabled}
      onClick={onCheck}
      data-testid={`button-${testId}-check`}
    >
      {label}
    </Button>
  );
  switch (state.status) {
    case "unchecked":
      return check("Check funding");
    case "checking":
      return (
        <span className="text-muted-foreground inline-flex items-center gap-1.5">
          <Spinner className="size-3" /> checking…
        </span>
      );
    case "failed":
      return (
        <span className="inline-flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-muted-foreground cursor-help" data-testid={`${testId}-failed`}>
                {state.summary ?? "check unavailable"}
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-80 p-3 text-xs leading-5" sideOffset={6}>
              {state.detail}
            </TooltipContent>
          </Tooltip>
          {check("Retry")}
        </span>
      );
    case "ready": {
      const covered = state.payers.every((payer) => payer.missing.length === 0);
      return (
        <span className="inline-flex items-center gap-2">
          {state.payers.length === 0 ? (
            <span className="text-muted-foreground" data-testid={`${testId}-verdict`}>
              no fee to fund
            </span>
          ) : covered ? (
            <span className="text-positive font-semibold" data-testid={`${testId}-verdict`}>
              ✓ covered
            </span>
          ) : (
            <span className="text-warning font-semibold" data-testid={`${testId}-verdict`}>
              ⚠ not covered
            </span>
          )}
          {check("Recheck")}
        </span>
      );
    }
  }
}

function FundingSummary({ payers, testId }: { payers: readonly FundingPayerRow[]; testId: string }) {
  const anyShort = payers.some((payer) => payer.missing.length > 0);
  // A shortfall opens the details by itself; the user's own choice wins after that.
  const [choice, setChoice] = useState<boolean | null>(null);
  const open = choice ?? anyShort;
  const total = payers.reduce((sum, payer) => sum + payer.fee18, 0n);
  return (
    <div className="grid gap-2 text-xs">
      <button
        type="button"
        className="text-muted-foreground hover:text-foreground flex w-full items-center justify-between gap-3 text-left"
        aria-expanded={open}
        onClick={() => setChoice(!open)}
        data-testid={`button-${testId}-details`}
      >
        <span>
          Total charged <span className="text-foreground font-mono">{usdc(total)}</span> ·{" "}
          {plural(payers.length, "payer")}
        </span>
        <span>{open ? "▾ Hide details" : "▸ Details"}</span>
      </button>
      {open ? (
        <div className="grid gap-2" data-testid={`${testId}-payers`}>
          {payers.map((payer) => (
            <PayerCard key={payer.payer} payer={payer} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function PayerCard({ payer }: { payer: FundingPayerRow }) {
  const short = payer.missing.length > 0;
  return (
    <div
      className={cn(
        "grid gap-1 rounded-lg border px-3 py-2",
        short ? "border-warning/30 bg-warning/5" : "border-border/60",
      )}
    >
      <div className="flex items-center justify-between gap-3 pb-0.5">
        <span className="font-mono font-medium" title={payer.payer}>
          {shortenAddress(payer.payer)}
        </span>
        {short ? (
          <span className="text-warning font-semibold">⚠ not covered</span>
        ) : (
          <span className="text-positive font-semibold">✓ covered</span>
        )}
      </div>
      {payer.charges.map((charge, index) => (
        <div key={index} className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground truncate">
            {charge.label}
            <span className="text-muted-foreground/70"> · {charge.kind}</span>
          </span>
          <span className="font-mono">{usdc(charge.amount18)}</span>
        </div>
      ))}
      <div className="border-border/60 mt-1 grid gap-1 border-t pt-1.5">
        <Row label="Total charged" value={usdc(payer.fee18)} strong />
        <Row label="Balance now" value={usdc(payer.balanceNow18)} />
        <Row label="Balance after the batch" value={usdc(payer.balanceAfter18)} />
        <Row label="Fee allowance" value={allowanceText(payer.allowance18)} />
        {payer.missing.includes("balance") ? (
          <Row label="Missing balance" value={usdc(payer.missingBalance18)} className="text-warning font-semibold" />
        ) : null}
        {payer.missing.includes("allowance") ? (
          <Row
            label="Missing allowance"
            value={usdc(payer.missingAllowance18)}
            className="text-warning font-semibold"
          />
        ) : null}
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  className,
  strong,
}: {
  label: string;
  value: string;
  className?: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={strong ? "text-foreground" : "text-muted-foreground"}>{label}</span>
      <span className={cn("font-mono", strong && "font-semibold", className)}>{value}</span>
    </div>
  );
}
