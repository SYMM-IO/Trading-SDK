"use client";

import { useEditAccountName, useWalletAccount } from "@symm-frontier/react";
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
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
          account (subaccount address)
        </span>
        <input
          data-testid="input-subaccount-address"
          value={account}
          onChange={(e) => setAccount(e.target.value)}
          placeholder="0x…"
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 font-mono text-sm shadow-inner focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">name (new display name)</span>
        <input
          data-testid="input-subaccount-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="My Trading Account"
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-inner focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        />
      </label>

      <button
        type="button"
        disabled={!canSubmit || mutation.isPending}
        onClick={() => {
          if (!validAccount) return;
          mutation.mutate({ account: validAccount, name });
        }}
        data-testid="button-send-rename"
        className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-60"
      >
        {mutation.isPending ? "Sending…" : "Send transaction"}
      </button>

      <WritePanel mutation={mutation} />
    </MethodCard>
  );
}

function WritePanel({ mutation }: { mutation: ReturnType<typeof useEditAccountName> }) {
  if (mutation.isPending) {
    return (
      <div data-testid="result-editAccountName-pending" className="text-sm text-zinc-500 dark:text-zinc-400">
        Submitting transaction… waiting for wallet, then receipt.
      </div>
    );
  }
  if (mutation.error) {
    return (
      <div
        data-testid="result-editAccountName-error"
        className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
      >
        <span className="mr-2 inline-flex items-center rounded bg-red-100 px-1.5 py-0.5 font-mono text-xs text-red-700 dark:bg-red-900 dark:text-red-200">
          {mutation.error.kind}
        </span>
        {mutation.error.message}
      </div>
    );
  }
  if (mutation.isSuccess) {
    return (
      <div
        data-testid="result-editAccountName-success"
        className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
      >
        <div>Submitted.</div>
        <div className="mt-1 font-mono text-xs break-all">tx: {mutation.data.hash}</div>
        {mutation.data.receipt && (
          <div className="mt-1 text-xs">
            mined in block {String(mutation.data.receipt.blockNumber)} · status {mutation.data.receipt.status}
          </div>
        )}
      </div>
    );
  }
  return (
    <div data-testid="result-editAccountName-idle" className="text-sm text-zinc-500 dark:text-zinc-400">
      Fill the fields above and submit.
    </div>
  );
}
