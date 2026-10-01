"use client";

import { DataList, DataRow } from "@/components/data-list";
import { Field } from "@/components/field";
import { InfoIcon } from "@/components/info-icon";
import { ResultError, ResultNote, ResultSuccess } from "@/components/result";
import { GaslessRequestStatus, useGaslessRequest, useSymmioChainId } from "@symmio/trading-react";
import { Badge } from "@symmio/ui/components/badge";
import { Button } from "@symmio/ui/components/button";
import { Input } from "@symmio/ui/components/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@symmio/ui/components/tooltip";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { GaslessCard } from "./gasless-card";
import {
  parseGaslessRequests,
  readGaslessRequestsRaw,
  subscribeGaslessRequests,
  updateStoredGaslessRequestStatus,
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

  /**
   * The SDK picks the transport: it streams where the deployment enables the
   * status WebSocket and polls otherwise, stopping at a terminal status.
   */
  const request = useGaslessRequest({ requestId, service, query: { enabled: requestId.trim().length > 0 } });

  /** Write the terminal status back, so a reload stops treating this as open. */
  const status = request.data?.status;
  useEffect(() => {
    if (!status || !requestId) return;
    updateStoredGaslessRequestStatus(chainId, requestId, status);
  }, [chainId, requestId, status]);

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
      ) : request.data ? (
        /**
         * Data first, even while a read is failing: once the service has
         * accepted a workflow it keeps running, so a `429` or a dropped
         * connection is a stale view, never a failed relay.
         */
        <ResultSuccess testId="gasless-request-result">
          <DataList>
            <DataRow
              label="Status"
              value={
                <span className="inline-flex items-center gap-2">
                  <Badge variant={statusVariant(request.data.status)}>{request.data.status}</Badge>
                  <Badge variant={request.stream.live ? "positive" : "info"}>
                    {request.stream.live ? "live" : "polling"}
                  </Badge>
                </span>
              }
            />
            <DataRow
              label="Tx hash"
              value={request.data.txHash ?? "—"}
              mono
              copyValue={request.data.txHash ?? undefined}
            />
            <DataRow
              label="Operation"
              value={(request.data.service === "operations" ? request.data.operationType : null) ?? "—"}
              mono
            />
            {request.data.walletIds.length > 0 ? (
              <DataRow label={<WalletIdsLabel />} value={request.data.walletIds.join(", ")} mono />
            ) : null}
            {request.data.owner ? (
              <DataRow label="Owner" value={request.data.owner} mono copyValue={request.data.owner} />
            ) : null}
            {request.data.errorCode ? <DataRow label="Error code" value={request.data.errorCode} mono /> : null}
            {request.data.errorMessage ? <DataRow label="Error message" value={request.data.errorMessage} /> : null}
          </DataList>
          {request.error ? (
            <ResultNote testId="gasless-request-degraded">
              Status is temporarily unavailable ({request.error.message}). The workflow keeps running; this view will
              catch up.
            </ResultNote>
          ) : null}
        </ResultSuccess>
      ) : request.error ? (
        <ResultError kind={request.error.kind} message={request.error.message} testId="gasless-request-error" />
      ) : null}
    </GaslessCard>
  );
}

/**
 * The wallet-id row's label. The service stores one id per operation, and `0`
 * reads like "wallet 0 was used" when it mostly means "not a wallet call" — so
 * the label says what the list is, and the tooltip what each value means.
 */
function WalletIdsLabel() {
  return (
    <span className="inline-flex items-center gap-1.5">
      Wallet id per operation
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="What the wallet ids mean"
            className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/30 inline-flex items-center justify-center rounded-full outline-none focus-visible:ring-2"
          >
            <InfoIcon />
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          One id per operation, in batch order. 0 is an ordinary write — or a call from the original wallet; a positive
          id is a call from that GaslessWallet. A batch can mix them.
        </TooltipContent>
      </Tooltip>
    </span>
  );
}
