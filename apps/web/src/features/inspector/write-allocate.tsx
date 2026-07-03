"use client";

import { Field } from "@/components/field";
import { ResultError, ResultNote, ResultSuccess } from "@/components/result";
import { TxReceipt } from "@/components/tx-result";
import { useAllocate, useSimulateAllocate, useWalletAccount } from "@symmio/trading-react";
import { Button } from "@symmio/ui/components/button";
import { Input } from "@symmio/ui/components/input";
import { Spinner } from "@symmio/ui/components/spinner";
import { useState } from "react";
import { isAddress, parseUnits, type Address } from "viem";

import { MethodCard } from "./method-card";
import { SimulateResult } from "./simulate-result";
import { SubAccountField } from "./subaccount-field";

/** `allocate` amounts are the SYMMIO core's internal 18-decimal margin units, not collateral-token decimals. */
const MARGIN_DECIMALS = 18;

export function WriteAllocate() {
  const { isConnected, isOnExpectedChain } = useWalletAccount();
  const [account, setAccount] = useState<string>("");
  const [amount, setAmount] = useState<string>("");

  const validAccount = isAddress(account) ? (account as Address) : undefined;
  const validAmount = amount.length > 0 && Number(amount) > 0 ? parseUnits(amount, MARGIN_DECIMALS) : undefined;
  const canSubmit = isConnected && isOnExpectedChain && validAccount && validAmount !== undefined;

  const mutation = useAllocate();

  /** Dry-run `allocate` before sending. */
  const simulate = useSimulateAllocate();

  return (
    <MethodCard
      testId="method-allocate"
      name="allocate"
      mutability="nonpayable"
      description="Move a subaccount's available balance into allocated (tradeable) margin (routed via AccountLayer _call)."
    >
      <SubAccountField
        idPrefix="allocate-account"
        label="account (subaccount address)"
        value={account}
        onValueChange={(next) => {
          setAccount(next);
          mutation.reset();
        }}
        invalid={account.length > 0 && !validAccount}
      />

      <Field label="amount (18-decimal margin units)" htmlFor="input-allocate-amount">
        <Input
          id="input-allocate-amount"
          data-testid="input-allocate-amount"
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
            if (!validAccount || validAmount === undefined) return;
            simulate.mutate({ account: validAccount, amount: validAmount });
          }}
          data-testid="button-simulate-allocate"
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
            if (!validAccount || validAmount === undefined) return;
            mutation.mutate({ account: validAccount, amount: validAmount });
          }}
          data-testid="button-send-allocate"
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
        testId="result-simulate-allocate"
      />

      <WritePanel mutation={mutation} />
    </MethodCard>
  );
}

function WritePanel({ mutation }: { mutation: ReturnType<typeof useAllocate> }) {
  if (mutation.isPending) {
    return (
      <ResultNote testId="result-allocate-pending" loading>
        Submitting transaction… waiting for wallet, then receipt.
      </ResultNote>
    );
  }
  if (mutation.error) {
    return <ResultError testId="result-allocate-error" kind={mutation.error.kind} message={mutation.error.message} />;
  }
  if (mutation.isSuccess) {
    return (
      <ResultSuccess testId="result-allocate-success">
        <span className="text-foreground">Allocated to margin.</span>
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
  return <ResultNote testId="result-allocate-idle">Fill the fields above and submit.</ResultNote>;
}
