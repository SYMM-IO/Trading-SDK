"use client";

import { DataList, DataRow } from "@/components/data-list";
import { ResultError, ResultNote, ResultSuccess } from "@/components/result";
import { useApproveOperationalFee, useOperationalFeeAllowance } from "@symmio/trading-react";
import { Button } from "@symmio/ui/components/button";
import { Spinner } from "@symmio/ui/components/spinner";
import { useState } from "react";
import { maxUint256, type Address } from "viem";
import { SubAccountPicker } from "../inspector/subaccount-picker";
import { GaslessCard } from "./gasless-card";
import { useGaslessWriteOption } from "./gasless-write-mode-store";

/** The write this card sends — its key into the per-card session-key store. */
const APPROVE_METHOD = "approveOperationalFee";

interface Selection {
  subAccount?: Address;
  name?: string;
}

/** `maxUint256` reads back as effectively unlimited. */
function formatAllowance(value: bigint): string {
  return value >= maxUint256 / 2n ? "unlimited" : value.toString();
}

/**
 * Operational-fee allowance card: read the payer's allowance for the gasless
 * charger from the core diamond, and grant an unlimited one as the paying
 * sub-account (via the `_call` proxy — the connected wallet must own it, or the
 * session key must hold its delegation when the card's key toggle is on).
 */
export function GaslessAllowanceCard() {
  const [selection, setSelection] = useState<Selection>({});
  const payer = selection.subAccount;

  const allowance = useOperationalFeeAllowance({
    payer: payer ?? "0x0000000000000000000000000000000000000000",
    query: { enabled: Boolean(payer) },
  });
  const approve = useApproveOperationalFee();
  /** No relay toggle here, so this only changes the call while the key toggle is on. */
  const write = useGaslessWriteOption(APPROVE_METHOD);

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
          <DataRow label="Allowance" value={formatAllowance(allowance.data.allowance)} mono />
          <DataRow label="Pending reduction" value={formatAllowance(allowance.data.pendingAllowance)} mono />
          <DataRow
            label="Fee multiplier"
            value={`${allowance.data.feeMultiplier.toString()} bps${allowance.data.feeMultiplier === 10_000n ? " (list price)" : ""}`}
            mono
          />
        </DataList>
      ) : null}

      <Button
        type="button"
        size="sm"
        disabled={!payer || approve.isPending}
        onClick={() => {
          if (!payer) return;
          approve.mutate({ account: payer, amounts: [maxUint256], ...write });
        }}
        data-testid="button-gasless-approve-allowance"
      >
        {approve.isPending ? (
          <>
            <Spinner className="size-4" /> Approving…
          </>
        ) : (
          "Approve unlimited allowance"
        )}
      </Button>

      {approve.error ? (
        <ResultError kind={approve.error.kind} message={approve.error.message} testId="gasless-approve-error" />
      ) : approve.isSuccess ? (
        <ResultSuccess testId="gasless-approve-result">
          Allowance granted — tx <span className="font-mono text-xs break-all">{approve.data.hash}</span>
        </ResultSuccess>
      ) : null}
    </GaslessCard>
  );
}
