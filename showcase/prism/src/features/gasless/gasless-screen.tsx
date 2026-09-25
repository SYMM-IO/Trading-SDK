"use client";

import { Panel } from "@/components/panel";
import { ChainPill, Pill } from "@/components/pill";
import { EmptyState } from "@/components/table";
import { ConnectButton } from "@/features/wallet/connect-button";
import {
  SymmioSupportedChainId,
  type GaslessAcceptedRequest,
  type GaslessUnconfirmedSubmit,
} from "@symmio/trading-core";
import { useSupportsGaslessService, useWalletAccount } from "@symmio/trading-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AdvancedGaslessOperationLab } from "./advanced-operation-lab";
import { GaslessDepositPanel } from "./gasless-deposit-panel";
import { GaslessFeePanel } from "./gasless-fee-panel";
import { GaslessRecoveryPanel } from "./gasless-recovery-panel";
import { GaslessRequestMonitor } from "./gasless-request-monitor";
import { GaslessWalletCallPanel } from "./gasless-wallet-call-panel";
import { GaslessWalletDiagnosticsPanel } from "./gasless-wallet-diagnostics-panel";
import {
  clearPendingGaslessSubmit,
  loadPendingGaslessSubmit,
  savePendingGaslessSubmit,
} from "./pending-gasless-submit";
import { saveRecentGaslessRequest, type RecentGaslessRequest } from "./recent-request";
import { SessionKeySecurityPanel } from "./session-key-security-panel";
import { parseGaslessWalletId } from "./wallet-id";

/** Complete gasless onboarding and operations control surface. */
export function GaslessScreen() {
  const { isConnected } = useWalletAccount();
  const supported = useSupportsGaslessService({ chainId: SymmioSupportedChainId.ARBITRUM });
  const [accepted, setAccepted] = useState<RecentGaslessRequest | null>(null);
  const [pending, setPending] = useState<GaslessUnconfirmedSubmit | null>(null);
  const [walletIdText, setWalletIdText] = useState("0");
  const walletId = useMemo(() => parseGaslessWalletId(walletIdText), [walletIdText]);

  useEffect(() => setPending(loadPendingGaslessSubmit()), []);

  const onAccepted = useCallback((request: GaslessAcceptedRequest) => {
    setAccepted(saveRecentGaslessRequest(request));
  }, []);
  const onPendingChange = useCallback((submit: GaslessUnconfirmedSubmit | null) => {
    if (submit) savePendingGaslessSubmit(submit);
    else clearPendingGaslessSubmit();
    setPending(submit);
  }, []);

  if (!isConnected) {
    return (
      <div className="mx-auto w-full max-w-[1180px] px-5 py-6">
        <Panel>
          <EmptyState
            title="Connect a wallet to use gasless execution"
            body="Your wallet owns each deterministic gasless deposit address and every destination sub-account. Connect to derive the correct route."
            action={<ConnectButton />}
          />
        </Panel>
      </div>
    );
  }

  if (!supported) {
    return (
      <div className="mx-auto w-full max-w-[1180px] px-5 py-6">
        <Panel>
          <EmptyState
            title="Gasless service unavailable"
            body="This deployment does not expose a compatible GaslessQ service. Prism keeps the workflow hidden rather than submitting to an unsupported chain."
          />
        </Panel>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-4 px-5 py-6">
      <section className="flex flex-col gap-4 rounded-xl border border-line bg-bg-1 px-5 py-5 shadow-[var(--shadow-card)] md:flex-row md:items-end md:justify-between">
        <div className="flex max-w-[720px] flex-col gap-2">
          <span className="text-2xs font-semibold tracking-[0.12em] text-accent uppercase">
            GaslessQ · live SDK flow
          </span>
          <h1 className="font-display text-3xl font-bold tracking-[-0.035em] text-fg-0">
            Fund once. Trade without gas prompts.
          </h1>
          <p className="text-md leading-relaxed text-fg-2">
            Deposit collateral into a deterministic wallet, settle it into your trading account, approve a bounded fee
            budget, and follow every relayed request from queue to receipt.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ChainPill family="lowcaps" />
          <Pill dot color="var(--long-500)">
            status stream
          </Pill>
          <Pill>multi-wallet</Pill>
        </div>
      </section>

      <GaslessWalletDiagnosticsPanel
        walletIdText={walletIdText}
        walletId={walletId}
        onWalletIdChange={setWalletIdText}
      />

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <GaslessDepositPanel walletId={walletId} onAccepted={onAccepted} onUnconfirmed={onPendingChange} />
        <GaslessFeePanel />
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.55fr)]">
        <GaslessRequestMonitor accepted={accepted} />
        <GaslessRecoveryPanel pending={pending} onAccepted={onAccepted} onPendingChange={onPendingChange} />
      </div>

      <GaslessWalletCallPanel walletId={walletId} onAccepted={onAccepted} onUnconfirmed={onPendingChange} />

      <AdvancedGaslessOperationLab onAccepted={onAccepted} onUnconfirmed={onPendingChange} />

      <SessionKeySecurityPanel />

      <p className="px-1 text-2xs leading-relaxed text-fg-3">
        Deposit settlement and operations are separate relay services. Prism persists the latest acceptance immediately
        because the gateway intentionally has no list-by-wallet endpoint; the request id is the durable recovery handle.
      </p>
    </div>
  );
}
