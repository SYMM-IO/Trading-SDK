"use client";

import { Field } from "@/components/field";
import { ResultError, ResultNote, ResultSuccess } from "@/components/result";
import { TxReceipt } from "@/components/tx-result";
import { createClassicWithdrawPart } from "@symm-frontier/core";
import {
  useInitiateWithdraw,
  useSimulateInitiateWithdraw,
  useSymmioConfig,
  useWalletAccount,
} from "@symm-frontier/react";
import { Button } from "@symm-frontier/ui/components/button";
import { Input } from "@symm-frontier/ui/components/input";
import { Spinner } from "@symm-frontier/ui/components/spinner";
import { useState } from "react";
import { isAddress, parseUnits, type Address } from "viem";

import { MethodCard } from "./method-card";
import { SimulateResult } from "./simulate-result";
import { SubAccountField } from "./subaccount-field";

export function WriteInitiateWithdraw() {
  const { address, chainId, isConnected, isOnExpectedChain } = useWalletAccount();
  const config = useSymmioConfig();
  const { addresses } = config.getChainConfig();
  const [account, setAccount] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [receiver, setReceiver] = useState<string>("");

  const validAccount = isAddress(account) ? (account as Address) : undefined;
  const validReceiver = isAddress(receiver) ? (receiver as Address) : undefined;
  const validAmount =
    amount.length > 0 && Number(amount) > 0 ? parseUnits(amount, addresses.collateralDecimals) : undefined;
  const canSubmit =
    isConnected &&
    isOnExpectedChain &&
    validAccount &&
    validReceiver &&
    validAmount !== undefined &&
    chainId !== undefined;

  const mutation = useInitiateWithdraw();

  const validParts =
    validReceiver && validAmount !== undefined && chainId !== undefined
      ? [createClassicWithdrawPart({ id: 0n, amount: validAmount, receiver: validReceiver, chainId: BigInt(chainId) })]
      : undefined;

  /** Dry-run the AccountLayer `_call` wrapping the core `initiateWithdraw`. */
  const simulate = useSimulateInitiateWithdraw({
    account: validAccount,
    parts: validParts,
    query: { enabled: false },
  });

  return (
    <MethodCard
      testId="method-initiateWithdraw"
      name="initiateWithdraw"
      mutability="nonpayable"
      description="Open a classic same-chain withdraw request for a subaccount (routed via AccountLayer _call)."
    >
      <SubAccountField
        idPrefix="withdraw-account"
        label="account (subaccount address)"
        value={account}
        onValueChange={(next) => {
          setAccount(next);
          mutation.reset();
        }}
        invalid={account.length > 0 && !validAccount}
      />

      <Field
        label={`amount (${addresses.collateralDecimals}-decimal collateral units)`}
        htmlFor="input-withdraw-amount"
      >
        <Input
          id="input-withdraw-amount"
          data-testid="input-withdraw-amount"
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

      <Field
        label="receiver (destination address)"
        htmlFor="input-withdraw-receiver"
        action={
          address ? (
            <Button type="button" size="xs" variant="ghost" onClick={() => setReceiver(address)}>
              Use wallet
            </Button>
          ) : undefined
        }
      >
        <Input
          id="input-withdraw-receiver"
          data-testid="input-withdraw-receiver"
          value={receiver}
          onChange={(e) => {
            setReceiver(e.target.value);
            mutation.reset();
          }}
          placeholder="0x…"
          className="font-mono"
          aria-invalid={receiver.length > 0 && !validReceiver}
        />
      </Field>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!canSubmit || simulate.isFetching}
          onClick={() => {
            if (!validAccount || !validReceiver || validAmount === undefined) return;
            simulate.refetch();
          }}
          data-testid="button-simulate-initiate-withdraw"
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
            if (!validAccount || !validReceiver || validAmount === undefined) return;
            const part = createClassicWithdrawPart({
              id: 0n,
              amount: validAmount,
              receiver: validReceiver,
              chainId: BigInt(chainId!),
            });
            mutation.mutate({ account: validAccount, parts: [part] });
          }}
          data-testid="button-send-initiate-withdraw"
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
        testId="result-simulate-initiateWithdraw"
      />

      <WritePanel mutation={mutation} />
    </MethodCard>
  );
}

function WritePanel({ mutation }: { mutation: ReturnType<typeof useInitiateWithdraw> }) {
  if (mutation.isPending) {
    return (
      <ResultNote testId="result-initiateWithdraw-pending" loading>
        Submitting transaction… waiting for wallet, then receipt.
      </ResultNote>
    );
  }
  if (mutation.error) {
    return (
      <ResultError testId="result-initiateWithdraw-error" kind={mutation.error.kind} message={mutation.error.message} />
    );
  }
  if (mutation.isSuccess) {
    return (
      <ResultSuccess testId="result-initiateWithdraw-success">
        <span className="text-foreground">Withdrawal initiated. Finalize it after the cooldown.</span>
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
  return <ResultNote testId="result-initiateWithdraw-idle">Fill the fields above and submit.</ResultNote>;
}
