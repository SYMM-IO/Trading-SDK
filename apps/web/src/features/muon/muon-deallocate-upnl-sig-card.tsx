"use client";

import { useDeallocateUpnlSig } from "@theoldvarorg/react";
import { Button } from "@theoldvarorg/ui/components/button";
import { Spinner } from "@theoldvarorg/ui/components/spinner";
import { useState } from "react";
import { isAddress, type Address } from "viem";
import { VirtualAccountField } from "../inspector/virtual-account-field";
import { MuonResultPanel } from "./muon-result";
import { MuonServiceCard } from "./muon-service-card";

/**
 * Muon `uPnl_A` assembled into the contract-ready `SingleUpnlSig`. Same method as
 * {@link MuonUpnlACard}, but returns the tuple `removeMargin` / `deallocate`
 * consumes rather than the raw attestation.
 */
export function MuonDeallocateUpnlSigCard() {
  const [virtualAccount, setVirtualAccount] = useState("");
  const validVa = isAddress(virtualAccount) ? (virtualAccount as Address) : undefined;
  const mutation = useDeallocateUpnlSig();

  return (
    <MuonServiceCard
      testId="muon-deallocate-upnl-sig"
      method="uPnl_A → SingleUpnlSig"
      description="The uPnl_A attestation assembled into the contract-ready SingleUpnlSig that removeMargin / deallocate requires. partyA is the virtual account."
    >
      <VirtualAccountField
        idPrefix="muon-deallocate-upnl-sig-va"
        label="virtualAccount (VA address)"
        hint="The Muon partyA the uPnL attestation is for. The signature is short-lived — fetch it immediately before a removeMargin."
        value={virtualAccount}
        onValueChange={(next) => {
          setVirtualAccount(next);
          mutation.reset();
        }}
        invalid={virtualAccount.length > 0 && !validVa}
      />

      <Button
        type="button"
        size="sm"
        disabled={!validVa || mutation.isPending}
        onClick={() => {
          if (!validVa) return;
          mutation.mutate({ virtualAccount: validVa });
        }}
        data-testid="button-fetch-muon-deallocate-upnl-sig"
      >
        {mutation.isPending ? (
          <>
            <Spinner className="size-4" /> Fetching…
          </>
        ) : (
          "Fetch signature"
        )}
      </Button>

      <MuonResultPanel
        testId="result-muon-deallocate-upnl-sig"
        mutation={mutation}
        idleHint="Enter a virtual account and fetch its contract-ready uPnL signature."
      />
    </MuonServiceCard>
  );
}
