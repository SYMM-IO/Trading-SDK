"use client";

import { Field } from "@/components/field";
import { useMuonUpnl } from "@symm-frontier/react";
import { Button } from "@symm-frontier/ui/components/button";
import { Input } from "@symm-frontier/ui/components/input";
import { Spinner } from "@symm-frontier/ui/components/spinner";
import { useState } from "react";
import { isAddress, type Address } from "viem";
import { PartyAField } from "../inspector/party-a-field";
import { MuonResultPanel } from "./muon-result";
import { MuonServiceCard } from "./muon-service-card";

/** Muon `uPnl` — combined partyA + partyB unrealized-PnL attestation. */
export function MuonUpnlCard() {
  const [partyB, setPartyB] = useState("");
  const [partyA, setPartyA] = useState("");
  const validPartyB = isAddress(partyB) ? (partyB as Address) : undefined;
  const validPartyA = isAddress(partyA) ? (partyA as Address) : undefined;
  const mutation = useMuonUpnl();

  return (
    <MuonServiceCard
      testId="muon-uPnl"
      method="uPnl"
      description="Combined partyA + partyB uPnL in one attestation, with per-party breakdowns."
    >
      <Field label="partyB (solver / hedger address)" htmlFor="input-muon-upnl-party-b">
        <Input
          id="input-muon-upnl-party-b"
          data-testid="input-muon-upnl-party-b"
          value={partyB}
          onChange={(event) => {
            setPartyB(event.target.value);
            mutation.reset();
          }}
          placeholder="0x…"
          className="font-mono"
          aria-invalid={partyB.length > 0 && !validPartyB}
        />
      </Field>

      <PartyAField
        idPrefix="muon-upnl-party-a"
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
        disabled={!validPartyB || !validPartyA || mutation.isPending}
        onClick={() => {
          if (!validPartyB || !validPartyA) return;
          mutation.mutate({ partyB: validPartyB, partyA: validPartyA });
        }}
        data-testid="button-fetch-muon-uPnl"
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
        testId="result-muon-uPnl"
        mutation={mutation}
        idleHint="Enter a partyB and partyA and fetch their combined uPnL attestation."
      />
    </MuonServiceCard>
  );
}
