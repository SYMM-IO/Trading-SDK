"use client";

import { WEI_DECIMALS } from "@/lib/format";
import type { GaslessBatchCall, GaslessFeePayment, GaslessFundingBalanceChange } from "@symmio/trading-core";
import { useGaslessBatchFunding, useSupportsGaslessService } from "@symmio/trading-react";
import { Button } from "@symmio/ui/components/button";
import { Input } from "@symmio/ui/components/input";
import { useRef, useState } from "react";
import { isAddress, isAddressEqual, parseUnits, type Address } from "viem";
import { GaslessFundingLine, type FundingChargeRow, type FundingLineState } from "./gasless-funding-line";

interface BalanceChangeRow {
  key: number;
  account: string;
  amount: string;
}

/**
 * A row's movement, `null` while it has no amount yet (a new row arrives with
 * the account filled in), or `"invalid"` when it cannot be read.
 */
function parseRow(row: BalanceChangeRow): GaslessFundingBalanceChange | null | "invalid" {
  const account = row.account.trim();
  const amount = row.amount.trim();
  if (amount.length === 0) return null;
  if (!isAddress(account) || !/^[+-]?\d+(\.\d+)?$/.test(amount)) return "invalid";
  try {
    return { account, delta18: parseUnits(amount.replace(/^\+/, ""), WEI_DECIMALS) };
  } catch {
    return "invalid";
  }
}

/** Every non-zero charge one payer pays, named after the operation it belongs to. */
function chargesFor(
  payer: Address,
  payments: readonly GaslessFeePayment[],
  labels: readonly string[] | undefined,
): FundingChargeRow[] {
  return payments.flatMap((payment, index) => {
    if (!isAddressEqual(payment.payer, payer)) return [];
    const operation = labels?.[index] || `Operation ${index + 1}`;
    const charges: FundingChargeRow[] = [
      { label: operation, kind: "operational fee", amount18: payment.operationalFee18 },
      { label: "Wallet creation", kind: operation, amount18: payment.walletCreationFee18 },
      { label: "Deposit fee", kind: operation, amount18: payment.depositFee18 },
      { label: "Native gas top-up fee", kind: operation, amount18: payment.nativeTopUpFee18 },
      { label: "Native gas collateral", kind: operation, amount18: payment.nativeGasCollateral18 },
    ];
    return charges.filter((charge) => charge.amount18 > 0n);
  });
}

interface Props {
  account?: Address;
  calls?: readonly GaslessBatchCall[];
  /** The batch card's name for each call, in call order. */
  labels?: readonly string[];
  /** The batch is being relayed: balances are about to change, so no answer is shown or read. */
  writePending?: boolean;
  /**
   * Changes whenever balances may have moved (the card passes its relay's state).
   * An answer belongs to the key it was read under; a new key hides it, while
   * the typed balance changes stay.
   */
  resetKey?: string;
  testId?: string;
}

/**
 * Batch funding check: can every quoted payer still pay its fee once the batch
 * has run? Read-only, and only on click. The SDK does not read money movements
 * from calldata, so a batch that moves Core balances lists them here.
 */
export function GaslessBatchFunding({
  account,
  calls,
  labels,
  writePending = false,
  resetKey = "",
  testId = "gasless-batch-funding",
}: Props) {
  const supported = useSupportsGaslessService();
  if (!supported || !account || !calls) return null;
  return (
    <BatchFundingCheck
      account={account}
      calls={calls}
      labels={labels}
      writePending={writePending}
      resetKey={resetKey}
      testId={testId}
    />
  );
}

