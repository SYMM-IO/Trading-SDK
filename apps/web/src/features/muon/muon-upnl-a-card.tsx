"use client";

import { useMuonUpnlA } from "@theoldvarorg/react";
import { Button } from "@theoldvarorg/ui/components/button";
import { Spinner } from "@theoldvarorg/ui/components/spinner";
import { useState } from "react";
import { isAddress, type Address } from "viem";
import { PartyAField } from "../inspector/party-a-field";
import { MuonResultPanel } from "./muon-result";
import { MuonServiceCard } from "./muon-service-card";

/** Muon `uPnl_A` — a partyA's unrealized-PnL attestation. */
export function MuonUpnlACard() {
  const [partyA, setPartyA] = useState("");
  const validPartyA = isAddress(partyA) ? (partyA as Address) : undefined;
  const mutation = useMuonUpnlA();

  return (
    <MuonServiceCard
      testId="muon-uPnl_A"
      method="uPnl_A"
      description="A partyA's unrealized-PnL attestation (the signature removeMargin / deallocate requires). partyA is a subaccount for Majors, a virtual account for VibeCaps."
    >
      <PartyAField
        idPrefix="muon-upnl-a-party-a"
        label="partyA (subaccount or VA address)"
        value={partyA}
        onValueChange={(next) => {
          setPartyA(next);
          mutation.reset();
        }}
        invalid={partyA.length > 0 && !validPartyA}
      />

      <Button
        type="button"
        size="sm"
        disabled={!validPartyA || mutation.isPending}
        onClick={() => {
          if (!validPartyA) return;
          mutation.mutate({ partyA: validPartyA });
        }}
        data-testid="button-fetch-muon-uPnl_A"
      >
        {mutation.isPending ? (
          <>
            <Spinner className="size-4" /> Fetching…
          </>
        ) : (
          "Fetch attestation"
        )}
      </Button>

      <MuonResultPanel
        testId="result-muon-uPnl_A"
        mutation={mutation}
        idleHint="Enter a partyA and fetch its uPnL attestation."
      />
    </MuonServiceCard>
  );
}
