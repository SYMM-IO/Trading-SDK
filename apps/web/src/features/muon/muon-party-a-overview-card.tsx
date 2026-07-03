"use client";

import { useMuonPartyAOverview } from "@symmio/trading-react";
import { Button } from "@symmio/ui/components/button";
import { Spinner } from "@symmio/ui/components/spinner";
import { useState } from "react";
import { isAddress, type Address } from "viem";
import { PartyAField } from "../inspector/party-a-field";
import { MuonResultPanel } from "./muon-result";
import { MuonServiceCard } from "./muon-service-card";

/** Muon `partyA_overview` — a partyA's liquidation overview attestation. */
export function MuonPartyAOverviewCard() {
  const [partyA, setPartyA] = useState("");
  const validPartyA = isAddress(partyA) ? (partyA as Address) : undefined;
  const mutation = useMuonPartyAOverview();

  return (
    <MuonServiceCard
      testId="muon-partyA_overview"
      method="partyA_overview"
      description="PartyA liquidation overview — the uPnL + liquidation data behind liquidatePartyA / setSymbolsPrice (produces a LiquidationSig)."
    >
      <PartyAField
        idPrefix="muon-party-a-overview-party-a"
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
        data-testid="button-fetch-muon-partyA_overview"
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
        testId="result-muon-partyA_overview"
        mutation={mutation}
        idleHint="Enter a partyA and fetch its liquidation overview attestation."
      />
    </MuonServiceCard>
  );
}
