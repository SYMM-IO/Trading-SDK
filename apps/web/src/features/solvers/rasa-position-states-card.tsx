"use client";

import { Field } from "@/components/field";
import { ResultError, ResultNote } from "@/components/result";
import { useSearchPositionStates } from "@symmio/trading-react";
import { Button } from "@symmio/ui/components/button";
import { DateTimePicker } from "@symmio/ui/components/date-time-picker";
import { Input } from "@symmio/ui/components/input";
import { JsonView } from "@symmio/ui/components/json-view";
import { Spinner } from "@symmio/ui/components/spinner";
import { useState } from "react";
import type { Address } from "viem";
import { isAddress } from "viem";
import { MethodCard } from "../inspector/method-card";
import { SubAccountPicker } from "../inspector/subaccount-picker";
import { SolverTargetSelect, useSolverTargetState } from "./solver-target";

/** Parse an optional non-negative integer input; empty → undefined. */
function parseOptionalInt(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined;
}

/**
 * Rasa-only card: paged position-state search
 * (`POST /position-state/{start}/{size}`). The account filter suggests the
 * connected wallet's subaccounts; quote id and create/modify time filters are
 * optional.
 */
export function RasaPositionStatesCard() {
  const { target, setTarget } = useSolverTargetState({ requireKind: "rasa" });
  const [address, setAddress] = useState("");
  const [size, setSize] = useState("10");
  const [quoteId, setQuoteId] = useState("");
  const [createTimeGte, setCreateTimeGte] = useState("");
  const [modifyTimeGte, setModifyTimeGte] = useState("");

  const validAddress = isAddress(address) ? (address as Address) : undefined;
  const validSize = Math.max(1, Math.min(100, Number(size) || 10));
  const validQuoteId = parseOptionalInt(quoteId);
  const validCreateGte = parseOptionalInt(createTimeGte);
  const validModifyGte = parseOptionalInt(modifyTimeGte);
  const filtersValid =
    (address.length === 0 || validAddress !== undefined) &&
    (quoteId.trim().length === 0 || validQuoteId !== undefined) &&
    (createTimeGte.trim().length === 0 || validCreateGte !== undefined) &&
    (modifyTimeGte.trim().length === 0 || validModifyGte !== undefined);

  const query = useSearchPositionStates({
    chainId: target.chainId,
    solverId: target.solverId,
    start: 0,
    size: validSize,
    address: validAddress,
    quoteId: validQuoteId,
    createTimeGte: validCreateGte,
    modifyTimeGte: validModifyGte,
    query: { enabled: false },
  });

  return (
    <MethodCard
      testId="method-rasa-positionStates"
      name="searchPositionStates"
      mutability="view"
      description="Paged search over the solver's position-state records. All filters optional. Rasa-only endpoint."
      wide
    >
      <SolverTargetSelect value={target} onChange={setTarget} requireKind="rasa" testId="select-rasa-pos-solver" />

      <SubAccountPicker
        idPrefix="rasa-pos-account"
        selected={{ subAccount: validAddress }}
        onSelect={(selection) => setAddress(selection.subAccount ?? "")}
        accountLabel="account filter (optional)"
        accountEmptyHint="Pick one of the connected wallet's subaccounts, enter any address, or leave empty for all accounts."
        selectedHintLabel="Account"
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="quote id (optional)" htmlFor="input-rasa-pos-quote-id">
          <Input
            id="input-rasa-pos-quote-id"
            value={quoteId}
            onChange={(event) => setQuoteId(event.target.value)}
            placeholder="e.g. 1024"
            inputMode="numeric"
            aria-invalid={quoteId.trim().length > 0 && validQuoteId === undefined}
            data-testid="input-rasa-pos-quote-id"
          />
        </Field>
        <Field label="page size" htmlFor="input-rasa-pos-size">
          <Input
            id="input-rasa-pos-size"
            value={size}
            onChange={(event) => setSize(event.target.value)}
            inputMode="numeric"
            data-testid="input-rasa-pos-size"
          />
        </Field>
        <Field
          label="created at/after (optional)"
          htmlFor="rasa-pos-create-gte-field"
          hint="Unix timestamp in seconds."
        >
          <DateTimePicker
            idPrefix="rasa-pos-create-gte"
            value={createTimeGte}
            onValueChange={setCreateTimeGte}
            date={validCreateGte ? new Date(validCreateGte * 1000) : undefined}
            onDateChange={(next) => setCreateTimeGte(Math.floor(next.getTime() / 1000).toString())}
            placeholder="1767225600"
            inputMode="numeric"
            mono
            invalid={createTimeGte.trim().length > 0 && validCreateGte === undefined}
          />
        </Field>
        <Field
          label="modified at/after (optional)"
          htmlFor="rasa-pos-modify-gte-field"
          hint="Unix timestamp in seconds."
        >
          <DateTimePicker
            idPrefix="rasa-pos-modify-gte"
            value={modifyTimeGte}
            onValueChange={setModifyTimeGte}
            date={validModifyGte ? new Date(validModifyGte * 1000) : undefined}
            onDateChange={(next) => setModifyTimeGte(Math.floor(next.getTime() / 1000).toString())}
            placeholder="1767225600"
            inputMode="numeric"
            mono
            invalid={modifyTimeGte.trim().length > 0 && validModifyGte === undefined}
          />
        </Field>
      </div>

      <Button
        type="button"
        size="sm"
        disabled={query.isFetching || !filtersValid}
        onClick={() => void query.refetch()}
        data-testid="button-read-rasa-position-states"
      >
        {query.isFetching ? (
          <>
            <Spinner className="size-4" /> Searching...
          </>
        ) : (
          "Search"
        )}
      </Button>
      {query.error ? (
        <ResultError testId="result-rasa-positionStates-error" kind={query.error.kind} message={query.error.message} />
      ) : query.data !== undefined ? (
        <JsonView data={query.data} data-testid="result-rasa-positionStates" />
      ) : (
        <ResultNote testId="result-rasa-positionStates-idle">Search to fetch the first page.</ResultNote>
      )}
    </MethodCard>
  );
}
