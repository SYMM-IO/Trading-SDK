"use client";

import { ResultError, ResultNote } from "@/components/result";
import { useWithdrawRoute } from "@symmio/trading-react";
import { Button } from "@symmio/ui/components/button";
import { Spinner } from "@symmio/ui/components/spinner";
import { useState } from "react";
import { zeroAddress } from "viem";
import { ExpressWithdrawConfigNote } from "./express-withdraw-config-note";
import { ExpressOptionDetails, WithdrawRouteSummary } from "./express-withdraw-route-view";
import { MethodCard } from "./method-card";
import { useWithdrawIntentForm, WithdrawIntentFields } from "./withdraw-intent-fields";
import { RoutePolicyFields, useRoutePolicyForm, type RouteRequest } from "./withdraw-route-policy-fields";

export function ReadWithdrawRoute() {
  const form = useWithdrawIntentForm();
  const policyForm = useRoutePolicyForm();
  /**
   * The request last sent. The service records every `POST /options`, so the
   * card reads on "Prepare route" only — never on each keystroke. Editing an
   * input clears it, so a result never outlives its inputs.
   */
  const [request, setRequest] = useState<RouteRequest>();

  const query = useWithdrawRoute({
    user: request?.intent.user ?? zeroAddress,
    amount: request?.intent.amount ?? 0n,
    receiver: request?.intent.receiver ?? zeroAddress,
    policy: request?.policy,
    query: { enabled: request !== undefined, retry: false },
  });

  function onRead() {
    if (!form.intent) return;
    /** Edits clear `request`, so a set one still matches the inputs. */
    if (request) void query.refetch();
    else setRequest({ intent: form.intent, policy: policyForm.policy });
  }

  return (
    <MethodCard
      testId="method-getWithdrawRoute"
      name="getWithdrawRoute"
      mutability="view"
      description="Prepare the automatic withdrawal route: immediate classic, an Express option by policy priority, or the classic cooldown fallback. May POST /options to the Express service."
    >
      <ExpressWithdrawConfigNote />
      <WithdrawIntentFields idPrefix="withdraw-route" form={form} onEdit={() => setRequest(undefined)} />
      <RoutePolicyFields idPrefix="withdraw-route" form={policyForm} onEdit={() => setRequest(undefined)} />

      <Button
        type="button"
        size="sm"
        disabled={!form.intent || query.isFetching}
        onClick={onRead}
        data-testid="button-read-withdraw-route"
      >
        {query.isFetching ? (
          <>
            <Spinner className="size-4" /> Preparing…
          </>
        ) : (
          "Prepare route"
        )}
      </Button>

      <ResultPanel testId="result-getWithdrawRoute" query={query} decimals={form.decimals} />
    </MethodCard>
  );
}

function ResultPanel({
  testId,
  query,
  decimals,
}: {
  testId: string;
  query: ReturnType<typeof useWithdrawRoute>;
  decimals: number;
}) {
  if (query.isLoading) {
    return (
      <ResultNote testId={`${testId}-loading`} loading>
        Preparing route…
      </ResultNote>
    );
  }
  if (query.error) {
    return <ResultError testId={`${testId}-error`} kind={query.error.kind} message={query.error.message} />;
  }
  if (!query.data) {
    return <ResultNote testId={`${testId}-idle`}>Fill the intent and prepare a route.</ResultNote>;
  }

  const route = query.data;
  return (
    <div data-testid={`${testId}-data`} className="flex flex-col gap-3">
      <WithdrawRouteSummary route={route} />
      {route.kind === "express" ? <ExpressOptionDetails option={route.option} decimals={decimals} /> : null}
    </div>
  );
}
