"use client";

import { Field } from "@/components/field";
import { useMuonSettleUpnl } from "@symm-frontier/react";
import { Button } from "@symm-frontier/ui/components/button";
import { Input } from "@symm-frontier/ui/components/input";
import { Spinner } from "@symm-frontier/ui/components/spinner";
import { useState } from "react";
import { isAddress, type Address } from "viem";
import { PartyAField } from "../inspector/party-a-field";
import { MuonResultPanel } from "./muon-result";
import { MuonServiceCard } from "./muon-service-card";

/** Parse a comma-separated list of unsigned integers into `bigint[]`, or `undefined` when any entry is invalid. */
function parseQuoteIds(value: string): bigint[] | undefined {
  const parts = value
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  if (parts.length === 0) return undefined;
  const ids: bigint[] = [];
  for (const part of parts) {
    if (!/^\d+$/.test(part)) return undefined;
    ids.push(BigInt(part));
  }
  return ids;
}

/** Muon `settle_upnl` — uPnL settlement data for a partyA's quotes. */
export function MuonSettleUpnlCard() {
  const [partyA, setPartyA] = useState("");
  const [quoteIds, setQuoteIds] = useState("");
  const validPartyA = isAddress(partyA) ? (partyA as Address) : undefined;
  const validQuoteIds = parseQuoteIds(quoteIds);
  const mutation = useMuonSettleUpnl();

  return (
    <MuonServiceCard
      testId="muon-settle_upnl"
      method="settle_upnl"
      description="uPnL settlement data for a partyA's quotes — enables settleUpnl."
    >
      <PartyAField
        idPrefix="muon-settle-upnl-party-a"
        label="partyA (subaccount or VA address)"
        value={partyA}
        onValueChange={(next) => {
          setPartyA(next);
          mutation.reset();
        }}
        invalid={partyA.length > 0 && !validPartyA}
      />

      <Field
        label="quoteIds"
        htmlFor="input-muon-settle-upnl-quote-ids"
        hint="Comma-separated quote ids (e.g. 10, 11, 12)."
      >
        <Input
          id="input-muon-settle-upnl-quote-ids"
          data-testid="input-muon-settle-upnl-quote-ids"
          value={quoteIds}
          onChange={(event) => {
            setQuoteIds(event.target.value);
            mutation.reset();
          }}
          placeholder="10, 11, 12"
          inputMode="numeric"
          className="font-mono"
          aria-invalid={quoteIds.length > 0 && validQuoteIds === undefined}
        />
      </Field>

      <Button
        type="button"
        size="sm"
        disabled={!validPartyA || validQuoteIds === undefined || mutation.isPending}
        onClick={() => {
          if (!validPartyA || validQuoteIds === undefined) return;
          mutation.mutate({ partyA: validPartyA, quoteIds: validQuoteIds });
        }}
        data-testid="button-fetch-muon-settle_upnl"
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
        testId="result-muon-settle_upnl"
        mutation={mutation}
        idleHint="Enter a partyA and quote ids, then fetch its settlement attestation."
      />
    </MuonServiceCard>
  );
}
