"use client";

import { Field } from "@/components/field";
import { useMuonUpnlAWithSymbolPrice } from "@theoldvarorg/react";
import { Button } from "@theoldvarorg/ui/components/button";
import { Input } from "@theoldvarorg/ui/components/input";
import { Spinner } from "@theoldvarorg/ui/components/spinner";
import { useState } from "react";
import { isAddress, type Address } from "viem";
import { PartyAField } from "../inspector/party-a-field";
import { MuonResultPanel } from "./muon-result";
import { MuonServiceCard } from "./muon-service-card";

function parseUint(value: string): bigint | undefined {
  if (!/^\d+$/.test(value.trim())) return undefined;
  return BigInt(value.trim());
}

/** Muon `uPnl_A_withSymbolPrice` — a partyA's uPnL plus a single symbol's price. */
export function MuonUpnlAWithSymbolPriceCard() {
  const [partyA, setPartyA] = useState("");
  const [symbolId, setSymbolId] = useState("");
  const validPartyA = isAddress(partyA) ? (partyA as Address) : undefined;
  const validSymbolId = parseUint(symbolId);
  const mutation = useMuonUpnlAWithSymbolPrice();

  return (
    <MuonServiceCard
      testId="muon-uPnl_A_withSymbolPrice"
      method="uPnl_A_withSymbolPrice"
      description="PartyA uPnL plus a single symbol's price — feeds the sendQuoteWithAffiliate flow."
    >
      <PartyAField
        idPrefix="muon-upnl-a-with-symbol-price-party-a"
        label="partyA (subaccount or VA address)"
        value={partyA}
        onValueChange={(next) => {
          setPartyA(next);
          mutation.reset();
        }}
        invalid={partyA.length > 0 && !validPartyA}
      />

      <Field label="symbolId" htmlFor="input-muon-upnl-a-with-symbol-price-symbol-id">
        <Input
          id="input-muon-upnl-a-with-symbol-price-symbol-id"
          data-testid="input-muon-upnl-a-with-symbol-price-symbol-id"
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
        disabled={!validPartyA || validSymbolId === undefined || mutation.isPending}
        onClick={() => {
          if (!validPartyA || validSymbolId === undefined) return;
          mutation.mutate({ partyA: validPartyA, symbolId: validSymbolId });
        }}
        data-testid="button-fetch-muon-uPnl_A_withSymbolPrice"
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
        testId="result-muon-uPnl_A_withSymbolPrice"
        mutation={mutation}
        idleHint="Enter a partyA and a symbolId, then fetch the uPnL + price attestation."
      />
    </MuonServiceCard>
  );
}
