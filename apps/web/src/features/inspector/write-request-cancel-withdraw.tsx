"use client";

import { Field } from "@/components/field";
import { ResultError, ResultNote, ResultSuccess } from "@/components/result";
import { TxReceipt } from "@/components/tx-result";
import { accountLayerAbi, symmioAbi } from "@symm-frontier/core";
import {
  normalizeSymmError,
  useRequestCancelWithdraw,
  useSymmioConfig,
  useWalletAccount,
  type SymmioRequestError,
} from "@symm-frontier/react";
import { Button } from "@symm-frontier/ui/components/button";
import { Input } from "@symm-frontier/ui/components/input";
import { Spinner } from "@symm-frontier/ui/components/spinner";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { encodeFunctionData, isAddress, type Address } from "viem";

import { MethodCard } from "./method-card";
import { SimulateResult } from "./simulate-result";

function parseRequestId(value: string): bigint | undefined {
  if (!/^\d+$/.test(value.trim())) return undefined;
  return BigInt(value.trim());
}

export function WriteRequestCancelWithdraw() {
  const { address, chainId, isConnected, isOnExpectedChain } = useWalletAccount();
  const config = useSymmioConfig();
  const { addresses } = config.getChainConfig();
  const [account, setAccount] = useState<string>("");
  const [requestId, setRequestId] = useState<string>("");

  const validAccount = isAddress(account) ? (account as Address) : undefined;
  const validRequestId = parseRequestId(requestId);
  const canSubmit = isConnected && isOnExpectedChain && validAccount && validRequestId !== undefined;

  const mutation = useRequestCancelWithdraw();

  /** Dry-run the AccountLayer `_call` wrapping the core `requestCancelWithdraw`. */
  const simulate = useMutation<void, SymmioRequestError, { account: Address; requestId: bigint }>({
    mutationFn: async (variables) => {
      try {
        const data = encodeFunctionData({
          abi: symmioAbi,
          functionName: "requestCancelWithdraw",
          args: [variables.requestId],
        });
        await config.getClient({ chainId }).simulateContract({
          address: addresses.accountLayerAddress,
          abi: accountLayerAbi,
          functionName: "_call",
          args: [variables.account, [data]],
          account: address,
        });
      } catch (err) {
        throw normalizeSymmError(err);
      }
    },
  });

  return (
    <MethodCard
      testId="method-requestCancelWithdraw"
      name="requestCancelWithdraw"
      mutability="nonpayable"
      description="Cancel a pending withdraw request for a subaccount (routed via AccountLayer _call)."
    >
      <Field label="account (subaccount address)" htmlFor="input-cancel-account">
        <Input
          id="input-cancel-account"
          data-testid="input-cancel-account"
          value={account}
          onChange={(e) => {
            setAccount(e.target.value);
            simulate.reset();
            mutation.reset();
          }}
          placeholder="0x…"
          className="font-mono"
          aria-invalid={account.length > 0 && !validAccount}
        />
      </Field>

      <Field label="requestId" htmlFor="input-cancel-request-id">
        <Input
          id="input-cancel-request-id"
          data-testid="input-cancel-request-id"
          value={requestId}
          onChange={(e) => {
            setRequestId(e.target.value);
            simulate.reset();
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
            if (!validAccount || validRequestId === undefined) return;
            simulate.mutate({ account: validAccount, requestId: validRequestId });
          }}
          data-testid="button-simulate-cancel"
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
        isPending={simulate.isPending}
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
