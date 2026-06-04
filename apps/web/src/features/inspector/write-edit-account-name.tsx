"use client";

import { Field } from "@/components/field";
import { ResultError, ResultNote, ResultSuccess } from "@/components/result";
import { TxReceipt } from "@/components/tx-result";
import { useEditAccountName, useWalletAccount } from "@symm-frontier/react";
import { Button } from "@symm-frontier/ui/components/button";
import { Input } from "@symm-frontier/ui/components/input";
import { Spinner } from "@symm-frontier/ui/components/spinner";
import { useState } from "react";
import type { Address } from "viem";
import { isAddress } from "viem";
import { MethodCard } from "./method-card";

export function WriteEditAccountName() {
  const { isConnected, isOnExpectedChain } = useWalletAccount();
  const [account, setAccount] = useState<string>("");
  const [name, setName] = useState<string>("");

  const validAccount = isAddress(account) ? (account as Address) : undefined;
  const canSubmit = isConnected && isOnExpectedChain && validAccount && name.length > 0;

  const mutation = useEditAccountName();

  return (
    <MethodCard
      testId="method-editAccountName"
      name="editAccountName"
      mutability="nonpayable"
      description="Rename one of the connected user's subaccounts."
    >
      <Field label="account (subaccount address)" htmlFor="input-subaccount-address">
        <Input
          id="input-subaccount-address"
          data-testid="input-subaccount-address"
          value={account}
          onChange={(e) => setAccount(e.target.value)}
          placeholder="0x…"
          className="font-mono"
          aria-invalid={account.length > 0 && !validAccount}
        />
      </Field>

      <Field label="name (new display name)" htmlFor="input-subaccount-name">
        <Input
          id="input-subaccount-name"
          data-testid="input-subaccount-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="My Trading Account"
        />
      </Field>

      <Button
        type="button"
        size="sm"
        disabled={!canSubmit || mutation.isPending}
        onClick={() => {
          if (!validAccount) return;
          mutation.mutate({ account: validAccount, name });
        }}
        data-testid="button-send-rename"
      >
        {mutation.isPending ? (
          <>
            <Spinner className="size-4" /> Sending…
          </>
        ) : (
          "Send transaction"
        )}
      </Button>

      <WritePanel mutation={mutation} />
    </MethodCard>
  );
}

function WritePanel({ mutation }: { mutation: ReturnType<typeof useEditAccountName> }) {
  if (mutation.isPending) {
    return (
      <ResultNote testId="result-editAccountName-pending" loading>
        Submitting transaction… waiting for wallet, then receipt.
      </ResultNote>
    );
  }
  if (mutation.error) {
    return (
      <ResultError testId="result-editAccountName-error" kind={mutation.error.kind} message={mutation.error.message} />
    );
  }
  if (mutation.isSuccess) {
    return (
      <ResultSuccess testId="result-editAccountName-success">
        <span className="text-foreground">Submitted.</span>
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
  return <ResultNote testId="result-editAccountName-idle">Fill the fields above and submit.</ResultNote>;
}
