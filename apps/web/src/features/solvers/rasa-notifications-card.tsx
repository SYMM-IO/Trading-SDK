"use client";

import { Field } from "@/components/field";
import { ResultError, ResultNote } from "@/components/result";
import { useSearchSolverNotifications } from "@symmio/trading-react";
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
import { SolverTargetSelect, useSolverKindActive, useSolverTargetState } from "./solver-target";

/** Parse an optional non-negative integer input; empty → undefined. */
function parseOptionalInt(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined;
}

/**
 * Rasa-only card: paged solver-notification search
 * (`POST /notifications/{start}/{size}`). The counterparty filter suggests the
 * connected wallet's subaccounts; quote id and timestamp filters are optional.
 */
export function RasaNotificationsCard() {
  const { target, setTarget } = useSolverTargetState({ requireKind: "rasa" });
  const active = useSolverKindActive("rasa");
  const [address, setAddress] = useState("");
  const [size, setSize] = useState("10");
  const [quoteId, setQuoteId] = useState("");
  const [timestampGte, setTimestampGte] = useState("");

  const validAddress = isAddress(address) ? (address as Address) : undefined;
  const validSize = Math.max(1, Math.min(100, Number(size) || 10));
  const validQuoteId = parseOptionalInt(quoteId);
  const validTimestampGte = parseOptionalInt(timestampGte);
  const filtersValid =
    (address.length === 0 || validAddress !== undefined) &&
    (quoteId.trim().length === 0 || validQuoteId !== undefined) &&
    (timestampGte.trim().length === 0 || validTimestampGte !== undefined);

  const query = useSearchSolverNotifications({
    chainId: target.chainId,
    solverId: target.solverId,
    start: 0,
    size: validSize,
    counterpartyAddress: validAddress,
    quoteId: validQuoteId,
    timestampGte: validTimestampGte,
    query: { enabled: false },
  });

  return (
    <MethodCard
      testId="method-rasa-solverNotifications"
      name="searchSolverNotifications"
      mutability="view"
      description="Paged search over the solver's own notification log (distinct from the notification service). All filters optional. Rasa-only endpoint."
      wide
    >
      <SolverTargetSelect value={target} onChange={setTarget} requireKind="rasa" testId="select-rasa-notif-solver" />

      <SubAccountPicker
        idPrefix="rasa-notif-account"
        selected={{ subAccount: validAddress }}
        onSelect={(selection) => setAddress(selection.subAccount ?? "")}
        accountLabel="counterparty filter (optional)"
        accountEmptyHint="Pick one of the connected wallet's subaccounts, enter any address, or leave empty for all accounts."
        selectedHintLabel="Counterparty"
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="quote id (optional)" htmlFor="input-rasa-notif-quote-id">
          <Input
            id="input-rasa-notif-quote-id"
            value={quoteId}
            onChange={(event) => setQuoteId(event.target.value)}
            placeholder="e.g. 1024"
            inputMode="numeric"
            aria-invalid={quoteId.trim().length > 0 && validQuoteId === undefined}
            data-testid="input-rasa-notif-quote-id"
          />
        </Field>
        <Field label="page size" htmlFor="input-rasa-notif-size">
          <Input
            id="input-rasa-notif-size"
            value={size}
            onChange={(event) => setSize(event.target.value)}
            inputMode="numeric"
            data-testid="input-rasa-notif-size"
          />
        </Field>
        <Field label="emitted at/after (optional)" htmlFor="rasa-notif-ts-gte-field" hint="Unix timestamp in seconds.">
          <DateTimePicker
            idPrefix="rasa-notif-ts-gte"
            value={timestampGte}
            onValueChange={setTimestampGte}
            date={validTimestampGte ? new Date(validTimestampGte * 1000) : undefined}
            onDateChange={(next) => setTimestampGte(Math.floor(next.getTime() / 1000).toString())}
            placeholder="1767225600"
            inputMode="numeric"
            mono
            invalid={timestampGte.trim().length > 0 && validTimestampGte === undefined}
          />
        </Field>
      </div>

      <Button
        type="button"
        size="sm"
        disabled={!active || query.isFetching || !filtersValid}
        onClick={() => void query.refetch()}
        data-testid="button-read-rasa-notifications"
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
        <ResultError
          testId="result-rasa-solverNotifications-error"
          kind={query.error.kind}
          message={query.error.message}
        />
      ) : query.data !== undefined ? (
        <JsonView data={query.data} data-testid="result-rasa-solverNotifications" />
      ) : (
        <ResultNote testId="result-rasa-solverNotifications-idle">Search to fetch the first page.</ResultNote>
      )}
    </MethodCard>
  );
}
