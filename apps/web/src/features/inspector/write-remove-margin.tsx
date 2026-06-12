"use client";

import { Field } from "@/components/field";
import { ResultError, ResultNote, ResultSuccess } from "@/components/result";
import { TxReceipt } from "@/components/tx-result";
import { useDeallocateUpnlSig, useRemoveMargin, useSimulateRemoveMargin, useWalletAccount } from "@symm-frontier/react";
import { Button } from "@symm-frontier/ui/components/button";
import { Input } from "@symm-frontier/ui/components/input";
import { Spinner } from "@symm-frontier/ui/components/spinner";
import { useState } from "react";
import { isAddress, parseUnits, type Address } from "viem";

import { MethodCard } from "./method-card";
import { SimulateResult } from "./simulate-result";
import { VirtualAccountField } from "./virtual-account-field";

/** `removeMargin` amounts are the SYMMIO core's internal 18-decimal margin units, not collateral-token decimals. */
const MARGIN_DECIMALS = 18;

export function WriteRemoveMargin() {
  const { isConnected, isOnExpectedChain } = useWalletAccount();
  const [virtualAccount, setVirtualAccount] = useState<string>("");
  const [amount, setAmount] = useState<string>("");

  const validVa = isAddress(virtualAccount) ? (virtualAccount as Address) : undefined;
  const validAmount = amount.length > 0 && Number(amount) > 0 ? parseUnits(amount, MARGIN_DECIMALS) : undefined;
  const canSubmit = isConnected && isOnExpectedChain && validVa && validAmount !== undefined;

  const mutation = useRemoveMargin();

  /** Fetches the fresh Muon uPnL signature the simulate/dry-run needs. */
  const deallocateSig = useDeallocateUpnlSig();
  /** Dry-run `removeMargin` (needs the fetched uPnL signature). */
  const simulate = useSimulateRemoveMargin();

  const onSimulate = async () => {
    if (!validVa || validAmount === undefined) return;
    try {
      const upnlSig = await deallocateSig.mutateAsync({ virtualAccount: validVa });
      simulate.mutate({ virtualAccount: validVa, amount: validAmount, upnlSig });
    } catch {
      // The Muon fetch failure is surfaced through `deallocateSig.error` below.
    }
  };

  const isSimulating = deallocateSig.isPending || simulate.isPending;

  return (
    <MethodCard
      testId="method-removeMargin"
      name="removeMargin"
      mutability="nonpayable"
      description="Remove margin from a virtual account (deallocate). Sending fetches a fresh Muon uPnL signature automatically; subject to the on-chain deallocate debounce."
    >
      <VirtualAccountField
        idPrefix="remove-margin-va"
        label="virtualAccount (VA address)"
        value={virtualAccount}
        onValueChange={(next) => {
          setVirtualAccount(next);
          mutation.reset();
        }}
        invalid={virtualAccount.length > 0 && !validVa}
      />

      <Field label="amount (18-decimal margin units)" htmlFor="input-remove-margin-amount">
        <Input
          id="input-remove-margin-amount"
          data-testid="input-remove-margin-amount"
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
          disabled={!canSubmit || isSimulating}
          onClick={() => void onSimulate()}
          data-testid="button-simulate-remove-margin"
        >
          {deallocateSig.isPending ? (
            <>
              <Spinner className="size-4" /> Fetching uPnL sig…
            </>
          ) : simulate.isPending ? (
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
          data-testid="button-send-remove-margin"
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
        isPending={isSimulating}
        isSuccess={simulate.isSuccess}
        error={deallocateSig.error ?? simulate.error}
        testId="result-simulate-removeMargin"
      />

      <WritePanel mutation={mutation} />
    </MethodCard>
  );
}

function WritePanel({ mutation }: { mutation: ReturnType<typeof useRemoveMargin> }) {
  if (mutation.isPending) {
    return (
      <ResultNote testId="result-removeMargin-pending" loading>
        Fetching the uPnL signature, then submitting… waiting for wallet, then receipt.
      </ResultNote>
    );
  }
  if (mutation.error) {
    return (
      <ResultError testId="result-removeMargin-error" kind={mutation.error.kind} message={mutation.error.message} />
    );
  }
  if (mutation.isSuccess) {
    return (
      <ResultSuccess testId="result-removeMargin-success">
        <span className="text-foreground">Margin removed from the virtual account.</span>
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
  return <ResultNote testId="result-removeMargin-idle">Fill the fields above and submit.</ResultNote>;
}