function BatchFundingCheck({
  account,
  calls,
  labels,
  writePending,
  resetKey,
  testId,
}: Required<Omit<Props, "labels">> & Pick<Props, "labels">) {
  const [rows, setRows] = useState<BalanceChangeRow[]>([]);
  const [editing, setEditing] = useState(false);
  // Results appear only after an explicit check under the current reset key; new inputs select a fresh, unread query.
  const [requestedFor, setRequestedFor] = useState<string | null>(null);
  const requested = requestedFor === resetKey;
  const nextKey = useRef(0);

  const parsed = rows.map(parseRow);
  const invalid = parsed.includes("invalid");
  const balanceChanges = parsed.filter(
    (change): change is GaslessFundingBalanceChange => change !== null && change !== "invalid",
  );
  const funding = useGaslessBatchFunding({ account, calls, balanceChanges, query: { enabled: false } });

  let state: FundingLineState;
  if (writePending) state = { status: "unchecked", disabled: true };
  else if (funding.isFetching) state = { status: "checking" };
  else if (requested && funding.isError)
    state = {
      status: "failed",
      // Wallet-collateral fees are outside the SDK check by design: say so, not just "unavailable".
      summary:
        funding.error.code === "GASLESS_FUNDING_SOURCE_UNSUPPORTED" ? "not supported for wallet-call fees" : undefined,
      detail: funding.error.message,
    };
  else if (requested && funding.data)
    state = {
      status: "ready",
      payers: funding.data.payers.map((payer) => ({
        payer: payer.payer,
        charges: chargesFor(payer.payer, funding.data.quote.payments, labels),
        fee18: payer.debit18,
        balanceNow18: payer.balanceBefore18,
        balanceAfter18: payer.projectedBalance18,
        short18: payer.shortfall18,
      })),
    };
  else state = { status: "unchecked", disabled: invalid };

  function updateRow(key: number, patch: Partial<BalanceChangeRow>) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  return (
    <GaslessFundingLine
      state={state}
      testId={testId}
      onCheck={() => {
        if (invalid || writePending) return;
        setRequestedFor(resetKey);
        void funding.refetch();
      }}
    >
      <div className="text-xs">
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
          aria-expanded={editing}
          onClick={() => setEditing((open) => !open)}
          data-testid={`button-${testId}-changes`}
        >
          {editing ? "▾" : "▸"} Balance changes{balanceChanges.length > 0 ? ` (${balanceChanges.length})` : ""}
        </button>
        {editing ? (
          <div className="border-border/60 mt-2 grid gap-2 rounded-lg border p-3">
            <p className="text-muted-foreground leading-5">
              Money this batch moves before the fee is charged, in USDC. Negative leaves the account (addMargin takes it
              from the parent); positive arrives.
            </p>
            {rows.length > 0 ? (
              <div className="text-muted-foreground grid grid-cols-[2fr_1fr_auto] gap-2 font-medium">
                <span>Account</span>
                <span>Change (USDC)</span>
                <span className="sr-only">Remove</span>
              </div>
            ) : null}
            {rows.map((row, index) => (
              <div key={row.key} className="grid grid-cols-[2fr_1fr_auto] items-center gap-2">
                <Input
                  aria-label={`Balance change ${index + 1} account`}
                  value={row.account}
                  onChange={(event) => updateRow(row.key, { account: event.target.value })}
                  placeholder="0x…"
                  className="h-8 font-mono text-xs"
                  data-testid={`input-${testId}-account-${index}`}
                />
                <Input
                  aria-label={`Balance change ${index + 1} amount`}
                  value={row.amount}
                  onChange={(event) => updateRow(row.key, { amount: event.target.value })}
                  placeholder="-50"
                  inputMode="decimal"
                  className="h-8 font-mono text-xs"
                  data-testid={`input-${testId}-amount-${index}`}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8 px-2 text-xs"
                  onClick={() => setRows((current) => current.filter((item) => item.key !== row.key))}
                  aria-label={`Remove balance change ${index + 1}`}
                >
                  ✕
                </Button>
              </div>
            ))}
            {invalid ? (
              <p className="text-warning" data-testid={`${testId}-invalid`}>
                Each row needs an address and a signed amount, like -50 or 12.5.
              </p>
            ) : null}
            <div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 px-2.5 text-xs"
                onClick={() => setRows((current) => [...current, { key: nextKey.current++, account, amount: "" }])}
                data-testid={`button-${testId}-add-change`}
              >
                Add row
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </GaslessFundingLine>
  );
}
