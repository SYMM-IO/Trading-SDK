"use client";

import { Button } from "@/components/button";
import { CopyAction, DetailRow, DetailSection } from "@/components/detail-list";
import { Modal } from "@/components/modal";
import { Panel, PanelHeader } from "@/components/panel";
import { Pill } from "@/components/pill";
import { Segmented } from "@/components/segmented";
import { useToast } from "@/components/toast";
import { Numeric } from "@/components/value";
import { getDeployment } from "@/config/deployments";
import { useSessionKey } from "@/features/session-key/use-session-key";
import { useChainGate } from "@/features/wallet/use-chain-gate";
import { DELEGATION_TTL_SECONDS } from "@/features/wallet/use-trading-delegation";
import { formatDate, shortenAddress } from "@/lib/format";
import { SymmioSupportedChainId } from "@symmio/trading-core";
import {
  useActiveDelegations,
  useAreDelegationsActive,
  useFinalizeRevokeDelegation,
  useGrantDelegation,
  useInitiateRevokeDelegation,
  usePendingRevocation,
  useRevocationCooldown,
  useSessionKeySelectors,
} from "@symmio/trading-react";
import { useState } from "react";
import { zeroAddress } from "viem";
import { useFundingAccounts } from "../accounts/account-provider";

type SelectorScope = "standard" | "trade" | "account" | "withdraw";

const SCOPE_OPTIONS = [
  { value: "standard", label: "Standard" },
  { value: "trade", label: "Trade" },
  { value: "account", label: "Account" },
  { value: "withdraw", label: "Withdraw" },
] as const;

