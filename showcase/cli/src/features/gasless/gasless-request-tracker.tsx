import { GaslessRequestStatus, type GaslessService } from "@symmio/trading-core";
import { Box, Text, useInput } from "ink";
import { useEffect, useState } from "react";
import { glyph, theme } from "../../config/theme.js";
import type { GaslessJournalEntry } from "../../sdk/gasless-request-journal.js";
import { useGaslessRequestLifecycle } from "../../sdk/use-gasless.js";
import { Field, Segmented, type SegmentOption } from "../../ui/controls.js";
import { ErrorLine, LoadingLine } from "../../ui/feedback.js";
import { KeyValue, Panel, StatusDot } from "../../ui/kit.js";
import { useFormNav } from "../form-nav.js";
import { gaslessFailureMessage } from "./gasless-error.js";
import { formatGaslessAttempt, gaslessStatusColor, shortGaslessId } from "./gasless-format.js";
import type { TrackedGaslessRequest } from "./gasless-screen.js";

interface Props {
  active: boolean;
  tracked?: TrackedGaslessRequest;
  recent: readonly GaslessJournalEntry[];
  onTrack: (request: TrackedGaslessRequest) => void;
}

const SERVICES: readonly SegmentOption<GaslessService>[] = [
  { key: "operations", label: "operations" },
  { key: "deposits", label: "deposits" },
];

