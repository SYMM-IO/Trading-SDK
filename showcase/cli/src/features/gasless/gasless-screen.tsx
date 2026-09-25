import { GaslessRequestStatus, type GaslessDepositSubmitReceipt, type GaslessService } from "@symmio/trading-core";
import { Box, Text, useInput, useStdout } from "ink";
import { useCallback, useEffect, useState } from "react";
import { maxUint256 } from "viem";
import { glyph, theme } from "../../config/theme.js";
import {
  loadGaslessJournal,
  storeGaslessJournalEntry,
  type GaslessJournalEntry,
} from "../../sdk/gasless-request-journal.js";
import { useGaslessCapability } from "../../sdk/use-gasless.js";
import { useSdkScope } from "../../sdk/use-sdk-scope.js";
import { useSigner } from "../../sdk/use-signer.js";
import { Segmented, type SegmentOption } from "../../ui/controls.js";
import { KeyValue, Panel, ScreenTitle, StatusDot } from "../../ui/kit.js";
import { useAppState } from "../app-state.js";
import { useToast } from "../toast.js";
import { GaslessAllowance } from "./gasless-allowance.js";
import { GaslessOverview } from "./gasless-overview.js";
import { GaslessRequestTracker } from "./gasless-request-tracker.js";

type GaslessView = "overview" | "allowance" | "request";

export interface TrackedGaslessRequest {
  requestId: string;
  service: GaslessService;
}

interface Props {
  active: boolean;
}

const VIEWS: readonly SegmentOption<GaslessView>[] = [
  { key: "overview", label: "Wallet & deposit" },
  { key: "allowance", label: "Fee allowance" },
  { key: "request", label: "Request status" },
];

/** Chain-gated GaslessQ operations console with safe onboarding and lifecycle recovery. */
export function GaslessScreen({ active }: Props) {
  const { chainId, deployment } = useSdkScope();
  const { address: owner } = useSigner();
  const { textEditing } = useAppState();
  const toast = useToast();
  const capability = useGaslessCapability();
  const [view, setView] = useState<GaslessView>("overview");
  const [walletId, setWalletId] = useState(0n);
  const [tracked, setTracked] = useState<TrackedGaslessRequest>();
  const [recent, setRecent] = useState<GaslessJournalEntry[]>([]);

  useEffect(() => {
    let cancelled = false;
    setTracked(undefined);
    setRecent([]);
    if (!capability.supported || !owner) return;

    void loadGaslessJournal({
      chainId,
      owner,
      protocolInstance: capability.service?.protocolInstance ?? null,
    }).then((entries) => {
      if (cancelled) return;
      setRecent(entries);
      const latest = entries[0];
      if (latest) setTracked({ requestId: latest.requestId, service: latest.service });
    });

    return () => {
      cancelled = true;
    };
  }, [chainId, owner, capability.supported, capability.service?.protocolInstance]);

  useInput(
    (input) => {
      const index = VIEWS.findIndex((candidate) => candidate.key === view);
      // Section brackets are reserved navigation even while a field owns text
      // input. Switching unmounts that field, so the bracket is never retained.
      if (input === "]") setView(VIEWS[(index + 1) % VIEWS.length]!.key);
      else if (input === "[") setView(VIEWS[(index - 1 + VIEWS.length) % VIEWS.length]!.key);
      else if (textEditing) return;
      else if (input === "," && walletId > 0n) setWalletId((current) => current - 1n);
      else if (input === "." && walletId < maxUint256) setWalletId((current) => current + 1n);
    },
    { isActive: active && capability.supported },
  );

  const onAccepted = useCallback(
    (receipt: GaslessDepositSubmitReceipt) => {
      const now = Date.now();
      const entry: GaslessJournalEntry = {
        requestId: receipt.requestId,
        service: "deposits",
        chainId,
        protocolInstance: receipt.protocolInstance,
        operationType: "deposit-existing-account",
        owner: receipt.owner,
        walletIds: [receipt.walletId.toString()],
        status: receipt.status ?? GaslessRequestStatus.QUEUED,
        acceptedAt: now,
        updatedAt: now,
      };
      void storeGaslessJournalEntry(entry);
      setRecent((current) => [entry, ...current.filter((candidate) => candidate.requestId !== entry.requestId)]);
      setTracked({ requestId: receipt.requestId, service: "deposits" });
      setView("request");
      toast.push("pending", `Settlement accepted · ${receipt.requestId}`);
    },
    [chainId, toast],
  );

  function onTrack(next: TrackedGaslessRequest): void {
    setTracked(next);
  }

  return (
    <Box flexDirection="column" flexGrow={1}>
      <ScreenTitle title="Gasless" subtitle={`${deployment.label} · ${deployment.solverLabel}`} />
      <ServiceSummary />

      {!capability.supported ? (
        <Panel title="Unavailable" focused={active} flexGrow={1}>
          <Box flexDirection="column" gap={1}>
            <Text color={theme.warning}>
              {glyph.dot} This deployment has no compatible GaslessQ service configured.
            </Text>
            <Text color={theme.muted}>
              Gasless requires a complete perps-core 0.8.6 deployment profile: gateway, protocol instance, GaslessLayer,
              InstantLayer, and matching Core contracts.
            </Text>
            <Text color={theme.faint}>
              The SDK production registry intentionally ships no gasless block. Do not pair a staging gateway with these
              production contract addresses.
            </Text>
          </Box>
        </Panel>
      ) : (
        <>
          <Box justifyContent="space-between" marginY={1}>
            <Segmented options={VIEWS} value={view} focused={active} onChange={setView} />
            <Text color={theme.faint}>
              wallet {walletId.toString()} · [ ] section
              {!textEditing ? " · , . wallet" : " · ↑↓ leave field"}
            </Text>
          </Box>
          {view === "overview" && <GaslessOverview active={active} walletId={walletId} onAccepted={onAccepted} />}
          {view === "allowance" && <GaslessAllowance active={active} walletId={walletId} />}
          {view === "request" && (
            <GaslessRequestTracker active={active} tracked={tracked} recent={recent} onTrack={onTrack} />
          )}
        </>
      )}
    </Box>
  );
}

function ServiceSummary() {
  const capability = useGaslessCapability();
  const { chainId } = useSdkScope();
  const { stdout } = useStdout();
  const service = capability.service;
  const wide = (stdout?.columns ?? 100) >= 120;

  return (
    <Panel
      title="Service"
      right={
        <StatusDot
          color={capability.supported ? theme.positive : theme.faint}
          label={capability.supported ? "configured" : "unsupported"}
        />
      }
    >
      <Box flexDirection={wide ? "row" : "column"} gap={wide ? 3 : 0}>
        <Box flexDirection="column" flexGrow={1}>
          <KeyValue label="Chain / contracts" value={`${chainId} / ${capability.contractsVersion}`} />
          <KeyValue label="Gateway" value={service?.url ?? "not configured"} dim={!service} />
          <KeyValue label="Protocol instance" value={service?.protocolInstance ?? "—"} dim={!service} />
        </Box>
        <Box flexDirection="column" width={wide ? 58 : undefined}>
          <KeyValue label="GaslessLayer" value={service?.gaslessLayerAddress ?? "—"} dim={!service} />
          <KeyValue label="Execution" value={service?.execution?.mode ?? "wallet"} />
          <KeyValue
            label="Transport"
            value={capability.operationsStream || capability.depositsStream ? "WebSocket + poll fallback" : "polling"}
          />
          <KeyValue label="Auth" value={service?.apiKey ? "partner key configured" : "anonymous / none"} />
        </Box>
      </Box>
    </Panel>
  );
}
