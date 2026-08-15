"use client";

import { Field } from "@/components/field";
import { useSendQuoteUpnlSig } from "@symmio/trading-react";
import { Button } from "@symmio/ui/components/button";
import { Input } from "@symmio/ui/components/input";
import { Spinner } from "@symmio/ui/components/spinner";
import { useState } from "react";
import { isAddress, type Address } from "viem";
import { PartyAField } from "../inspector/party-a-field";
import { MuonResultPanel } from "./muon-result";
import { MuonServiceCard } from "./muon-service-card";

function parseUint(value: string): bigint | undefined {
  if (!/^\d+$/.test(value.trim())) return undefined;
  return BigInt(value.trim());
}

/**
 * Muon `uPnl_A_withSymbolPrice` assembled into the contract-ready
 * `SingleUpnlAndPriceSig` that `sendQuote` takes.
 */
export function MuonSendQuoteUpnlSigCard() {
  const [partyA, setPartyA] = useState("");
  const [symbolId, setSymbolId] = useState("");
  const validPartyA = isAddress(partyA) ? (partyA as Address) : undefined;
  const validSymbolId = parseUint(symbolId);
  const mutation = useSendQuoteUpnlSig();

  return (
    <MuonServiceCard
      testId="muon-send-quote-upnl-sig"
      method="uPnl_A_withSymbolPrice → SingleUpnlAndPriceSig"
      description="The contract-ready quote signature. Solvers that enforce Muon verification require a live one; lowcap signs a placeholder instead."
    >
      <PartyAField
        idPrefix="muon-send-quote-upnl-sig-party-a"
        label="partyA (subaccount for majors, VA for lowcap)"
        value={partyA}
        onValueChange={(next) => {
          setPartyA(next);
          mutation.reset();
        }}
        invalid={partyA.length > 0 && !validPartyA}
      />

      <Field label="symbolId" htmlFor="input-muon-send-quote-upnl-sig-symbol-id">
        <Input
          id="input-muon-send-quote-upnl-sig-symbol-id"
          data-testid="input-muon-send-quote-upnl-sig-symbol-id"
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
        data-testid="button-fetch-muon-send-quote-upnl-sig"
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
        testId="result-muon-send-quote-upnl-sig"
        mutation={mutation}
        idleHint="Enter a partyA and a symbolId to assemble the contract-ready quote signature."
      />
    </MuonServiceCard>
  );
}
