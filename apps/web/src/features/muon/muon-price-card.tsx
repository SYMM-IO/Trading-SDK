"use client";

import { Field } from "@/components/field";
import { useMuonPrice } from "@theoldvarorg/react";
import { Button } from "@theoldvarorg/ui/components/button";
import { Input } from "@theoldvarorg/ui/components/input";
import { Spinner } from "@theoldvarorg/ui/components/spinner";
import { useState } from "react";
import { MuonResultPanel } from "./muon-result";
import { MuonServiceCard } from "./muon-service-card";

/** Parse a comma-separated list of integers to `bigint[]`; `undefined` when empty or non-numeric. */
function parseQuoteIds(value: string): readonly bigint[] | undefined {
  const parts = value
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  if (parts.length === 0) return undefined;
  if (!parts.every((part) => /^\d+$/.test(part))) return undefined;
  return parts.map((part) => BigInt(part));
}

/** Muon `price` — validated prices for a set of quote ids (partyB liquidation flow). */
export function MuonPriceCard() {
  const [quoteIds, setQuoteIds] = useState("");
  const validQuoteIds = parseQuoteIds(quoteIds);
  const mutation = useMuonPrice();

  return (
    <MuonServiceCard
      testId="muon-price"
      method="price"
      description="Validated prices for a set of quote ids (partyB liquidation flow)."
    >
      <Field label="quoteIds (comma-separated)" htmlFor="muon-price-quote-ids">
        <Input
          id="muon-price-quote-ids"
          data-testid="muon-price-quote-ids"
          value={quoteIds}
          onChange={(event) => {
            setQuoteIds(event.target.value);
            mutation.reset();
          }}
          placeholder="10, 11"
          className="font-mono"
          aria-invalid={quoteIds.trim().length > 0 && !validQuoteIds}
        />
      </Field>

      <Button
        type="button"
        size="sm"
        disabled={!validQuoteIds || mutation.isPending}
        onClick={() => {
          if (!validQuoteIds) return;
          mutation.mutate({ quoteIds: validQuoteIds });
        }}
        data-testid="button-fetch-muon-price"
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
        testId="result-muon-price"
        mutation={mutation}
        idleHint="Enter one or more quote ids and fetch their validated prices."
      />
    </MuonServiceCard>
  );
}
