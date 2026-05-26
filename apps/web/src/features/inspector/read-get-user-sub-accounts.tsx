"use client";

import { useUserSubAccounts, useWalletAccount } from "@symm-frontier/react";
import { Badge } from "@symm-frontier/ui/components/badge";
import { Button } from "@symm-frontier/ui/components/button";
import { Input } from "@symm-frontier/ui/components/input";
import { Label } from "@symm-frontier/ui/components/label";
import { shortenAddress } from "@symm-frontier/utils";
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
      <div className="space-y-2">
        <Label htmlFor="input-user-address">user (address)</Label>
        <Input
          id="input-user-address"
          data-testid="input-user-address"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={address ?? "0x…"}
          className="font-mono"
        />
        <p className="text-muted-foreground text-xs">
          {validAddress
            ? `Reading subaccounts for ${shortenAddress(validAddress)}.`
            : "Enter a valid address (defaults to connected wallet)."}
        </p>
      </div>

      <Button
        type="button"
        size="sm"
        disabled={!validAddress || query.isFetching}
        onClick={() => void query.refetch()}
        data-testid="button-read-subaccounts"
      >
        {query.isFetching ? "Reading…" : "Read"}
      </Button>

      <ResultPanel testId="result-getUserSubAccounts" query={query} />
    </MethodCard>
  );
}

function ResultPanel({ testId, query }: { testId: string; query: ReturnType<typeof useUserSubAccounts> }) {
  if (query.isLoading) {
    return (
      <div data-testid={`${testId}-loading`} className="text-muted-foreground text-sm">
        Loading…
      </div>
    );
  }
  if (query.error) {
    return (
      <div
        data-testid={`${testId}-error`}
        className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm"
      >
        <Badge variant="destructive" className="mr-2 font-mono">
          {query.error.kind}
        </Badge>
        {query.error.message}
      </div>
    );
  }
  if (!query.data) {
    return (
      <div data-testid={`${testId}-idle`} className="text-muted-foreground text-sm">
        Run the read to see subaccounts.
      </div>
    );
  }
  if (query.data.length === 0) {
    return (
      <div data-testid={`${testId}-empty`} className="text-muted-foreground text-sm">
        No subaccounts found for this address.
      </div>
    );
  }
  return (
    <div data-testid={`${testId}-data`} className="overflow-x-auto">
      <table className="w-full table-auto border-collapse text-sm">
        <thead>
          <tr className="border-border text-muted-foreground border-b text-left text-xs font-medium tracking-wide uppercase">
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
              className="border-border/50 border-b last:border-b-0"
            >
              <td className="text-foreground py-2 pr-4 font-mono">
                <span className="inline-flex items-center gap-2">
                  {shortenAddress(sub.accountAddress)}
                  <CopyAddressButton address={sub.accountAddress} />
                </span>
              </td>
              <td className="text-foreground py-2 pr-4">{sub.name}</td>
              <td className="text-muted-foreground py-2 pr-4">{sub.isolationType}</td>
              <td className="text-muted-foreground py-2">{String(sub.isExists)}</td>
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
      className="text-muted-foreground hover:bg-muted hover:text-foreground inline-flex h-6 w-6 items-center justify-center rounded"
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