/** Request-id tracker with stream health, polling fallback, and replacement-attempt history. */
export function GaslessRequestTracker({ active, tracked, recent, onTrack }: Props) {
  const [draft, setDraft] = useState(tracked?.requestId ?? "");
  const [service, setService] = useState<GaslessService>(tracked?.service ?? "operations");
  const [recentIndex, setRecentIndex] = useState(0);
  const { row } = useFormNav(3, active, (current) => current === 0);
  const lifecycle = useGaslessRequestLifecycle({
    enabled: tracked !== undefined,
    requestId: tracked?.requestId ?? "",
    service: tracked?.service ?? "operations",
  });

  useEffect(() => {
    if (!tracked) return;
    setDraft(tracked.requestId);
    setService(tracked.service);
  }, [tracked]);

  function startTracking(): void {
    const requestId = draft.trim();
    if (!requestId) return;
    onTrack({ requestId, service });
  }

  function pickRecent(): void {
    if (recent.length === 0) return;
    const index = recentIndex % recent.length;
    const entry = recent[index];
    if (!entry) return;
    setDraft(entry.requestId);
    setService(entry.service);
    onTrack({ requestId: entry.requestId, service: entry.service });
    setRecentIndex((index + 1) % recent.length);
  }

  useInput(
    (input, key) => {
      if (row === 1 && (key.leftArrow || key.rightArrow)) {
        setService((current) => (current === "operations" ? "deposits" : "operations"));
      } else if (row === 2 && key.return) {
        startTracking();
      } else if (row !== 0 && input === "r") {
        void lifecycle.request.refetch();
        void lifecycle.attempts.refetch();
      } else if (row !== 0 && input === "p") {
        pickRecent();
      }
    },
    { isActive: active },
  );

  const request = lifecycle.request.data;
  const status = request?.status;
  const attempts = lifecycle.attempts.data ?? [];
  const streamColor = lifecycle.stream.live
    ? theme.positive
    : lifecycle.stream.status === "degraded"
      ? theme.warning
      : theme.info;

  return (
    <Box flexDirection="column" gap={1} flexGrow={1}>
      <Panel title="Track request" focused={active}>
        <Field
          label="Request id"
          value={draft}
          onChange={setDraft}
          onSubmit={startTracking}
          focused={row === 0}
          placeholder="request UUID"
          hint="The stable workflow handle; a transaction hash may be replaced."
          labelWidth={12}
        />
        <Box marginTop={1}>
          <Box width={12}>
            <Text color={row === 1 ? theme.primaryBright : theme.muted}>Service</Text>
          </Box>
          <Text color={row === 1 ? theme.primaryBright : theme.faint}>{row === 1 ? `${glyph.caret} ` : "  "}</Text>
          <Segmented options={SERVICES} value={service} focused={row === 1} onChange={setService} />
        </Box>
        <Box marginTop={1} justifyContent="space-between">
          <Text color={draft.trim() ? theme.primaryBright : theme.faint} bold={Boolean(draft.trim())}>
            {row === 2 ? `${glyph.caret} ` : "  "}Track request {row === 2 ? "⏎" : ""}
          </Text>
          <Text color={theme.faint}>{recent.length > 0 ? "↓ then p recent · r refresh" : "r refresh"}</Text>
        </Box>
        {recent.length > 0 && (
          <Text color={theme.faint}>
            recent ·{" "}
            {recent
              .slice(0, 3)
              .map((entry) => shortGaslessId(entry.requestId, 8, 4))
              .join(" · ")}
          </Text>
        )}
      </Panel>

      {!tracked ? (
        <Panel title="Lifecycle" flexGrow={1}>
          <Text color={theme.muted}>
            {recent.length > 0
              ? "Enter a request id, or move off the field and press p for a recent one."
              : "Enter a request id to begin tracking."}
          </Text>
        </Panel>
      ) : lifecycle.request.isPending && !request ? (
        <Panel title="Lifecycle" flexGrow={1}>
          <LoadingLine label="Resolving request…" />
        </Panel>
      ) : request ? (
        <Box flexDirection="row" gap={1} flexGrow={1}>
          <Panel
            title="Lifecycle"
            right={status ? <StatusDot color={gaslessStatusColor(status)} label={status} /> : undefined}
            flexGrow={1}
          >
            <KeyValue label="Request" value={request.requestId} />
            <KeyValue label="Service" value={request.service} />
            <KeyValue label="Transaction" value={shortGaslessId(request.txHash)} />
            <KeyValue label="Owner" value={request.owner ?? "—"} />
            <KeyValue label="Wallet ids" value={request.walletIds.map(String).join(", ") || "—"} />
            {request.service === "operations" ? (
              <>
                <KeyValue label="Operation" value={request.operationType ?? "—"} />
                <KeyValue label="Account id" value={request.accountId ?? "—"} />
                <KeyValue label="Accepted fee (raw)" value={request.feeAmountRaw?.toString() ?? "—"} dim />
              </>
            ) : (
              <>
                <KeyValue label="Deposit address" value={request.depositAddress ?? "—"} />
                <KeyValue label="Deposit wallet" value={request.walletId.toString()} />
                <KeyValue label="Account name" value={request.accountName ?? "—"} />
                <KeyValue label="Observed (raw)" value={request.amountRaw?.toString() ?? "—"} dim />
                <KeyValue label="Accepted fee (raw)" value={request.feeRaw?.toString() ?? "—"} dim />
                <KeyValue label="Quoted credit (raw)" value={request.creditedRaw?.toString() ?? "—"} dim />
              </>
            )}
            <KeyValue label="Updated" value={request.updatedAt ?? "—"} />
            {request.errorCode && <KeyValue label="Error code" value={request.errorCode} color={theme.negative} />}
            {request.errorMessage && <Text color={theme.negative}>{request.errorMessage}</Text>}
            {lifecycle.request.error != null && (
              <Text color={theme.warning}>
                Last data retained; status transport is temporarily unavailable:{" "}
                {gaslessFailureMessage(lifecycle.request.error)}
              </Text>
            )}
          </Panel>

          <Panel
            title="Broadcast attempts"
            right={<StatusDot color={streamColor} label={lifecycle.stream.live ? "stream" : "polling"} />}
            width={48}
          >
            {attempts.length === 0 ? (
              <Text color={theme.faint}>No transaction broadcast yet.</Text>
            ) : (
              attempts.slice(-5).map((attempt) => (
                <Box key={attempt.id} flexDirection="column" marginBottom={1}>
                  <Text color={attempt.status === "confirmed" ? theme.positive : theme.muted}>
                    {formatGaslessAttempt(attempt)}
                  </Text>
                  {attempt.errorMessage && <Text color={theme.negative}>{attempt.errorMessage}</Text>}
                </Box>
              ))
            )}
            {lifecycle.stream.detail && <Text color={theme.faint}>{lifecycle.stream.detail.detail}</Text>}
            {lifecycle.attempts.error != null && (
              <Text color={theme.warning}>Attempt history unavailable; request tracking continues.</Text>
            )}
            {status === GaslessRequestStatus.SUBMITTED && (
              <Text color={theme.warning}>Submitted is not success; keep tracking the request.</Text>
            )}
          </Panel>
        </Box>
      ) : lifecycle.request.error != null ? (
        <Panel title="Lifecycle" flexGrow={1}>
          <ErrorLine message={gaslessFailureMessage(lifecycle.request.error)} />
        </Panel>
      ) : null}
    </Box>
  );
}