/** Inspect and revoke the local session key's trading authority. */
export function SessionKeySecurityPanel() {
  const account = useFundingAccounts().selected.lowcaps;
  const session = useSessionKey();
  const toast = useToast();
  const gate = useChainGate(getDeployment("lowcaps"));
  const [scope, setScope] = useState<SelectorScope>("standard");
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const enabled = Boolean(account && session.address);
  const delegator = { addr: account?.address ?? zeroAddress, isPartyB: false } as const;
  const delegate = session.address ?? zeroAddress;
  const selectors = useSessionKeySelectors({
    chainId: SymmioSupportedChainId.ARBITRUM,
    trade: scope === "standard" || scope === "trade",
    account: scope === "standard" || scope === "account",
    withdraw: scope === "withdraw",
  });

  const active = useAreDelegationsActive({
    account: delegator,
    delegate,
    selectors,
    chainId: SymmioSupportedChainId.ARBITRUM,
    query: { enabled },
  });
  const canonical = useActiveDelegations({
    delegator,
    delegates: [delegate],
    selectors: [selectors],
    chainId: SymmioSupportedChainId.ARBITRUM,
    query: { enabled },
  });
  const pending = usePendingRevocation({
    account: delegator,
    delegate,
    selectors,
    chainId: SymmioSupportedChainId.ARBITRUM,
    query: { enabled },
  });
  const cooldown = useRevocationCooldown({ chainId: SymmioSupportedChainId.ARBITRUM });
  const grant = useGrantDelegation();
  const initiate = useInitiateRevokeDelegation();
  const finalize = useFinalizeRevokeDelegation();

  async function grantScope() {
    if (!account || !session.address || selectors.length === 0) return;
    if (
      scope === "withdraw" &&
      !window.confirm(
        "Authorise withdrawal calls for this session key? This scope can send collateral to a caller-selected receiver and is intentionally excluded from the standard Prism key.",
      )
    ) {
      return;
    }
    const toastId = toast.push({
      title: `Authorising ${scopeLabel(scope).toLowerCase()}`,
      body: "One wallet signature grants this browser key the selected Prism scope.",
      tone: "pending",
    });
    try {
      await grant.mutateAsync({
        account: { addr: account.address, isPartyB: false },
        delegatedSigner: session.address,
        selectors,
        expiryTimestamp: BigInt(Math.floor(Date.now() / 1000) + DELEGATION_TTL_SECONDS),
        chainId: SymmioSupportedChainId.ARBITRUM,
        gasless: true,
      });
      toast.update(toastId, {
        title: "Session-key scope granted",
        body: `${selectors.length} known Prism selectors are now authorised.`,
        tone: "long",
      });
    } catch (error) {
      toast.update(toastId, {
        title: "Authorisation failed",
        body: error instanceof Error ? error.message : String(error),
        tone: "error",
      });
    }
  }

  async function revoke() {
    if (!account || !session.address || active.activeSelectors.length === 0) return;
    if (!gate.ready) {
      await gate.switchToDeployment();
      return;
    }
    const toastId = toast.push({
      title: "Schedule key revocation",
      body: "Confirm the gas-paid safety transaction in your wallet.",
      tone: "pending",
    });
    try {
      await initiate.mutateAsync({
        account: { addr: account.address, isPartyB: false },
        delegate: session.address,
        selectors: active.activeSelectors,
        chainId: SymmioSupportedChainId.ARBITRUM,
      });
      toast.update(toastId, {
        title: "Revocation scheduled",
        body: "The key remains active only until the on-chain cooldown ends.",
        tone: "warn",
      });
    } catch (error) {
      toast.update(toastId, {
        title: "Revocation failed",
        body: error instanceof Error ? error.message : String(error),
        tone: "error",
      });
    }
  }

  async function finalizeRevocation() {
    if (!account || !session.address) return;
    if (!gate.ready) {
      await gate.switchToDeployment();
      return;
    }
    const toastId = toast.push({ title: "Cleaning up delegation", tone: "pending" });
    try {
      await finalize.mutateAsync({
        account: { addr: account.address, isPartyB: false },
        delegate: session.address,
        selectors: pending.revokingSelectors,
        chainId: SymmioSupportedChainId.ARBITRUM,
      });
      toast.update(toastId, { title: "Delegation cleared", tone: "long" });
    } catch (error) {
      toast.update(toastId, {
        title: "Cleanup failed",
        body: error instanceof Error ? error.message : String(error),
        tone: "error",
      });
    }
  }

  const activeCount = active.isLoading ? undefined : active.activeSelectors.length;
  const state = pending.isFinalizable
    ? "ready to clear"
    : pending.isRevoking
      ? "revoking"
      : active.allActive
        ? "active"
        : activeCount
          ? "partial"
          : "not granted";
  const color =
    pending.isRevoking || pending.isFinalizable ? "var(--warn-500)" : activeCount ? "var(--long-500)" : "var(--fg-3)";
  const canonicalEntry = canonical.data?.find(
    (entry) => entry.delegatedSigner.toLowerCase() === delegate.toLowerCase(),
  );

  return (
    <Panel>
      <PanelHeader
        eyebrow="Safety"
        title="Session-key authority"
        actions={
          <Pill dot color={color}>
            {state}
          </Pill>
        }
      />
      <div className="flex flex-col gap-5 p-4">
        <p className="text-sm leading-relaxed text-fg-2">
          Prism probes only its known selector scopes; the contract does not expose global delegation enumeration.
          Revocation is intentionally two-step: authority ends when the cooldown expires, then anyone may clear the
          stale grant.
        </p>

        <DetailSection title="Current key">
          <DetailRow
            label="Session key"
            value={<span className="font-mono text-sm text-fg-1">{shortenAddress(session.address)}</span>}
          />
          <DetailRow
            label="Probed scope"
            value={<Numeric size="sm">{scopeLabel(scope)}</Numeric>}
            sub={
              activeCount === undefined
                ? "checking"
                : `${activeCount}/${selectors.length} active${scope === "standard" ? " · withdrawals excluded" : ""}`
            }
            isLoading={active.isLoading || session.isLoading}
          />
          <DetailRow
            label="Usable until"
            value={
              <Numeric size="sm">{active.expiryTimestamp ? formatDate(Number(active.expiryTimestamp)) : "—"}</Numeric>
            }
          />
          <DetailRow
            label="Canonical account"
            value={
              <span className="font-mono text-sm text-fg-1">
                {shortenAddress(canonicalEntry?.account.addr ?? account?.address)}
              </span>
            }
            isLoading={canonical.isLoading}
          />
          <DetailRow
            label="Revocation cooldown"
            value={<Numeric size="sm">{formatDuration(cooldown.data)}</Numeric>}
            isLoading={cooldown.isLoading}
          />
          {pending.etaTimestamp ? (
            <DetailRow
              label="Authority ends"
              value={
                <Numeric size="sm" tone="warn">
                  {formatCountdown(pending.secondsRemaining)}
                </Numeric>
              }
              sub={formatDate(Number(pending.etaTimestamp))}
            />
          ) : null}
        </DetailSection>

        <div className="grid gap-2 sm:grid-cols-2">
          <Button type="button" variant="secondary" onClick={() => setInspectorOpen(true)}>
            Inspect selector set
          </Button>
          <Button
            type="button"
            variant={scope === "withdraw" ? "danger" : "secondary"}
            loading={grant.isPending}
            disabled={!enabled || active.allActive || pending.isRevoking || pending.isFinalizable}
            onClick={() => void grantScope()}
          >
            {active.allActive ? "Scope authorised" : `Authorise ${scopeLabel(scope).toLowerCase()}`}
          </Button>
        </div>

        {pending.isFinalizable ? (
          <Button
            type="button"
            variant="secondary"
            loading={finalize.isPending || gate.isSwitching}
            disabled={pending.revokingSelectors.length === 0}
            onClick={() => void finalizeRevocation()}
          >
            {gate.needsSwitch ? `Switch to ${gate.targetName}` : "Clear expired grant"}
          </Button>
        ) : (
          <Button
            type="button"
            variant="danger"
            loading={initiate.isPending || gate.isSwitching}
            disabled={!enabled || active.activeSelectors.length === 0 || pending.isRevoking}
            onClick={() => void revoke()}
          >
            {gate.needsSwitch
              ? `Switch to ${gate.targetName}`
              : pending.isRevoking
                ? "Revocation scheduled"
                : `Revoke ${scopeLabel(scope).toLowerCase()} authority`}
          </Button>
        )}
        {gate.error || active.error || canonical.error || pending.error ? (
          <p className="text-2xs text-short">
            {(gate.error ?? active.error ?? canonical.error ?? pending.error)?.message}
          </p>
        ) : null}
      </div>

      <Modal
        open={inspectorOpen}
        onClose={() => setInspectorOpen(false)}
        eyebrow="Known Prism authority"
        title="Session-key selector inspector"
        width="wide"
      >
        <p className="text-sm leading-relaxed text-fg-2">
          This probes selectors Prism knows how to grant. It is not a global list of every historical delegation. Each
          status comes from the canonicalizing InstantLayer read used by enforcement.
        </p>

        <div className="overflow-x-auto pb-1">
          <Segmented options={SCOPE_OPTIONS} value={scope} onChange={setScope} size="sm" />
        </div>

        {scope === "withdraw" ? (
          <p className="rounded-md border border-warn/40 bg-warn-bg px-3 py-2 text-sm leading-relaxed text-fg-1">
            Withdrawal authority is excluded from Prism’s standard key because it can send collateral to a
            caller-selected receiver.
          </p>
        ) : null}

        <DetailSection title={`${scopeLabel(scope)} selectors`} note={`${activeCount ?? 0}/${selectors.length} active`}>
          {selectors.map((selector) => {
            const granted = active.activeSelectors.some(
              (candidate) => candidate.toLowerCase() === selector.toLowerCase(),
            );
            return (
              <DetailRow
                key={selector}
                label={<span className="font-mono text-xs">{selector}</span>}
                value={
                  <Numeric size="sm" tone={active.isLoading ? "muted" : granted ? "long" : "warn"}>
                    {active.isLoading ? "checking" : granted ? "active" : "missing"}
                  </Numeric>
                }
                action={<CopyAction value={selector} label="function selector" />}
              />
            );
          })}
        </DetailSection>
      </Modal>
    </Panel>
  );
}

function scopeLabel(scope: SelectorScope): string {
  if (scope === "standard") return "Trade + account";
  if (scope === "trade") return "Trade";
  if (scope === "account") return "Account management";
  return "Withdrawal";
}

function formatDuration(seconds: bigint | undefined): string {
  if (seconds === undefined) return "—";
  const value = Number(seconds);
  return value >= 60 ? `${Math.ceil(value / 60)} min` : `${value} sec`;
}

function formatCountdown(seconds: number | undefined): string {
  if (seconds === undefined) return "—";
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}
