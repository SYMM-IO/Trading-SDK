"use client";

import { useEditAccountName, useWalletAccount } from "@symm-frontier/react";
import { Badge } from "@symm-frontier/ui/components/badge";
import { Button } from "@symm-frontier/ui/components/button";
import { Input } from "@symm-frontier/ui/components/input";
import { Label } from "@symm-frontier/ui/components/label";
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
      <div className="space-y-2">
        <Label htmlFor="input-subaccount-address">account (subaccount address)</Label>
        <Input
          id="input-subaccount-address"
          data-testid="input-subaccount-address"
          value={account}
          onChange={(e) => setAccount(e.target.value)}
          placeholder="0x…"
          className="font-mono"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="input-subaccount-name">name (new display name)</Label>
        <Input
          id="input-subaccount-name"
          data-testid="input-subaccount-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="My Trading Account"
        />
      </div>

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
        {mutation.isPending ? "Sending…" : "Send transaction"}
      </Button>

      <WritePanel mutation={mutation} />
    </MethodCard>
  );
}

function WritePanel({ mutation }: { mutation: ReturnType<typeof useEditAccountName> }) {
  if (mutation.isPending) {
    return (
      <div data-testid="result-editAccountName-pending" className="text-muted-foreground text-sm">
        Submitting transaction… waiting for wallet, then receipt.
      </div>
    );
  }
  if (mutation.error) {
    return (
      <div
        data-testid="result-editAccountName-error"
        className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm"
      >
        <Badge variant="destructive" className="mr-2 font-mono">
          {mutation.error.kind}
        </Badge>
        {mutation.error.message}
      </div>
    );
  }
  if (mutation.isSuccess) {
    return (
      <div
        data-testid="result-editAccountName-success"
        className="border-primary/30 bg-primary/10 text-primary rounded-md border px-3 py-2 text-sm"
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
    <div data-testid="result-editAccountName-idle" className="text-muted-foreground text-sm">
      Fill the fields above and submit.
    </div>
  );
}
