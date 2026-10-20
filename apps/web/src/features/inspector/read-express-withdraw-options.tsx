"use client";

import { Field } from "@/components/field";
import { ResultError, ResultNote } from "@/components/result";
import { useExpressWithdrawOptions } from "@symmio/trading-react";
import { Badge } from "@symmio/ui/components/badge";
import { Button } from "@symmio/ui/components/button";
import { Input } from "@symmio/ui/components/input";
import { Spinner } from "@symmio/ui/components/spinner";
import { useState } from "react";
import { isAddress, zeroAddress, type Address } from "viem";
import { ExpressWithdrawConfigNote } from "./express-withdraw-config-note";
import { ExpressOptionDetails } from "./express-withdraw-route-view";
import { MethodCard } from "./method-card";
import { useWithdrawIntentForm, WithdrawIntentFields, type WithdrawIntent } from "./withdraw-intent-fields";

interface OptionsRequest {
  intent: WithdrawIntent;
  affiliate?: Address;
}

export function ReadExpressWithdrawOptions() {
  const form = useWithdrawIntentForm();
  const [affiliate, setAffiliate] = useState<string>("");
  /**
   * The request last sent — read on click only, since every `POST /options` is
   * recorded. Editing an input clears it, so a result never outlives its inputs.
   */
  const [request, setRequest] = useState<OptionsRequest>();

  const affiliateInvalid = affiliate.length > 0 && !isAddress(affiliate);
  const validAffiliate = isAddress(affiliate) ? (affiliate as Address) : undefined;

  const query = useExpressWithdrawOptions({
    user: request?.intent.user ?? zeroAddress,
    amount: request?.intent.amount ?? 0n,
    receiver: request?.intent.receiver ?? zeroAddress,
    affiliate: request?.affiliate,
    query: { enabled: request !== undefined, retry: false },
  });

  function onRead() {
    if (!form.intent || affiliateInvalid) return;
    /** Edits clear `request`, so a set one still matches the inputs. */
    if (request) void query.refetch();
    else setRequest({ intent: form.intent, affiliate: validAffiliate });
  }

  return (
    <MethodCard
      testId="method-getExpressWithdrawOptions"
      name="getExpressWithdrawOptions"
      mutability="view"
      description="Request the Express service's signed options for one exact withdrawal intent (POST /options). Expired offers are dropped; each request is recorded by the service."
      wide
    >
      <ExpressWithdrawConfigNote />
      <WithdrawIntentFields idPrefix="express-options" form={form} onEdit={() => setRequest(undefined)} />

      <Field
        label="affiliate (optional override)"
        htmlFor="express-options-affiliate"
        hint="Leave empty to use the chain configuration's affiliate."
      >
        <Input
          id="express-options-affiliate"
          data-testid="express-options-affiliate"
          value={affiliate}
          onChange={(e) => {
            setAffiliate(e.target.value);
            setRequest(undefined);
          }}
          placeholder="0x…"
          className="font-mono"
          aria-invalid={affiliateInvalid}
        />
      </Field>

      <Button
        type="button"
        size="sm"
        disabled={!form.intent || affiliateInvalid || query.isFetching}
        onClick={onRead}
        data-testid="button-read-express-options"
      >
        {query.isFetching ? (
          <>
            <Spinner className="size-4" /> Requesting…
          </>
        ) : (
          "Request options"
        )}
      </Button>

      <ResultPanel testId="result-getExpressWithdrawOptions" query={query} decimals={form.decimals} />
    </MethodCard>
  );
}

function ResultPanel({
  testId,
  query,
  decimals,
}: {
  testId: string;
  query: ReturnType<typeof useExpressWithdrawOptions>;
  decimals: number;
}) {
  if (query.isLoading) {
    return (
      <ResultNote testId={`${testId}-loading`} loading>
        Requesting signed options…
      </ResultNote>
    );
  }
  if (query.error) {
    return <ResultError testId={`${testId}-error`} kind={query.error.kind} message={query.error.message} />;
  }
  if (!query.data) {
    return <ResultNote testId={`${testId}-idle`}>Fill the intent and request options.</ResultNote>;
  }

  const { options, requestDbId } = query.data;
  return (
    <div data-testid={`${testId}-data`} className="flex flex-col gap-3">
      <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-sm">
        <span>
          {options.length} {options.length === 1 ? "option" : "options"} · requestDbId
        </span>
        <span className="text-foreground font-mono">{requestDbId}</span>
      </div>

      {options.length === 0 ? (
        <ResultNote testId={`${testId}-empty`}>The service returned no unexpired option for this intent.</ResultNote>
      ) : (
        <div className="grid grid-cols-1 gap-4 @3xl:grid-cols-2">
          {options.map((option) => (
            <div
              key={`${option.optionTypeName}:${option.nonce}`}
              className="border-border/70 flex flex-col gap-2 rounded-xl border px-3 pt-3 pb-1"
            >
              <Badge className="w-fit">{option.optionTypeName}</Badge>
              <ExpressOptionDetails
                option={option}
                decimals={decimals}
                testId={`${testId}-option-${option.optionTypeName}`}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
