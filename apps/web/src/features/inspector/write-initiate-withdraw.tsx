"use client";

import { Field } from "@/components/field";
import { ResultError, ResultNote, ResultSuccess } from "@/components/result";
import { TxReceipt } from "@/components/tx-result";
import { accountLayerAbi, createClassicWithdrawPart, symmioAbi } from "@symm-frontier/core";
import {
  normalizeSymmError,
  useInitiateWithdraw,
  useSymmioConfig,
  useWalletAccount,
  type SymmioRequestError,
} from "@symm-frontier/react";
import { Button } from "@symm-frontier/ui/components/button";
import { Input } from "@symm-frontier/ui/components/input";
import { Spinner } from "@symm-frontier/ui/components/spinner";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { encodeFunctionData, isAddress, parseUnits, type Address } from "viem";

import { MethodCard } from "./method-card";
import { SimulateResult } from "./simulate-result";

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

  /** Dry-run the AccountLayer `_call` wrapping the core `initiateWithdraw`. */
  const simulate = useMutation<void, SymmioRequestError, { account: Address; amount: bigint; receiver: Address }>({
    mutationFn: async (variables) => {
      try {
        const part = createClassicWithdrawPart({
          id: 0n,
          amount: variables.amount,
          receiver: variables.receiver,
          chainId: BigInt(chainId!),
        });
        const data = encodeFunctionData({
          abi: symmioAbi,
          functionName: "initiateWithdraw",
          args: [[part], false, "0x"],
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
      testId="method-initiateWithdraw"
      name="initiateWithdraw"
      mutability="nonpayable"
      description="Open a classic same-chain withdraw request for a subaccount (routed via AccountLayer _call)."
    >
      <Field label="account (subaccount address)" htmlFor="input-withdraw-account">
        <Input
          id="input-withdraw-account"
          data-testid="input-withdraw-account"
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
        htmlFor="input-withdraw-amount"
      >
        <Input
          id="input-withdraw-amount"
          data-testid="input-withdraw-amount"
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
            simulate.reset();
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
          disabled={!canSubmit || simulate.isPending}
          onClick={() => {
            if (!validAccount || !validReceiver || validAmount === undefined) return;
            simulate.mutate({ account: validAccount, amount: validAmount, receiver: validReceiver });
          }}
          data-testid="button-simulate-initiate-withdraw"
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
        isPending={simulate.isPending}
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
