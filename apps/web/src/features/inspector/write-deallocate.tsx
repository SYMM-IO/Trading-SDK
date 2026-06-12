"use client";

import { Field } from "@/components/field";
import { ResultError, ResultNote, ResultSuccess } from "@/components/result";
import { TxReceipt } from "@/components/tx-result";
import { useDeallocate, useDeallocateUpnlSig, useSimulateDeallocate, useWalletAccount } from "@symm-frontier/react";
import { Button } from "@symm-frontier/ui/components/button";
import { Input } from "@symm-frontier/ui/components/input";
import { Spinner } from "@symm-frontier/ui/components/spinner";
import { useState } from "react";
import { isAddress, parseUnits, type Address } from "viem";

import { MethodCard } from "./method-card";
import { SimulateResult } from "./simulate-result";
import { SubAccountField } from "./subaccount-field";

/** `deallocate` amounts are the SYMMIO core's internal 18-decimal margin units, not collateral-token decimals. */
const MARGIN_DECIMALS = 18;

export function WriteDeallocate() {
  const { isConnected, isOnExpectedChain } = useWalletAccount();
  const [account, setAccount] = useState<string>("");
  const [amount, setAmount] = useState<string>("");

  const validAccount = isAddress(account) ? (account as Address) : undefined;
  const validAmount = amount.length > 0 && Number(amount) > 0 ? parseUnits(amount, MARGIN_DECIMALS) : undefined;
  const canSubmit = isConnected && isOnExpectedChain && validAccount && validAmount !== undefined;

  const mutation = useDeallocate();

  /** Fetches the fresh Muon uPnL signature the simulate/dry-run needs. */
  const deallocateSig = useDeallocateUpnlSig();
  /** Dry-run `deallocate` (needs the fetched uPnL signature). */
  const simulate = useSimulateDeallocate();

  const onSimulate = async () => {
    if (!validAccount || validAmount === undefined) return;
    try {
      const upnlSig = await deallocateSig.mutateAsync({ virtualAccount: validAccount });
      simulate.mutate({ account: validAccount, amount: validAmount, upnlSig });
    } catch {
      // The Muon fetch failure is surfaced through `deallocateSig.error` below.
    }
  };

  const isSimulating = deallocateSig.isPending || simulate.isPending;

  return (
    <MethodCard
      testId="method-deallocate"
      name="deallocate"
      mutability="nonpayable"
      description="Move a subaccount's allocated (tradeable) balance back into its available balance (routed via AccountLayer _call). Sending fetches a fresh Muon uPnL signature automatically; subject to the on-chain deallocate debounce."
    >
      <SubAccountField
        idPrefix="deallocate-account"
        label="account (subaccount address)"
        value={account}
        onValueChange={(next) => {
          setAccount(next);
          mutation.reset();
        }}
        invalid={account.length > 0 && !validAccount}
      />

      <Field label="amount (18-decimal margin units)" htmlFor="input-deallocate-amount">
        <Input
          id="input-deallocate-amount"
          data-testid="input-deallocate-amount"
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
          data-testid="button-simulate-deallocate"
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
            if (!validAccount || validAmount === undefined) return;
            mutation.mutate({ account: validAccount, amount: validAmount });
          }}
          data-testid="button-send-deallocate"
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
        testId="result-simulate-deallocate"
      />

      <WritePanel mutation={mutation} />
    </MethodCard>
  );
}

function WritePanel({ mutation }: { mutation: ReturnType<typeof useDeallocate> }) {
  if (mutation.isPending) {
    return (
      <ResultNote testId="result-deallocate-pending" loading>
        Fetching the uPnL signature, then submitting… waiting for wallet, then receipt.
      </ResultNote>
    );
  }
  if (mutation.error) {
    return <ResultError testId="result-deallocate-error" kind={mutation.error.kind} message={mutation.error.message} />;
  }
  if (mutation.isSuccess) {
    return (
      <ResultSuccess testId="result-deallocate-success">
        <span className="text-foreground">Deallocated back to available balance.</span>
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
  return <ResultNote testId="result-deallocate-idle">Fill the fields above and submit.</ResultNote>;
}
