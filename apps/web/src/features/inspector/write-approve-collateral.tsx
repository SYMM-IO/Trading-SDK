"use client";

import { Field } from "@/components/field";
import { ResultError, ResultNote, ResultSuccess } from "@/components/result";
import { TxReceipt } from "@/components/tx-result";
import {
  useApproveCollateral,
  useSimulateApproveCollateral,
  useSymmioConfig,
  useWalletAccount,
} from "@symm-frontier/react";
import { Button } from "@symm-frontier/ui/components/button";
import { Input } from "@symm-frontier/ui/components/input";
import { Spinner } from "@symm-frontier/ui/components/spinner";
import { useState } from "react";
import { parseUnits } from "viem";

import { MethodCard } from "./method-card";
import { SimulateResult } from "./simulate-result";

export function WriteApproveCollateral() {
  const { isConnected, isOnExpectedChain } = useWalletAccount();
  const config = useSymmioConfig();
  const { addresses } = config.getChainConfig();
  const [amount, setAmount] = useState<string>("");

  const validAmount =
    amount.length > 0 && Number(amount) > 0 ? parseUnits(amount, addresses.collateralDecimals) : undefined;
  const canSubmit = isConnected && isOnExpectedChain && validAmount !== undefined;

  const mutation = useApproveCollateral();

  /** Dry-run the ERC20 approve before sending. */
  const simulate = useSimulateApproveCollateral();

  return (
    <MethodCard
      testId="method-approveCollateral"
      name="approveCollateral"
      mutability="nonpayable"
      description="Approve the collateral token (USDC) for the SYMMIO core — the deposit prerequisite."
    >
      <Field
        label={`amount (${addresses.collateralDecimals}-decimal collateral units)`}
        htmlFor="input-approve-amount"
        hint="Approve at least the amount you plan to deposit."
      >
        <Input
          id="input-approve-amount"
          data-testid="input-approve-amount"
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
            if (validAmount === undefined) return;
            simulate.mutate({ amount: validAmount });
          }}
          data-testid="button-simulate-approve"
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
            if (validAmount === undefined) return;
            mutation.mutate({ amount: validAmount });
          }}
          data-testid="button-send-approve"
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
        testId="result-simulate-approveCollateral"
      />

      <WritePanel mutation={mutation} />
    </MethodCard>
  );
}

function WritePanel({ mutation }: { mutation: ReturnType<typeof useApproveCollateral> }) {
  if (mutation.isPending) {
    return (
      <ResultNote testId="result-approveCollateral-pending" loading>
        Submitting transaction… waiting for wallet, then receipt.
      </ResultNote>
    );
  }
  if (mutation.error) {
    return (
      <ResultError
        testId="result-approveCollateral-error"
        kind={mutation.error.kind}
        message={mutation.error.message}
      />
    );
  }
  if (mutation.isSuccess) {
    return (
      <ResultSuccess testId="result-approveCollateral-success">
        <span className="text-foreground">Approved.</span>
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
  return <ResultNote testId="result-approveCollateral-idle">Fill the amount above and submit.</ResultNote>;
}
