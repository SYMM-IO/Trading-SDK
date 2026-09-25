"use client";

import { CopyAction, DetailRow, DetailSection } from "@/components/detail-list";
import { Field } from "@/components/field";
import { Panel, PanelHeader } from "@/components/panel";
import { Pill } from "@/components/pill";
import { Segmented } from "@/components/segmented";
import { Numeric } from "@/components/value";
import { shortenAddress } from "@/lib/format";
import { SymmioSupportedChainId, type GaslessService } from "@symmio/trading-core";
import { useGaslessRequest, useGaslessRequestTransactions } from "@symmio/trading-react";
import { useEffect, useState } from "react";
import { loadRecentGaslessRequest, type RecentGaslessRequest } from "./recent-request";

interface Props {
  accepted: RecentGaslessRequest | null;
}

const SERVICE_OPTIONS = [
  { value: "deposits", label: "Deposits" },
  { value: "operations", label: "Operations" },
] as const;

/** Resume and observe a relay by its durable request id. */
export function GaslessRequestMonitor({ accepted }: Props) {
  const [requestId, setRequestId] = useState("");
  const [service, setService] = useState<GaslessService>("deposits");

  useEffect(() => {
    const restored = accepted ?? loadRecentGaslessRequest();
    if (!restored) return;
    setRequestId(restored.requestId);
    setService(restored.service);
  }, [accepted]);

  const request = useGaslessRequest({
    chainId: SymmioSupportedChainId.ARBITRUM,
    requestId: requestId.trim(),
    service,
    query: { enabled: requestId.trim().length > 0 },
  });
  const attempts = useGaslessRequestTransactions({
    chainId: SymmioSupportedChainId.ARBITRUM,
    requestId: requestId.trim(),
    service,
    status: request.data?.status,
    query: { enabled: requestId.trim().length > 0 },
  });

  const data = request.data;
  const status = data?.status ?? (requestId ? "looking up" : "idle");
  const statusColor =
    status === "succeeded"
      ? "var(--long-500)"
      : status === "failed" || status === "rejected" || status === "reverted"
        ? "var(--short-500)"
        : "var(--accent)";

  return (
    <Panel>
      <PanelHeader
        eyebrow="Relay observability"
        title="Request monitor"
        actions={
          <Pill dot color={statusColor}>
            {status}
          </Pill>
        }
      />
      <div className="flex flex-col gap-5 p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <Field
            label="Request id"
            value={requestId}
            onChange={(event) => setRequestId(event.target.value)}
            placeholder="Paste a GaslessQ request id"
            inputClassName="text-sm"
            footnote="Saved automatically as soon as Prism receives an acceptance."
          />
          <div className="flex items-end">
            <Segmented options={SERVICE_OPTIONS} value={service} onChange={setService} size="sm" />
          </div>
        </div>

        {requestId.trim() ? (
          <DetailSection title="Live workflow" note={request.stream.live ? "WebSocket live" : "Polling fallback"}>
            <DetailRow
              label="Status"
              value={
                <Numeric
                  size="sm"
                  tone={status === "succeeded" ? "long" : statusColor === "var(--short-500)" ? "short" : "accent"}
                >
                  {status}
                </Numeric>
              }
              isLoading={request.isLoading}
            />
            <DetailRow
              label="Request"
              value={<span className="font-mono text-sm text-fg-1">{shortenAddress(requestId, 10, 8)}</span>}
              action={<CopyAction value={requestId} label="request id" />}
            />
            <DetailRow
              label="Transaction"
              value={
                <span className="font-mono text-sm text-fg-1">
                  {data?.txHash ? shortenAddress(data.txHash, 10, 8) : "—"}
                </span>
              }
              action={data?.txHash ? <CopyAction value={data.txHash} label="transaction hash" /> : undefined}
            />
            <DetailRow
              label="Owner"
              value={<span className="font-mono text-sm text-fg-1">{shortenAddress(data?.owner)}</span>}
              action={data?.owner ? <CopyAction value={data.owner} label="owner address" /> : undefined}
            />
            <DetailRow
              label="Wallet ids"
              value={<Numeric size="sm">{data?.walletIds.map(String).join(", ") || "—"}</Numeric>}
            />
            <DetailRow
              label="Broadcast attempts"
              value={<Numeric size="sm">{attempts.data?.length ?? "—"}</Numeric>}
              sub="a replacement does not change the request id"
              isLoading={attempts.isLoading}
            />
            {data?.errorMessage ? (
              <DetailRow
                label="Relay error"
                value={
                  <span className="max-w-[42ch] text-right text-sm whitespace-normal text-short">
                    {data.errorMessage}
                  </span>
                }
                sub={data.errorCode ?? undefined}
              />
            ) : null}
          </DetailSection>
        ) : (
          <p className="text-sm leading-relaxed text-fg-3">
            Submit a deposit settlement or paste an existing request id. Prism follows the status stream while it is
            healthy and falls back to the service polling cadence automatically.
          </p>
        )}

        {attempts.data && attempts.data.length > 0 ? (
          <DetailSection title="Transaction attempts" note="oldest first">
            {attempts.data.map((attempt) => (
              <DetailRow
                key={attempt.id}
                label={`Attempt ${attempt.attemptNumber}`}
                value={
                  <span className="font-mono text-sm text-fg-1">
                    {attempt.txHash ? shortenAddress(attempt.txHash, 10, 8) : attempt.status}
                  </span>
                }
                sub={attempt.status}
                action={
                  attempt.txHash ? <CopyAction value={attempt.txHash} label="attempt transaction hash" /> : undefined
                }
              />
            ))}
          </DetailSection>
        ) : null}
      </div>
    </Panel>
  );
}
