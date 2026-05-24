"use client";

import { useUserSubAccounts, useWalletAccount } from "@symm-frontier/react";
import { shortenAddress } from "@symm-frontier/utils/address";
import { useEffect, useState } from "react";
import type { Address } from "viem";
import { isAddress } from "viem";
import { MethodCard } from "./method-card";

export function ReadGetUserSubAccounts() {
  const { address } = useWalletAccount();
  const [input, setInput] = useState<string>("");

  const candidate = (input || address || "") as string;
  const validAddress = isAddress(candidate) ? (candidate as Address) : undefined;

  const query = useUserSubAccounts({ user: validAddress });

  return (
    <MethodCard
      testId="method-getUserSubAccounts"
      name="getUserSubAccounts"
      mutability="view"
      description="List a user's subaccounts on AccountLayer."
    >
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">user (address)</span>
        <input
          data-testid="input-user-address"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={address ?? "0x…"}
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 font-mono text-sm shadow-inner focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        />
        <span className="mt-1 block text-xs text-zinc-500 dark:text-zinc-400">
          {validAddress
            ? `Reading subaccounts for ${shortenAddress(validAddress)}.`
            : "Enter a valid address (defaults to connected wallet)."}
        </span>
      </label>

      <button
        type="button"
        disabled={!validAddress || query.isFetching}
        onClick={() => void query.refetch()}
        data-testid="button-read-subaccounts"
        className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-60"
      >
        {query.isFetching ? "Reading…" : "Read"}
      </button>

      <ResultPanel testId="result-getUserSubAccounts" query={query} />
    </MethodCard>
  );
}

function ResultPanel({ testId, query }: { testId: string; query: ReturnType<typeof useUserSubAccounts> }) {
  if (query.isLoading) {
    return (
      <div data-testid={`${testId}-loading`} className="text-sm text-zinc-500 dark:text-zinc-400">
        Loading…
      </div>
    );
  }
  if (query.error) {
    return (
      <div
        data-testid={`${testId}-error`}
        className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
      >
        <span className="mr-2 inline-flex items-center rounded bg-red-100 px-1.5 py-0.5 font-mono text-xs text-red-700 dark:bg-red-900 dark:text-red-200">
          {query.error.kind}
        </span>
        {query.error.message}
      </div>
    );
  }
  if (!query.data) {
    return (
      <div data-testid={`${testId}-idle`} className="text-sm text-zinc-500 dark:text-zinc-400">
        Run the read to see subaccounts.
      </div>
    );
  }
  if (query.data.length === 0) {
    return (
      <div data-testid={`${testId}-empty`} className="text-sm text-zinc-500 dark:text-zinc-400">
        No subaccounts found for this address.
      </div>
    );
  }
  return (
    <div data-testid={`${testId}-data`} className="overflow-x-auto">
      <table className="w-full table-auto border-collapse text-sm">
        <thead>
          <tr className="border-b border-zinc-200 text-left text-xs font-medium tracking-wide text-zinc-500 uppercase dark:border-zinc-800 dark:text-zinc-400">
            <th className="py-2 pr-4">Account</th>
            <th className="py-2 pr-4">Name</th>
            <th className="py-2 pr-4">Isolation</th>
            <th className="py-2">Exists</th>
          </tr>
        </thead>
        <tbody>
          {query.data.map((sub) => (
            <tr
              key={sub.accountAddress}
              data-account-address={sub.accountAddress}
              className="border-b border-zinc-100 last:border-b-0 dark:border-zinc-900"
            >
              <td className="py-2 pr-4 font-mono text-zinc-950 dark:text-zinc-50">
                <span className="inline-flex items-center gap-2">
                  {shortenAddress(sub.accountAddress)}
                  <CopyAddressButton address={sub.accountAddress} />
                </span>
              </td>
              <td className="py-2 pr-4 text-zinc-800 dark:text-zinc-100">{sub.name}</td>
              <td className="py-2 pr-4 text-zinc-600 dark:text-zinc-400">{sub.isolationType}</td>
              <td className="py-2 text-zinc-600 dark:text-zinc-400">{String(sub.isExists)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CopyAddressButton(props: { address: Address }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(timer);
  }, [copied]);

  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(props.address);
        setCopied(true);
      }}
      aria-label={copied ? "Address copied" : `Copy ${props.address}`}
      title={copied ? "Copied" : "Copy address"}
      data-testid={`copy-address-${props.address}`}
      className="inline-flex h-6 w-6 items-center justify-center rounded text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
    >
      {copied ? (
        <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" aria-hidden>
          <path
            d="M3 8.5L6.5 12L13 4.5"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" aria-hidden>
          <rect x="5" y="5" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M3.5 10.5V4a1 1 0 0 1 1-1h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      )}
    </button>
  );
}
