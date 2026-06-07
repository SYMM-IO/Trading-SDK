"use client";

import { DataList, DataRow } from "@/components/data-list";
import { Field } from "@/components/field";
import { ResultError, ResultNote } from "@/components/result";
import { formatUsd } from "@/lib/format";
import { WithdrawStatus } from "@symm-frontier/core";
import { useSymmioConfig, useWithdrawRequest } from "@symm-frontier/react";
import { Badge } from "@symm-frontier/ui/components/badge";
import { Button } from "@symm-frontier/ui/components/button";
import { Input } from "@symm-frontier/ui/components/input";
import { Spinner } from "@symm-frontier/ui/components/spinner";
import { useState } from "react";
import { isAddress, type Address } from "viem";
import { MethodCard } from "./method-card";
import { SubAccountField } from "./subaccount-field";

function parseRequestId(value: string): bigint | undefined {
  if (!/^\d+$/.test(value.trim())) return undefined;
  return BigInt(value.trim());
}

export function ReadGetWithdrawRequest() {
  const { addresses } = useSymmioConfig().getChainConfig();
  const [user, setUser] = useState<string>("");
  const [requestId, setRequestId] = useState<string>("");

  const validUser = isAddress(user) ? (user as Address) : undefined;
  const validRequestId = parseRequestId(requestId);

  const query = useWithdrawRequest({ user: validUser, requestId: validRequestId });
  const ready = Boolean(validUser) && validRequestId !== undefined;

  return (
    <MethodCard
      testId="method-getWithdrawRequests"
      name="getWithdrawRequests"
      mutability="view"
      description="Read a single withdraw request by subaccount and request id."
    >
      <SubAccountField
        idPrefix="request-user"
        label="user (subaccount address)"
        value={user}
        onValueChange={setUser}
        invalid={user.length > 0 && !validUser}
      />

      <Field label="requestId" htmlFor="input-request-id">
        <Input
          id="input-request-id"
          data-testid="input-request-id"
          value={requestId}
          onChange={(e) => setRequestId(e.target.value)}
          placeholder="1"
          inputMode="numeric"
          aria-invalid={requestId.length > 0 && validRequestId === undefined}
        />
      </Field>

      <Button
        type="button"
        size="sm"
        disabled={!ready || query.isFetching}
        onClick={() => void query.refetch()}
        data-testid="button-read-request"
      >
        {query.isFetching ? (
          <>
            <Spinner className="size-4" /> Reading…
          </>
        ) : (
          "Read"
        )}
      </Button>

      <ResultPanel testId="result-getWithdrawRequests" query={query} decimals={addresses.collateralDecimals} />
    </MethodCard>
  );
}

function ResultPanel({
  testId,
  query,
  decimals,
}: {
  testId: string;
  query: ReturnType<typeof useWithdrawRequest>;
  decimals: number;
}) {
  if (query.isLoading) {
    return (
      <ResultNote testId={`${testId}-loading`} loading>
        Loading…
      </ResultNote>
    );
  }
  if (query.error) {
    return <ResultError testId={`${testId}-error`} kind={query.error.kind} message={query.error.message} />;
  }
  if (!query.data) {
    return <ResultNote testId={`${testId}-idle`}>Run the read to see the request.</ResultNote>;
  }
  const request = query.data;
  return (
    <DataList data-testid={`${testId}-data`}>
      <DataRow label="id" value={String(request.id)} mono />
      <DataRow
        label="status"
        value={<Badge variant="secondary">{WithdrawStatus[request.status] ?? String(request.status)}</Badge>}
      />
      <DataRow label="totalAmount" value={`${formatUsd(request.totalAmount, decimals)} USDC`} mono />
      <DataRow label="parts" value={String(request.parts.length)} mono />
      <DataRow label="cooldownEnds" value={new Date(Number(request.cooldownEndTime) * 1000).toLocaleString()} />
    </DataList>
  );
}
