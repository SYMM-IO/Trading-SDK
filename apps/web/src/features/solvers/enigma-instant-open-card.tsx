"use client";

import { ResultNote } from "@/components/result";
import { OpenPositionStep } from "@/features/integration/open-position-step";
import { useSessionKey } from "@/features/session-keys/use-session-key";
import { Badge } from "@symm-frontier/ui/components/badge";
import { Button } from "@symm-frontier/ui/components/button";
import { cn } from "@symm-frontier/ui/lib/utils";
import Link from "next/link";
import { useState } from "react";
import type { Address } from "viem";
import { MethodCard } from "../inspector/method-card";
import { SubAccountPicker } from "../inspector/subaccount-picker";

interface SelectedSubAccount {
  subAccount?: Address;
  name?: string;
}

/**
 * Solvers-page wrapper around the shared {@link OpenPositionStep}. Gates the
 * shared form on a picked subaccount and an initialized session key — the two
 * inputs the form expects pre-resolved. The wizard in the Integration tab
 * gates the same form behind a multi-step rail; this card gates it inline.
 */
export function EnigmaInstantOpenCard() {
  const [selectedAccount, setSelectedAccount] = useState<SelectedSubAccount>({});
  const { sessionKeyAddress, owner: sessionKeyOwner } = useSessionKey();
  const ready = Boolean(selectedAccount.subAccount && sessionKeyAddress);

  return (
    <MethodCard
      testId="method-enigma-instant-open"
      name="instantOpen"
      mutability="nonpayable"
      description="Open a lowcap instant position via the InstantLayer v2 flow."
      wide
    >
      <SubAccountPicker
        idPrefix="enigma-instant-open-account"
        selected={selectedAccount}
        onSelect={setSelectedAccount}
        ownerLabel="owner"
        accountLabel="subaccount"
        accountEmptyHint="Select a subaccount or enter an address."
        selectedHintLabel="Subaccount"
      />

      <SessionKeyRow address={sessionKeyAddress} owner={sessionKeyOwner} />

      {ready ? (
        <OpenPositionStep
          subAccount={selectedAccount.subAccount!}
          sessionKey={sessionKeyAddress!}
          idPrefix="enigma-instant-open"
        />
      ) : (
        <ResultNote testId="enigma-instant-open-gate">
          {!selectedAccount.subAccount
            ? "Pick a subaccount to continue."
            : "Initialize a session key to continue."}
        </ResultNote>
      )}
    </MethodCard>
  );
}

function SessionKeyRow({ address, owner }: { address: Address | null | undefined; owner: Address | undefined }) {
  const ready = Boolean(address);

  return (
    <div
      data-testid="enigma-instant-open-session-key"
      className="border-border/70 bg-muted/20 flex flex-wrap items-center gap-3 rounded-xl border p-3 text-sm"
    >
      <span className={cn("size-2 rounded-full", ready ? "bg-positive" : "bg-warning")} aria-hidden />
      <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">sessionKey</span>
      <Badge variant={ready ? "positive" : "warning"} className="tracking-wide uppercase">
        {ready ? "ready" : "missing"}
      </Badge>

      {ready ? (
        <span
          className="text-foreground ml-auto max-w-[60%] truncate font-mono"
          data-testid="enigma-instant-open-session-key-address"
        >
          {address}
        </span>
      ) : (
        <span className="text-muted-foreground ml-auto inline-flex items-center gap-2">
          {owner ? "Not initialized for the connected wallet." : "Connect a wallet to initialize."}
          <Button asChild type="button" size="sm" variant="ghost" disabled={!owner}>
            <Link href="/session-keys" data-testid="enigma-instant-open-session-key-init">
              Initialize
            </Link>
          </Button>
        </span>
      )}
    </div>
  );
}
