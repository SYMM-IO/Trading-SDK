"use client";

import { Field } from "@/components/field";
import { ResultError, ResultNote, ResultSuccess } from "@/components/result";
import { TxReceipt } from "@/components/tx-result";
import { useAddMargin, useSimulateAddMargin, useWalletAccount } from "@symm-frontier/react";
import { Button } from "@symm-frontier/ui/components/button";
import { Input } from "@symm-frontier/ui/components/input";
import { Spinner } from "@symm-frontier/ui/components/spinner";
import { useState } from "react";
import { isAddress, parseUnits, type Address } from "viem";

import { MethodCard } from "./method-card";
import { SimulateResult } from "./simulate-result";
import { VirtualAccountField } from "./virtual-account-field";

/** `addMargin` amounts are the SYMMIO core's internal 18-decimal margin units, not collateral-token decimals. */
const MARGIN_DECIMALS = 18;

export function WriteAddMargin() {
  const { isConnected, isOnExpectedChain } = useWalletAccount();
  const [virtualAccount, setVirtualAccount] = useState<string>("");
  const [amount, setAmount] = useState<string>("");

  const validVa = isAddress(virtualAccount) ? (virtualAccount as Address) : undefined;
  const validAmount = amount.length > 0 && Number(amount) > 0 ? parseUnits(amount, MARGIN_DECIMALS) : undefined;
  const canSubmit = isConnected && isOnExpectedChain && validVa && validAmount !== undefined;

  const mutation = useAddMargin();

  /** Dry-run `addMargin` before sending. */
  const simulate = useSimulateAddMargin();

  return (
    <MethodCard
      testId="method-addMargin"
      name="addMargin"
      mutability="nonpayable"
      description="Add margin to a virtual account — move collateral from the parent subaccount's available balance into the VA. No signature required."
    >
      <VirtualAccountField
        idPrefix="add-margin-va"
        label="virtualAccount (VA address)"
        value={virtualAccount}
        onValueChange={(next) => {
          setVirtualAccount(next);
          mutation.reset();
        }}
        invalid={virtualAccount.length > 0 && !validVa}
      />

      <Field label="amount (18-decimal margin units)" htmlFor="input-add-margin-amount">
        <Input
          id="input-add-margin-amount"
          data-testid="input-add-margin-amount"
          value={amount}
          onChange={(e) => {
            setAmount(e.target.value);
            mutation.reset();
          }}
          placeholder="100.0"
          inputMode="decimal"
          aria-invalid={amount.length > 0 && validAmount === undefined}
        />
      </Field>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!canSubmit || simulate.isPending}
          onClick={() => {
            if (!validVa || validAmount === undefined) return;
            simulate.mutate({ virtualAccount: validVa, amount: validAmount });
          }}
          data-testid="button-simulate-add-margin"
        >
          {simulate.isPending ? (
            <>
              <Spinner className="size-4" /> Simulating…
            </>
          ) : (
            "Simulate"
          )}
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={!canSubmit || mutation.isPending}
          onClick={() => {
            if (!validVa || validAmount === undefined) return;
            mutation.mutate({ virtualAccount: validVa, amount: validAmount });
          }}
          data-testid="button-send-add-margin"
        >
          {mutation.isPending ? (
            <>
              <Spinner className="size-4" /> Sending…
            </>
          ) : (
            "Send transaction"
          )}
        </Button>
      </div>

      <SimulateResult
        isPending={simulate.isPending}
        isSuccess={simulate.isSuccess}
        error={simulate.error}
        testId="result-simulate-addMargin"
      />

      <WritePanel mutation={mutation} />
    </MethodCard>
  );
}

function WritePanel({ mutation }: { mutation: ReturnType<typeof useAddMargin> }) {
  if (mutation.isPending) {
    return (
      <ResultNote testId="result-addMargin-pending" loading>
        Submitting transaction… waiting for wallet, then receipt.
      </ResultNote>
    );
  }
  if (mutation.error) {
    return <ResultError testId="result-addMargin-error" kind={mutation.error.kind} message={mutation.error.message} />;
  }
  if (mutation.isSuccess) {
    return (
      <ResultSuccess testId="result-addMargin-success">
        <span className="text-foreground">Margin added to the virtual account.</span>
        <TxReceipt
          hash={mutation.data.hash}
          receipt={
            mutation.data.receipt
              ? { blockNumber: mutation.data.receipt.blockNumber, status: String(mutation.data.receipt.status) }
              : undefined
          }
        />
      </ResultSuccess>
    );
  }
  return <ResultNote testId="result-addMargin-idle">Fill the fields above and submit.</ResultNote>;
}
