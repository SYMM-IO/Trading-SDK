"use client";

import { DataList, DataRow } from "@/components/data-list";
import { Field } from "@/components/field";
import { ResultError, ResultNote, ResultSuccess } from "@/components/result";
import { GaslessRequestStatus, useGaslessRequest, useSymmioChainId } from "@symmio/trading-react";
import { Badge } from "@symmio/ui/components/badge";
import { Button } from "@symmio/ui/components/button";
import { Input } from "@symmio/ui/components/input";
import { useMemo, useState, useSyncExternalStore } from "react";
import { GaslessCard } from "./gasless-card";
import {
  parseGaslessRequests,
  readGaslessRequestsRaw,
  subscribeGaslessRequests,
  type StoredGaslessRequest,
} from "./gasless-request-storage";

/** Badge variant per lifecycle status. */
function statusVariant(status: GaslessRequestStatus): "positive" | "negative" | "info" | "warning" {
  switch (status) {
    case GaslessRequestStatus.SUCCEEDED:
      return "positive";
    case GaslessRequestStatus.REVERTED:
    case GaslessRequestStatus.FAILED:
    case GaslessRequestStatus.REJECTED:
      return "negative";
    case GaslessRequestStatus.SUBMITTED:
      return "warning";
    default:
      return "info";
  }
}

/**
 * Request-status card: paste (or pick a persisted) request id and poll it to a
 * terminal status with the service-recommended cadence.
 */
export function GaslessRequestCard() {
  const chainId = useSymmioChainId();
  const [requestId, setRequestId] = useState("");
  const [service, setService] = useState<"operations" | "deposits">("operations");

  const raw = useSyncExternalStore(
    subscribeGaslessRequests,
    () => readGaslessRequestsRaw(chainId),
    () => null,
  );
  const recent = useMemo(() => parseGaslessRequests(raw), [raw]);

  /** The SDK supplies the poll cadence and stops at a terminal status. */
  const request = useGaslessRequest({ requestId, service, query: { enabled: requestId.trim().length > 0 } });

  return (
    <GaslessCard
      testId="gasless-request"
      method="useGaslessRequest"
      description="Poll one relayer request to a terminal status. `submitted` only means a transaction hash exists — only `succeeded` is success."
      wide
    >
      <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
        <Field label="Request id" htmlFor="gasless-request-id" hint="The `requestId` a relay submit returned.">
          <Input
            id="gasless-request-id"
            value={requestId}
            onChange={(event) => setRequestId(event.target.value.trim())}
            placeholder="9a7a7a72-…"
            className="font-mono"
            data-testid="input-gasless-request-id"
          />
        </Field>
        <Field label="Service" htmlFor="gasless-request-service" hint="Deposit settlements live on a separate service.">
          <div className="flex gap-2">
            {(["operations", "deposits"] as const).map((option) => (
              <Button
                key={option}
                type="button"
                size="sm"
                variant={service === option ? "default" : "outline"}
                onClick={() => setService(option)}
                data-testid={`button-gasless-service-${option}`}
              >
                {option}
              </Button>
            ))}
          </div>
        </Field>
      </div>

      {recent.length > 0 ? (
        <Field
          label="Recent requests"
          hint="Accepted requests persisted by this app (there is no list-by-wallet endpoint)."
        >
          <div className="flex flex-wrap gap-2">
            {recent.slice(0, 6).map((entry: StoredGaslessRequest) => (
              <Button
                key={entry.requestId}
                type="button"
                size="sm"
                variant="outline"
                className="font-mono text-xs"
                onClick={() => {
                  setRequestId(entry.requestId);
                  setService(entry.service);
                }}
              >
                {entry.operationType} · {entry.requestId.slice(0, 8)}…
              </Button>
            ))}
          </div>
        </Field>
      ) : null}

      {requestId.length === 0 ? (
        <ResultNote testId="gasless-request-idle">Enter a request id to start polling.</ResultNote>
      ) : request.isPending ? (
        <ResultNote loading testId="gasless-request-loading">
          Fetching request…
        </ResultNote>
      ) : request.error ? (
        <ResultError kind={request.error.kind} message={request.error.message} testId="gasless-request-error" />
      ) : request.data ? (
        <ResultSuccess testId="gasless-request-result">
          <DataList>
            <DataRow
              label="Status"
              value={<Badge variant={statusVariant(request.data.status)}>{request.data.status}</Badge>}
            />
            <DataRow
              label="Tx hash"
              value={request.data.txHash ?? "—"}
              mono
              copyValue={request.data.txHash ?? undefined}
            />
            <DataRow label="Operation" value={request.data.operationType ?? "—"} mono />
            {request.data.errorCode ? <DataRow label="Error code" value={request.data.errorCode} mono /> : null}
            {request.data.errorMessage ? <DataRow label="Error message" value={request.data.errorMessage} /> : null}
          </DataList>
        </ResultSuccess>
      ) : null}
    </GaslessCard>
  );
}
