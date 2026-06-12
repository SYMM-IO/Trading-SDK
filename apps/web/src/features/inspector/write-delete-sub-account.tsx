"use client";

import { ResultError, ResultNote, ResultSuccess } from "@/components/result";
import { TxReceipt } from "@/components/tx-result";
import { useDeleteSubAccount, useSimulateDeleteSubAccount, useWalletAccount } from "@symm-frontier/react";
import { Button } from "@symm-frontier/ui/components/button";
import { Spinner } from "@symm-frontier/ui/components/spinner";
import { useState } from "react";
import type { Address } from "viem";
import { isAddress } from "viem";
import { MethodCard } from "./method-card";
import { SimulateResult } from "./simulate-result";
import { SubAccountField } from "./subaccount-field";

/** Each maps to a contract revert; clear all four before a subaccount can be deleted. */
const PRECONDITIONS = [
  "No virtual accounts (delete them first)",
  "Zero free and allocated balance",
  "No open positions",
  "No pending quotes",
] as const;

export function WriteDeleteSubAccount() {
  const { isConnected, isOnExpectedChain } = useWalletAccount();
  const [account, setAccount] = useState<string>("");

  const validAccount = isAddress(account) ? (account as Address) : undefined;
  const canSubmit = isConnected && isOnExpectedChain && Boolean(validAccount);

  const mutation = useDeleteSubAccount();

  /** Dry-run the call (`simulateContract`) so the user sees pass/revert before sending. */
  const simulate = useSimulateDeleteSubAccount();

  return (
    <MethodCard
      testId="method-deleteSubAccount"
      name="deleteSubAccount"
      mutability="nonpayable"
      description="Permanently delete one of the connected wallet's subaccounts. Irreversible."
      wide
    >
      <SubAccountField
        idPrefix="delete-account"
        label="subAccount (address to delete)"
        value={account}
        onValueChange={setAccount}
        invalid={account.length > 0 && !validAccount}
      />

      <div className="border-border bg-muted/30 rounded-xl border px-3.5 py-3">
        <span className="text-muted-foreground text-[11px] font-medium tracking-wider uppercase">
          Requires before deletion
        </span>
        <ul className="text-muted-foreground mt-2 space-y-1 text-xs">
          {PRECONDITIONS.map((item) => (
            <li key={item} className="flex items-start gap-2">
              <DotIcon />
              {item}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!canSubmit || simulate.isPending}
          onClick={() => {
            if (!validAccount) return;
            simulate.mutate({ subAccount: validAccount });
          }}
          data-testid="button-simulate-delete"
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
          variant="destructive"
          disabled={!canSubmit || mutation.isPending}
          onClick={() => {
            if (!validAccount) return;
            mutation.mutate({ subAccount: validAccount });
          }}
          data-testid="button-send-delete"
        >
          {mutation.isPending ? (
            <>
              <Spinner className="size-4" /> Deleting…
            </>
          ) : (
            "Delete subaccount"
          )}
        </Button>
      </div>

      <SimulateResult
        isPending={simulate.isPending}
        isSuccess={simulate.isSuccess}
        error={simulate.error}
        testId="result-simulate-deleteSubAccount"
      />

      <WritePanel mutation={mutation} />
    </MethodCard>
  );
}

function WritePanel({ mutation }: { mutation: ReturnType<typeof useDeleteSubAccount> }) {
  if (mutation.isPending) {
    return (
      <ResultNote testId="result-deleteSubAccount-pending" loading>
        Submitting transaction… waiting for wallet, then receipt.
      </ResultNote>
    );
  }
  if (mutation.error) {
    return (
      <ResultError testId="result-deleteSubAccount-error" kind={mutation.error.kind} message={mutation.error.message} />
    );
  }
  if (mutation.isSuccess) {
    return (
      <ResultSuccess testId="result-deleteSubAccount-success">
        <span className="text-foreground">Submitted. The subaccount drops out of the list once mined.</span>
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
  return <ResultNote testId="result-deleteSubAccount-idle">Pick a subaccount, then delete.</ResultNote>;
}

function DotIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="mt-1 size-2.5 shrink-0" aria-hidden>
      <circle cx="8" cy="8" r="3" fill="currentColor" />
    </svg>
  );
}
