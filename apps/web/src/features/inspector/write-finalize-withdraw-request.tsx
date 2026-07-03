"use client";

import { Field } from "@/components/field";
import { ResultError, ResultNote, ResultSuccess } from "@/components/result";
import { TxReceipt } from "@/components/tx-result";
import {
  useFinalizeWithdrawRequest,
  useSimulateFinalizeWithdrawRequest,
  useWalletAccount,
} from "@symmio/trading-react";
import { Button } from "@symmio/ui/components/button";
import { Input } from "@symmio/ui/components/input";
import { Spinner } from "@symmio/ui/components/spinner";
import { useState } from "react";
import { isAddress, type Address } from "viem";

import { MethodCard } from "./method-card";
import { SimulateResult } from "./simulate-result";
import { SubAccountField } from "./subaccount-field";

function parseRequestId(value: string): bigint | undefined {
  if (!/^\d+$/.test(value.trim())) return undefined;
  return BigInt(value.trim());
}

export function WriteFinalizeWithdrawRequest() {
  const { isConnected, isOnExpectedChain } = useWalletAccount();
  const [user, setUser] = useState<string>("");
  const [requestId, setRequestId] = useState<string>("");

  const validUser = isAddress(user) ? (user as Address) : undefined;
  const validRequestId = parseRequestId(requestId);
  const canSubmit = isConnected && isOnExpectedChain && validUser && validRequestId !== undefined;

  const mutation = useFinalizeWithdrawRequest();

  /** Dry-run `finalizeWithdrawRequest` directly on the SYMMIO core. */
  const simulate = useSimulateFinalizeWithdrawRequest();

  return (
    <MethodCard
      testId="method-finalizeWithdrawRequest"
      name="finalizeWithdrawRequest"
      mutability="nonpayable"
      description="Finalize a matured withdraw request, paying out to its receivers. Permissionless after cooldown."
    >
      <SubAccountField
        idPrefix="finalize-user"
        label="user (subaccount address)"
        value={user}
        onValueChange={(next) => {
          setUser(next);
          mutation.reset();
        }}
        invalid={user.length > 0 && !validUser}
      />

      <Field label="requestId" htmlFor="input-finalize-request-id">
        <Input
          id="input-finalize-request-id"
          data-testid="input-finalize-request-id"
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
          disabled={!canSubmit || simulate.isPending}
          onClick={() => {
            if (!validUser || validRequestId === undefined) return;
            simulate.mutate({ user: validUser, requestId: validRequestId });
          }}
          data-testid="button-simulate-finalize"
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
            if (!validUser || validRequestId === undefined) return;
            mutation.mutate({ user: validUser, requestId: validRequestId });
          }}
          data-testid="button-send-finalize"
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
        testId="result-simulate-finalizeWithdrawRequest"
      />

      <WritePanel mutation={mutation} />
    </MethodCard>
  );
}

function WritePanel({ mutation }: { mutation: ReturnType<typeof useFinalizeWithdrawRequest> }) {
  if (mutation.isPending) {
    return (
      <ResultNote testId="result-finalizeWithdrawRequest-pending" loading>
        Submitting transaction… waiting for wallet, then receipt.
      </ResultNote>
    );
  }
  if (mutation.error) {
    return (
      <ResultError
        testId="result-finalizeWithdrawRequest-error"
        kind={mutation.error.kind}
        message={mutation.error.message}
      />
    );
  }
  if (mutation.isSuccess) {
    return (
      <ResultSuccess testId="result-finalizeWithdrawRequest-success">
        <span className="text-foreground">Withdrawal finalized.</span>
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
  return <ResultNote testId="result-finalizeWithdrawRequest-idle">Fill the fields above and submit.</ResultNote>;
}
