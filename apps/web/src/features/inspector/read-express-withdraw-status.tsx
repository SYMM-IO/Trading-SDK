"use client";

import { DataList, DataRow } from "@/components/data-list";
import { Field } from "@/components/field";
import { ResultError, ResultNote } from "@/components/result";
import { formatUsd } from "@/lib/format";
import type { ExpressWithdrawStatus } from "@symmio/trading-core";
import { isExpressWithdrawPayoutComplete, useExpressWithdrawStatus, useSymmioConfig } from "@symmio/trading-react";
import { Badge } from "@symmio/ui/components/badge";
import { Button } from "@symmio/ui/components/button";
import { Input } from "@symmio/ui/components/input";
import { Spinner } from "@symmio/ui/components/spinner";
import { useState } from "react";
import { isAddress, zeroAddress, type Address, type Hex } from "viem";
import { ExpressWithdrawConfigNote } from "./express-withdraw-config-note";
import { formatUnixSeconds } from "./express-withdraw-route-view";
import { MethodCard } from "./method-card";
import { Section } from "./section";
import { SubAccountField } from "./subaccount-field";

function parseRequestId(value: string): bigint | undefined {
  if (!/^\d+$/.test(value.trim())) return undefined;
  return BigInt(value.trim());
}

export function ReadExpressWithdrawStatus() {
  const { addresses } = useSymmioConfig().getChainConfig();
  const [user, setUser] = useState<string>("");
  const [requestId, setRequestId] = useState<string>("");

  /**
   * The request last read. Set on "Read" only, so typing an id never fires a
   * request; once set, the hook polls it every 3 s until payout or a terminal
   * failure. Editing either input clears it, so a result never outlives its inputs.
   */
  const [request, setRequest] = useState<{ user: Address; requestId: bigint }>();

  const validUser = isAddress(user) ? (user as Address) : undefined;
  const validRequestId = parseRequestId(requestId);
  const ready = validUser !== undefined && validRequestId !== undefined;

  const query = useExpressWithdrawStatus({
    user: request?.user ?? zeroAddress,
    requestId: request?.requestId ?? 0n,
    query: { enabled: request !== undefined },
  });

  function onRead() {
    if (!validUser || validRequestId === undefined) return;
    /** Edits clear `request`, so a set one still matches the inputs. */
    if (request) void query.refetch();
    else setRequest({ user: validUser, requestId: validRequestId });
  }

  return (
    <MethodCard
      testId="method-getExpressWithdrawStatus"
      name="getExpressWithdrawStatus"
      mutability="view"
      description="Provider (on-chain) and service progress for one Express request. Polls until the receiver is paid or the request stops."
      wide
    >
      <ExpressWithdrawConfigNote />

      <SubAccountField
        idPrefix="express-status-user"
        label="user (subaccount address)"
        value={user}
        onValueChange={(next) => {
          setUser(next);
          setRequest(undefined);
        }}
        invalid={user.length > 0 && !validUser}
      />

      <Field label="requestId" htmlFor="input-express-status-request-id">
        <Input
          id="input-express-status-request-id"
          data-testid="input-express-status-request-id"
          value={requestId}
          onChange={(e) => {
            setRequestId(e.target.value);
            setRequest(undefined);
          }}
          placeholder="1"
          inputMode="numeric"
          aria-invalid={requestId.length > 0 && validRequestId === undefined}
        />
      </Field>

      <Button
        type="button"
        size="sm"
        disabled={!ready || query.isFetching}
        onClick={onRead}
        data-testid="button-read-express-status"
      >
        {query.isFetching ? (
          <>
            <Spinner className="size-4" /> Reading…
          </>
        ) : (
          "Read"
        )}
      </Button>

      <ResultPanel testId="result-getExpressWithdrawStatus" query={query} decimals={addresses.collateralDecimals} />
    </MethodCard>
  );
}

function ResultPanel({
  testId,
  query,
  decimals,
}: {
  testId: string;
  query: ReturnType<typeof useExpressWithdrawStatus>;
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
    return <ResultNote testId={`${testId}-idle`}>Enter a subaccount and request id to read its progress.</ResultNote>;
  }

  const { onChain, local, code } = query.data;
  const usdc = (raw: bigint) => `${formatUsd(raw, decimals)} USDC`;
  return (
    <div data-testid={`${testId}-data`} className="flex flex-col gap-4">
      <PayoutBadge status={query.data} />

      <div className="grid grid-cols-1 items-start gap-x-8 gap-y-4 @3xl:grid-cols-2">
        <Section title="provider (on-chain)">
          <DataList>
            <DataRow label="status" value={<Badge variant="secondary">{onChain.status}</Badge>} />
            <DataRow label="optionType" value={onChain.optionType} mono />
            <DataRow label="expressAmount" value={usdc(onChain.expressAmount)} mono />
            <DataRow label="acceptedAt" value={formatUnixSeconds(onChain.acceptedAt)} />
            <DataRow label="finalizedAt" value={formatUnixSeconds(onChain.finalizedAt)} />
            <DataRow label="cooldownEnds" value={formatUnixSeconds(onChain.cooldownEndTime)} />
            {onChain.maxAccelerationFee !== undefined ? (
              <DataRow label="maxAccelerationFee" value={usdc(onChain.maxAccelerationFee)} mono />
            ) : null}
            {onChain.accelerationFee !== undefined ? (
              <DataRow label="accelerationFee" value={usdc(onChain.accelerationFee)} mono />
            ) : null}
          </DataList>
        </Section>

        <Section title="service">
          <DataList>
            <DataRow label="status" value={<Badge variant="secondary">{local.status}</Badge>} />
            {code ? <DataRow label="code" value={code} mono /> : null}
            <DataRow label="riskChecked" value={String(local.riskChecked)} mono />
            <DataRow label="riskScore" value={local.riskScore === null ? undefined : String(local.riskScore)} mono />
            <HashRow label="lockTx" hash={local.lockTxHash} />
            <HashRow label="processTx" hash={local.processTxHash} />
            <HashRow label="finalizeTx" hash={local.finalizeTxHash} />
          </DataList>
        </Section>
      </div>
    </div>
  );
}

/**
 * Receiver payout, not core finalization: a STANDARD request is `FINALIZED`
 * on-chain before the provider pays, so the badge follows
 * `isExpressWithdrawPayoutComplete` rather than the raw status.
 */
function PayoutBadge({ status }: { status: ExpressWithdrawStatus }) {
  if (isExpressWithdrawPayoutComplete(status)) {
    return <Badge variant="positive">receiver paid</Badge>;
  }
  return <Badge variant="warning">payout pending</Badge>;
}

function HashRow({ label, hash }: { label: string; hash: Hex | null }) {
  return <DataRow label={label} value={hash ?? undefined} mono copyValue={hash ?? undefined} />;
}
