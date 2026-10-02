"use client";

import { ResultError, ResultNote } from "@/components/result";
import { TableSkeleton } from "@/components/skeletons";
import { formatUsd } from "@/lib/format";
import type { ExpressWithdrawOption, WithdrawRouteChoice } from "@symmio/trading-core";
import { useWithdrawRouteChoices } from "@symmio/trading-react";
import { Button } from "@symmio/ui/components/button";
import { DataTable, type DataTableColumn } from "@symmio/ui/components/data-table";
import { Spinner } from "@symmio/ui/components/spinner";
import { useState, type ReactNode } from "react";
import { zeroAddress } from "viem";
import { ExpressWithdrawConfigNote } from "./express-withdraw-config-note";
import { formatEstimate, formatUnixSeconds, WithdrawRouteSummary } from "./express-withdraw-route-view";
import { MethodCard } from "./method-card";
import { Section } from "./section";
import { useWithdrawIntentForm, WithdrawIntentFields } from "./withdraw-intent-fields";
import { RoutePolicyFields, useRoutePolicyForm, type RouteRequest } from "./withdraw-route-policy-fields";

export function ReadWithdrawRouteChoices() {
  const form = useWithdrawIntentForm();
  const policyForm = useRoutePolicyForm();
  /**
   * The request last sent — read on click only, since every `POST /options` is
   * recorded. Editing an input clears it, so a result never outlives its inputs.
   */
  const [request, setRequest] = useState<RouteRequest>();

  const query = useWithdrawRouteChoices({
    user: request?.intent.user ?? zeroAddress,
    amount: request?.intent.amount ?? 0n,
    receiver: request?.intent.receiver ?? zeroAddress,
    policy: request?.policy,
    query: { enabled: request !== undefined },
  });

  function onRead() {
    if (!form.intent) return;
    /** Edits clear `request`, so a set one still matches the inputs. */
    if (request) void query.refetch();
    else setRequest({ intent: form.intent, policy: policyForm.policy });
  }

  return (
    <MethodCard
      testId="method-getWithdrawRouteChoices"
      name="getWithdrawRouteChoices"
      mutability="view"
      description="The automatic recommendation plus every route a user may pick explicitly: classic and each valid Express offer. At most one POST /options per read."
      wide
    >
      <ExpressWithdrawConfigNote />
      <WithdrawIntentFields idPrefix="withdraw-route-choices" form={form} onEdit={() => setRequest(undefined)} />
      <RoutePolicyFields idPrefix="withdraw-route-choices" form={policyForm} onEdit={() => setRequest(undefined)} />

      <Button
        type="button"
        size="sm"
        disabled={!form.intent || query.isFetching}
        onClick={onRead}
        data-testid="button-read-withdraw-route-choices"
      >
        {query.isFetching ? (
          <>
            <Spinner className="size-4" /> Reading…
          </>
        ) : (
          "Read choices"
        )}
      </Button>

      <ResultPanel testId="result-getWithdrawRouteChoices" query={query} decimals={form.decimals} />
    </MethodCard>
  );
}

function ResultPanel({
  testId,
  query,
  decimals,
}: {
  testId: string;
  query: ReturnType<typeof useWithdrawRouteChoices>;
  decimals: number;
}) {
  if (query.isLoading) {
    return <TableSkeleton rows={3} columns={8} alignEndFrom={1} testId={`${testId}-loading`} />;
  }
  if (query.error) {
    return <ResultError testId={`${testId}-error`} kind={query.error.kind} message={query.error.message} />;
  }
  if (!query.data) {
    return <ResultNote testId={`${testId}-idle`}>Fill the intent and read the route choices.</ResultNote>;
  }

  const { recommended, available } = query.data;
  return (
    <div data-testid={`${testId}-data`} className="flex flex-col gap-4">
      <Section title="recommended">
        <WithdrawRouteSummary route={recommended} />
      </Section>

      <Section title={`available (${available.length})`}>
        <DataTable
          testId={`${testId}-available`}
          columns={getChoiceColumns(decimals)}
          data={[...available]}
          getRowId={getChoiceId}
          rowAttributes={(choice) => ({ "data-route": getChoiceId(choice) })}
          hidePagination
        />
      </Section>
    </div>
  );
}

function getChoiceId(choice: WithdrawRouteChoice): string {
  return choice.kind === "classic" ? "classic" : `express:${choice.option.optionTypeName}:${choice.option.nonce}`;
}

/** An Express-only cell: the option's value, or a dash on the classic row, which carries no provider offer. */
function optionCell(choice: WithdrawRouteChoice, render: (option: ExpressWithdrawOption) => ReactNode): ReactNode {
  if (choice.kind === "classic") return <span className="text-muted-foreground">—</span>;
  return render(choice.option);
}

function getChoiceColumns(decimals: number): DataTableColumn<WithdrawRouteChoice>[] {
  const mono = "text-foreground font-mono";
  return [
    { id: "route", header: "Route", cell: (choice) => <WithdrawRouteSummary route={choice} /> },
    {
      id: "expressAmount",
      header: "Express",
      align: "end",
      cellClassName: mono,
      cell: (choice) => optionCell(choice, (option) => formatUsd(option.expressAmount, decimals)),
    },
    {
      id: "generalAmount",
      header: "General",
      align: "end",
      cellClassName: mono,
      cell: (choice) => optionCell(choice, (option) => formatUsd(option.generalAmount, decimals)),
    },
    {
      id: "fee",
      header: "Fee",
      align: "end",
      cellClassName: mono,
      cell: (choice) => optionCell(choice, (option) => formatUsd(option.fee, decimals)),
    },
    {
      id: "operatorFee",
      header: "Operator fee",
      align: "end",
      cellClassName: mono,
      cell: (choice) => optionCell(choice, (option) => formatUsd(option.operatorFee, decimals)),
    },
    {
      id: "sponsorCoverage",
      header: "Sponsor",
      align: "end",
      cellClassName: mono,
      cell: (choice) => optionCell(choice, (option) => formatUsd(option.sponsorCoverage, decimals)),
    },
    {
      id: "estimate",
      header: "Estimate",
      align: "end",
      cellClassName: mono,
      cell: (choice) => optionCell(choice, (option) => formatEstimate(option.estimatedTimeSeconds)),
    },
    {
      id: "deadline",
      header: "Deadline",
      align: "end",
      cellClassName: "text-foreground/80",
      cell: (choice) => optionCell(choice, (option) => formatUnixSeconds(option.deadline)),
    },
  ];
}
