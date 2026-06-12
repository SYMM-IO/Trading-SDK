"use client";

import { Field } from "@/components/field";
import { useMuonUpnlWithSymbolPrice } from "@symm-frontier/react";
import { Button } from "@symm-frontier/ui/components/button";
import { Input } from "@symm-frontier/ui/components/input";
import { Spinner } from "@symm-frontier/ui/components/spinner";
import { useState } from "react";
import { isAddress, type Address } from "viem";
import { PartyAField } from "../inspector/party-a-field";
import { MuonResultPanel } from "./muon-result";
import { MuonServiceCard } from "./muon-service-card";

function parseUint(value: string): bigint | undefined {
  if (!/^\d+$/.test(value.trim())) return undefined;
  return BigInt(value.trim());
}

/** Muon `uPnlWithSymbolPrice` — both parties' uPnL plus a single symbol price. */
export function MuonUpnlWithSymbolPriceCard() {
  const [partyB, setPartyB] = useState("");
  const [partyA, setPartyA] = useState("");
  const [symbolId, setSymbolId] = useState("");

  const validPartyB = isAddress(partyB) ? (partyB as Address) : undefined;
  const validPartyA = isAddress(partyA) ? (partyA as Address) : undefined;
  const validSymbolId = parseUint(symbolId);
  const ready = Boolean(validPartyB) && Boolean(validPartyA) && validSymbolId !== undefined;

  const mutation = useMuonUpnlWithSymbolPrice();

  return (
    <MuonServiceCard
      testId="muon-uPnlWithSymbolPrice"
      method="uPnlWithSymbolPrice"
      description="Both parties' uPnL plus a symbol price — feeds solver openPosition calls."
      wide
    >
      <Field label="partyB (solver address)" htmlFor="muon-upnl-with-symbol-price-party-b">
        <Input
          id="muon-upnl-with-symbol-price-party-b"
          data-testid="muon-upnl-with-symbol-price-party-b"
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
        idPrefix="muon-upnl-with-symbol-price-party-a"
        label="partyA (subaccount or VA address)"
        value={partyA}
        onValueChange={(next) => {
          setPartyA(next);
          mutation.reset();
        }}
        invalid={partyA.length > 0 && !validPartyA}
      />

      <Field label="symbolId" htmlFor="muon-upnl-with-symbol-price-symbol-id">
        <Input
          id="muon-upnl-with-symbol-price-symbol-id"
          data-testid="muon-upnl-with-symbol-price-symbol-id"
          value={symbolId}
          onChange={(event) => {
            setSymbolId(event.target.value);
            mutation.reset();
          }}
          placeholder="1"
          inputMode="numeric"
          aria-invalid={symbolId.length > 0 && validSymbolId === undefined}
        />
      </Field>

      <Button
        type="button"
        size="sm"
        disabled={!ready || mutation.isPending}
        onClick={() => {
          if (!validPartyB || !validPartyA || validSymbolId === undefined) return;
          mutation.mutate({ partyB: validPartyB, partyA: validPartyA, symbolId: validSymbolId });
        }}
        data-testid="button-fetch-muon-uPnlWithSymbolPrice"
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
        testId="result-muon-uPnlWithSymbolPrice"
        mutation={mutation}
        idleHint="Enter partyB, partyA, and a symbolId, then fetch the attestation."
      />
    </MuonServiceCard>
  );
}
