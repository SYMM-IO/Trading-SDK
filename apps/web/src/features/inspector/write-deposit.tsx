"use client";

import { Field } from "@/components/field";
import { ResultError, ResultNote, ResultSuccess } from "@/components/result";
import { TxReceipt } from "@/components/tx-result";
import { useDeposit, useSimulateDeposit, useSymmioConfig, useWalletAccount } from "@symm-frontier/react";
import { Button } from "@symm-frontier/ui/components/button";
import { Input } from "@symm-frontier/ui/components/input";
import { Spinner } from "@symm-frontier/ui/components/spinner";
import { useState } from "react";
import { isAddress, parseUnits, type Address } from "viem";

import { MethodCard } from "./method-card";
import { SimulateResult } from "./simulate-result";
import { SubAccountField } from "./subaccount-field";

export function WriteDeposit() {
  const { isConnected, isOnExpectedChain } = useWalletAccount();
  const config = useSymmioConfig();
  const { addresses } = config.getChainConfig();
  const [account, setAccount] = useState<string>("");
  const [amount, setAmount] = useState<string>("");

  const validAccount = isAddress(account) ? (account as Address) : undefined;
  const validAmount =
    amount.length > 0 && Number(amount) > 0 ? parseUnits(amount, addresses.collateralDecimals) : undefined;
  const canSubmit = isConnected && isOnExpectedChain && validAccount && validAmount !== undefined;

  const mutation = useDeposit();

  /** Dry-run `depositForAccount` before sending. */
  const simulate = useSimulateDeposit();

  return (
    <MethodCard
      testId="method-depositForAccount"
      name="depositForAccount"
      mutability="nonpayable"
      description="Deposit collateral into a subaccount's available balance. Requires a prior approveCollateral."
    >
      <SubAccountField
        idPrefix="deposit-account"
        label="account (subaccount address)"
        value={account}
        onValueChange={(next) => {
          setAccount(next);
          mutation.reset();
        }}
        invalid={account.length > 0 && !validAccount}
      />

      <Field label={`amount (${addresses.collateralDecimals}-decimal collateral units)`} htmlFor="input-deposit-amount">
        <Input
          id="input-deposit-amount"
          data-testid="input-deposit-amount"
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
          data-testid="button-simulate-deposit"
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
          data-testid="button-send-deposit"
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
        testId="result-simulate-depositForAccount"
      />

      <WritePanel mutation={mutation} />
    </MethodCard>
  );
}

function WritePanel({ mutation }: { mutation: ReturnType<typeof useDeposit> }) {
  if (mutation.isPending) {
    return (
      <ResultNote testId="result-depositForAccount-pending" loading>
        Submitting transaction… waiting for wallet, then receipt.
      </ResultNote>
    );
  }
  if (mutation.error) {
    return (
      <ResultError
        testId="result-depositForAccount-error"
        kind={mutation.error.kind}
        message={mutation.error.message}
      />
    );
  }
  if (mutation.isSuccess) {
    return (
      <ResultSuccess testId="result-depositForAccount-success">
        <span className="text-foreground">Deposited.</span>
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
  return <ResultNote testId="result-depositForAccount-idle">Fill the fields above and submit.</ResultNote>;
}
