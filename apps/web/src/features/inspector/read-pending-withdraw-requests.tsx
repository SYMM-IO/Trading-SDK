"use client";

import { ResultError, ResultNote } from "@/components/result";
import { TableSkeleton } from "@/components/skeletons";
import { formatUsd } from "@/lib/format";
import { WithdrawStatus } from "@symmio/trading-core";
import { usePendingWithdrawRequests, useSymmioConfig } from "@symmio/trading-react";
import { Badge } from "@symmio/ui/components/badge";
import { Button } from "@symmio/ui/components/button";
import { Spinner } from "@symmio/ui/components/spinner";
import { useState } from "react";
import { isAddress, type Address } from "viem";
import { MethodCard } from "./method-card";
import { SubAccountField } from "./subaccount-field";

export function ReadPendingWithdrawRequests() {
  const { addresses } = useSymmioConfig().getChainConfig();
  const [input, setInput] = useState<string>("");
  const validUser = isAddress(input) ? (input as Address) : undefined;

  const query = usePendingWithdrawRequests({ user: validUser });

  return (
    <MethodCard
      testId="method-getPendingWithdrawRequests"
      name="getPendingWithdrawRequests"
      mutability="view"
      description="List a subaccount's active (non-terminal) withdraw requests."
      wide
    >
      <SubAccountField
        idPrefix="pending-user"
        label="user (subaccount address)"
        value={input}
        onValueChange={setInput}
        invalid={input.length > 0 && !validUser}
      />

      <Button
        type="button"
        size="sm"
        disabled={!validUser || query.isFetching}
        onClick={() => void query.refetch()}
        data-testid="button-read-pending"
      >
        {query.isFetching ? (
          <>
            <Spinner className="size-4" /> Reading…
          </>
        ) : (
          "Read"
        )}
      </Button>

      <ResultPanel testId="result-getPendingWithdrawRequests" query={query} decimals={addresses.collateralDecimals} />
    </MethodCard>
  );
}

function ResultPanel({
  testId,
  query,
  decimals,
}: {
  testId: string;
  query: ReturnType<typeof usePendingWithdrawRequests>;
  decimals: number;
}) {
  if (query.isLoading) {
    return <TableSkeleton rows={3} columns={4} alignEndFrom={2} testId={`${testId}-loading`} />;
  }
  if (query.error) {
    return <ResultError testId={`${testId}-error`} kind={query.error.kind} message={query.error.message} />;
  }
  if (!query.data) {
    return <ResultNote testId={`${testId}-idle`}>Run the read to see pending requests.</ResultNote>;
  }
  if (query.data.length === 0) {
    return <ResultNote testId={`${testId}-empty`}>No active withdraw requests for this subaccount.</ResultNote>;
  }
  return (
    <div data-testid={`${testId}-data`} className="border-border/70 overflow-hidden rounded-xl border">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-muted/40 text-muted-foreground text-left text-xs font-medium tracking-wide uppercase">
              <th className="px-3 py-2.5">Id</th>
              <th className="px-3 py-2.5">Status</th>
              <th className="px-3 py-2.5 text-right">Amount</th>
              <th className="px-3 py-2.5 text-right">Cooldown ends</th>
            </tr>
          </thead>
          <tbody>
            {query.data.map((request) => (
              <tr
                key={String(request.id)}
                data-request-id={String(request.id)}
                className="border-border/60 hover:bg-muted/30 border-t transition-colors"
              >
                <td className="text-foreground px-3 py-2.5 font-mono">{String(request.id)}</td>
                <td className="px-3 py-2.5">
                  <Badge variant="secondary">{WithdrawStatus[request.status] ?? String(request.status)}</Badge>
                </td>
                <td className="text-foreground px-3 py-2.5 text-right font-mono">
                  {formatUsd(request.totalAmount, decimals)}
                </td>
                <td className="text-foreground/80 px-3 py-2.5 text-right">
                  {new Date(Number(request.cooldownEndTime) * 1000).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
