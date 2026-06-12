"use client";

import { Field } from "@/components/field";
import { useMuonUpnlB } from "@symm-frontier/react";
import { Button } from "@symm-frontier/ui/components/button";
import { Input } from "@symm-frontier/ui/components/input";
import { Spinner } from "@symm-frontier/ui/components/spinner";
import { useState } from "react";
import { isAddress, type Address } from "viem";
import { PartyAField } from "../inspector/party-a-field";
import { MuonResultPanel } from "./muon-result";
import { MuonServiceCard } from "./muon-service-card";

/** Muon `uPnl_B` — a partyB's unrealized-PnL attestation against a partyA. */
export function MuonUpnlBCard() {
  const [partyB, setPartyB] = useState("");
  const [partyA, setPartyA] = useState("");
  const validPartyB = isAddress(partyB) ? (partyB as Address) : undefined;
  const validPartyA = isAddress(partyA) ? (partyA as Address) : undefined;
  const mutation = useMuonUpnlB();

  return (
    <MuonServiceCard
      testId="muon-uPnl_B"
      method="uPnl_B"
      description="A partyB's uPnL against a partyA — used in lockQuote solvency validation."
    >
      <Field label="partyB (hedger/solver address)" htmlFor="muon-upnl-b-party-b">
        <Input
          id="muon-upnl-b-party-b"
          data-testid="muon-upnl-b-party-b"
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
        idPrefix="muon-upnl-b-party-a"
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
        data-testid="button-fetch-muon-uPnl_B"
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
        testId="result-muon-uPnl_B"
        mutation={mutation}
        idleHint="Enter a partyB and partyA and fetch the partyB's uPnL attestation."
      />
    </MuonServiceCard>
  );
}
