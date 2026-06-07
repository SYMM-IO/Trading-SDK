"use client";

import { Field } from "@/components/field";
import { ResultError, ResultNote, ResultSuccess } from "@/components/result";
import { TxReceipt } from "@/components/tx-result";
import { useRequestCancelWithdraw, useSimulateRequestCancelWithdraw, useWalletAccount } from "@symm-frontier/react";
import { Button } from "@symm-frontier/ui/components/button";
import { Input } from "@symm-frontier/ui/components/input";
import { Spinner } from "@symm-frontier/ui/components/spinner";
import { useState } from "react";
import { isAddress, type Address } from "viem";

import { MethodCard } from "./method-card";
import { SimulateResult } from "./simulate-result";
import { SubAccountField } from "./subaccount-field";

function parseRequestId(value: string): bigint | undefined {
  if (!/^\d+$/.test(value.trim())) return undefined;
  return BigInt(value.trim());
}

export function WriteRequestCancelWithdraw() {
  const { isConnected, isOnExpectedChain } = useWalletAccount();
  const [account, setAccount] = useState<string>("");
  const [requestId, setRequestId] = useState<string>("");

  const validAccount = isAddress(account) ? (account as Address) : undefined;
  const validRequestId = parseRequestId(requestId);
  const canSubmit = isConnected && isOnExpectedChain && validAccount && validRequestId !== undefined;

  const mutation = useRequestCancelWithdraw();

  const simulate = useSimulateRequestCancelWithdraw({
    account: validAccount,
    requestId: validRequestId,
    query: { enabled: false },
  });

  return (
    <MethodCard
      testId="method-requestCancelWithdraw"
      name="requestCancelWithdraw"
      mutability="nonpayable"
      description="Cancel a pending withdraw request for a subaccount (routed via AccountLayer _call)."
    >
      <SubAccountField
        idPrefix="cancel-account"
        label="account (subaccount address)"
        value={account}
        onValueChange={(next) => {
          setAccount(next);
          mutation.reset();
        }}
        invalid={account.length > 0 && !validAccount}
      />

      <Field label="requestId" htmlFor="input-cancel-request-id">
        <Input
          id="input-cancel-request-id"
          data-testid="input-cancel-request-id"
          value={requestId}
          onChange={(e) => {
            setRequestId(e.target.value);
            mutation.reset();
          }}
          placeholder="1"
          inputMode="numeric"
          aria-invalid={requestId.length > 0 && validRequestId === undefined}
        />
      </Field>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!canSubmit || simulate.isFetching}
          onClick={() => {
            if (!validAccount || validRequestId === undefined) return;
            simulate.refetch();
          }}
          data-testid="button-simulate-cancel"
        >
          {simulate.isFetching ? (
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
            if (!validAccount || validRequestId === undefined) return;
            mutation.mutate({ account: validAccount, requestId: validRequestId });
          }}
          data-testid="button-send-cancel"
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
        isPending={simulate.isFetching}
        isSuccess={simulate.isSuccess}
        error={simulate.error}
        testId="result-simulate-requestCancelWithdraw"
      />

      <WritePanel mutation={mutation} />
    </MethodCard>
  );
}

function WritePanel({ mutation }: { mutation: ReturnType<typeof useRequestCancelWithdraw> }) {
  if (mutation.isPending) {
    return (
      <ResultNote testId="result-requestCancelWithdraw-pending" loading>
        Submitting transaction… waiting for wallet, then receipt.
      </ResultNote>
    );
  }
  if (mutation.error) {
    return (
      <ResultError
        testId="result-requestCancelWithdraw-error"
        kind={mutation.error.kind}
        message={mutation.error.message}
      />
    );
  }
  if (mutation.isSuccess) {
    return (
      <ResultSuccess testId="result-requestCancelWithdraw-success">
        <span className="text-foreground">Cancellation requested.</span>
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
  return <ResultNote testId="result-requestCancelWithdraw-idle">Fill the fields above and submit.</ResultNote>;
}
