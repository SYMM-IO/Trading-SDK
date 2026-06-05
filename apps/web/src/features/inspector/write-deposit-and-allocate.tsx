"use client";

import { Field } from "@/components/field";
import { ResultError, ResultNote, ResultSuccess } from "@/components/result";
import { TxReceipt } from "@/components/tx-result";
import { accountLayerAbi } from "@symm-frontier/core";
import {
  normalizeSymmError,
  useDepositAndAllocate,
  useSymmioConfig,
  useWalletAccount,
  type SymmioRequestError,
} from "@symm-frontier/react";
import { Button } from "@symm-frontier/ui/components/button";
import { Input } from "@symm-frontier/ui/components/input";
import { Spinner } from "@symm-frontier/ui/components/spinner";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { isAddress, parseUnits, type Address } from "viem";

import { MethodCard } from "./method-card";
import { SimulateResult } from "./simulate-result";

export function WriteDepositAndAllocate() {
  const { address, chainId, isConnected, isOnExpectedChain } = useWalletAccount();
  const config = useSymmioConfig();
  const { addresses } = config.getChainConfig();
  const [account, setAccount] = useState<string>("");
  const [amount, setAmount] = useState<string>("");

  const validAccount = isAddress(account) ? (account as Address) : undefined;
  const validAmount =
    amount.length > 0 && Number(amount) > 0 ? parseUnits(amount, addresses.collateralDecimals) : undefined;
  const canSubmit = isConnected && isOnExpectedChain && validAccount && validAmount !== undefined;

  const mutation = useDepositAndAllocate();

  /** Dry-run `depositAndAllocateForAccount` before sending. */
  const simulate = useMutation<void, SymmioRequestError, { account: Address; amount: bigint }>({
    mutationFn: async (variables) => {
      try {
        await config.getClient({ chainId }).simulateContract({
          address: addresses.accountLayerAddress,
          abi: accountLayerAbi,
          functionName: "depositAndAllocateForAccount",
          args: [variables.account, variables.amount],
          account: address,
        });
      } catch (err) {
        throw normalizeSymmError(err);
      }
    },
  });

  return (
    <MethodCard
      testId="method-depositAndAllocateForAccount"
      name="depositAndAllocateForAccount"
      mutability="nonpayable"
      description="Deposit collateral and allocate it into trading margin in one transaction."
    >
      <Field label="account (subaccount address)" htmlFor="input-deposit-allocate-account">
        <Input
          id="input-deposit-allocate-account"
          data-testid="input-deposit-allocate-account"
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

      <Field
        label={`amount (${addresses.collateralDecimals}-decimal collateral units)`}
        htmlFor="input-deposit-allocate-amount"
      >
        <Input
          id="input-deposit-allocate-amount"
          data-testid="input-deposit-allocate-amount"
          value={amount}
          onChange={(e) => {
            setAmount(e.target.value);
            simulate.reset();
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
          data-testid="button-simulate-deposit-allocate"
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
          data-testid="button-send-deposit-allocate"
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
        testId="result-simulate-depositAndAllocateForAccount"
      />

      <WritePanel mutation={mutation} />
    </MethodCard>
  );
}

function WritePanel({ mutation }: { mutation: ReturnType<typeof useDepositAndAllocate> }) {
  if (mutation.isPending) {
    return (
      <ResultNote testId="result-depositAndAllocateForAccount-pending" loading>
        Submitting transaction… waiting for wallet, then receipt.
      </ResultNote>
    );
  }
  if (mutation.error) {
    return (
      <ResultError
        testId="result-depositAndAllocateForAccount-error"
        kind={mutation.error.kind}
        message={mutation.error.message}
      />
    );
  }
  if (mutation.isSuccess) {
    return (
      <ResultSuccess testId="result-depositAndAllocateForAccount-success">
        <span className="text-foreground">Deposited and allocated.</span>
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
  return <ResultNote testId="result-depositAndAllocateForAccount-idle">Fill the fields above and submit.</ResultNote>;
}
