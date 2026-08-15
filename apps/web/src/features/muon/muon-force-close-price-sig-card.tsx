"use client";

import { Field } from "@/components/field";
import { useForceClosePriceSig } from "@symmio/trading-react";
import { Button } from "@symmio/ui/components/button";
import { DateTimePicker } from "@symmio/ui/components/date-time-picker";
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
 * Muon `priceRange` assembled into the contract-ready `HighLowPriceSig` that
 * `forceClosePosition` verifies.
 */
export function MuonForceClosePriceSigCard() {
  const [t0, setT0] = useState("");
  const [t1, setT1] = useState("");
  const [partyA, setPartyA] = useState("");
  const [partyB, setPartyB] = useState("");
  const [symbolId, setSymbolId] = useState("");
  const mutation = useForceClosePriceSig();

  const validT0 = parseUint(t0);
  const validT1 = parseUint(t1);
  const validPartyA = isAddress(partyA) ? (partyA as Address) : undefined;
  const validPartyB = isAddress(partyB) ? (partyB as Address) : undefined;
  const validSymbolId = parseUint(symbolId);
  const ready =
    validT0 !== undefined &&
    validT1 !== undefined &&
    Boolean(validPartyA) &&
    Boolean(validPartyB) &&
    validSymbolId !== undefined;

  return (
    <MuonServiceCard
      testId="muon-force-close-price-sig"
      method="priceRange → HighLowPriceSig"
      description="The contract-ready force-close signature. The gateway validates the window against the position's own lifetime, so a window with no open position behind it is rejected with BAD_START_TIME."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="t0 (unix seconds)" htmlFor="muon-force-close-price-sig-t0-field">
          <DateTimePicker
            idPrefix="muon-force-close-price-sig-t0"
            value={t0}
            onValueChange={(next) => {
              setT0(next);
              mutation.reset();
            }}
            date={validT0 !== undefined ? new Date(Number(validT0) * 1000) : undefined}
            onDateChange={(date) => {
              setT0(Math.floor(date.getTime() / 1000).toString());
              mutation.reset();
            }}
            placeholder="1700000000"
            inputMode="numeric"
            mono
            invalid={t0.length > 0 && validT0 === undefined}
          />
        </Field>

        <Field label="t1 (unix seconds)" htmlFor="muon-force-close-price-sig-t1-field">
          <DateTimePicker
            idPrefix="muon-force-close-price-sig-t1"
            value={t1}
            onValueChange={(next) => {
              setT1(next);
              mutation.reset();
            }}
            date={validT1 !== undefined ? new Date(Number(validT1) * 1000) : undefined}
            onDateChange={(date) => {
              setT1(Math.floor(date.getTime() / 1000).toString());
              mutation.reset();
            }}
            placeholder="1700000900"
            inputMode="numeric"
            mono
            invalid={t1.length > 0 && validT1 === undefined}
          />
        </Field>
      </div>

      <PartyAField
        idPrefix="muon-force-close-price-sig-party-a"
        label="partyA (the position's owner)"
        value={partyA}
        onValueChange={(next) => {
          setPartyA(next);
          mutation.reset();
        }}
        invalid={partyA.length > 0 && !validPartyA}
      />

      <Field label="partyB (the solver)" htmlFor="input-muon-force-close-price-sig-party-b">
        <Input
          id="input-muon-force-close-price-sig-party-b"
          data-testid="input-muon-force-close-price-sig-party-b"
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

      <Field label="symbolId" htmlFor="input-muon-force-close-price-sig-symbol-id">
        <Input
          id="input-muon-force-close-price-sig-symbol-id"
          data-testid="input-muon-force-close-price-sig-symbol-id"
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
          if (
            validT0 === undefined ||
            validT1 === undefined ||
            validPartyA === undefined ||
            validPartyB === undefined ||
            validSymbolId === undefined
          ) {
            return;
          }
          mutation.mutate({
            t0: validT0,
            t1: validT1,
            partyA: validPartyA,
            partyB: validPartyB,
            symbolId: validSymbolId,
          });
        }}
        data-testid="button-fetch-muon-force-close-price-sig"
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
        testId="result-muon-force-close-price-sig"
        mutation={mutation}
        idleHint="Enter a window inside a real position's lifetime, the two parties, and a symbol id."
      />
    </MuonServiceCard>
  );
}
