"use client";

import { ResultError, ResultNote, ResultSuccess } from "@/components/result";
import { TxReceipt } from "@/components/tx-result";
import { useSessionKey } from "@/features/session-keys/use-session-key";
import {
  INSTANT_TRADE_REQUIRED_SELECTORS,
  PositionType,
  REQUEST_TO_CLOSE_POSITION_SELECTOR,
  VIRTUAL_ACCOUNT_ISOLATION_TYPE,
  useGrantDelegation,
  useIsDelegationActive,
  useOnchainContractMarkets,
  usePartyAOpenPositions,
  useVirtualAccount,
  useVirtualAccountsAddressesOfSubAccount,
  type VirtualAccountIsolationType,
} from "@symmio/trading-react";
import { Badge } from "@symmio/ui/components/badge";
import { Button } from "@symmio/ui/components/button";
import { Spinner } from "@symmio/ui/components/spinner";
import { cn } from "@symmio/ui/lib/utils";
import { shortenAddress } from "@symmio/utils";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatUnits, zeroAddress, type Address } from "viem";
import { WalletPanel } from "../inspector/wallet-panel";
import { ClosePositionStep, type ClosablePosition } from "./close-position-step";
import { FlowRail, type FlowStep } from "./flow-rail";
import { SubaccountStep } from "./subaccount-step";

const WEI_DECIMALS = 18;
/** One-year delegation expiry, expressed in unix seconds. */
const DELEGATION_TTL_SECONDS = 365 * 24 * 60 * 60;

interface Props {
  owner?: Address;
  subAccount?: Address;
  subAccountName?: string;
  onSelectSubAccount: (account: Address) => void;
  /** Connected and on the expected chain. */
  ready: boolean;
}

/**
 * Instant Close wizard: Connect → Subaccount → Virtual Account →
 * Session key → Delegation (on the VA) → Pick position → Close.
 *
 * Each step is navigable via the rail; data loads in the step that needs it.
 */
export function InstantCloseFlow({ owner, subAccount, subAccountName, onSelectSubAccount, ready }: Props) {
  const { sessionKeyAddress } = useSessionKey();
  const sessionKey = sessionKeyAddress ?? undefined;

  const [virtualAccount, setVirtualAccount] = useState<Address>();
  const [selectedQuoteId, setSelectedQuoteId] = useState<bigint>();

  // Reset the VA + position picks whenever the subaccount changes.
  useEffect(() => {
    setVirtualAccount(undefined);
    setSelectedQuoteId(undefined);
  }, [subAccount]);
  useEffect(() => {
    setSelectedQuoteId(undefined);
  }, [virtualAccount]);

  // Delegation lives on the subaccount, not the VA — the VA inherits its
  // owning subaccount's delegations on-chain, so the InstantLayer checks
  // `(subaccount, sessionKey, selector)` when the operation runs against a
  // child VA.
  const delegationEnabled = Boolean(subAccount && sessionKey);
  const closeDelegation = useIsDelegationActive({
    account: subAccount ?? zeroAddress,
    delegate: sessionKey ?? zeroAddress,
    selector: REQUEST_TO_CLOSE_POSITION_SELECTOR,
    query: { enabled: delegationEnabled },
  });
  const grant = useGrantDelegation();
  const delegationActive = closeDelegation.data === true;
  const delegationLoading = delegationEnabled && closeDelegation.isLoading;

  // Positions for the picked VA.
  const positionsQuery = usePartyAOpenPositions({
    partyA: virtualAccount,
    start: 0n,
    size: 200n,
    query: { enabled: Boolean(virtualAccount) },
  });
  const positions = useMemo<ClosablePosition[]>(
    () =>
      (positionsQuery.data ?? []).map((q) => ({
        id: q.id,
        symbolId: q.symbolId,
        positionType: q.positionType,
        quantity: q.quantity,
        closedAmount: q.closedAmount,
        lockedValues: {
          cva: q.lockedValues.cva,
          lf: q.lockedValues.lf,
          partyAmm: q.lockedValues.partyAmm,
          partyBmm: q.lockedValues.partyBmm,
        },
        partyA: q.partyA,
      })),
    [positionsQuery.data],
  );
  const selectedPosition = useMemo(() => positions.find((p) => p.id === selectedQuoteId), [positions, selectedQuoteId]);

  // Step gating: 0 connect → 1 subaccount → 2 VA → 3 session-key → 4 delegation → 5 position → 6 close
  const maxStep = !ready
    ? 0
    : !subAccount
      ? 1
      : !virtualAccount
        ? 2
        : !sessionKey
          ? 3
          : !delegationActive
            ? 4
            : !selectedPosition
              ? 5
              : 6;

  const [step, setStep] = useState(0);
  const current = Math.min(step, maxStep);
  useEffect(() => {
    setStep((p) => Math.max(p, maxStep));
  }, [maxStep]);

  function onGrant() {
    if (!subAccount || !sessionKey) return;
    grant.mutate({
      account: { addr: subAccount, isPartyB: false },
      delegatedSigner: sessionKey,
      selectors: INSTANT_TRADE_REQUIRED_SELECTORS,
      expiryTimestamp: BigInt(Math.floor(Date.now() / 1000) + DELEGATION_TTL_SECONDS),
    });
  }

  const steps: FlowStep[] = [
    { label: "Connect wallet", hint: ready && owner ? shortenAddress(owner) : "Connect your wallet", done: ready },
    {
      label: "Select subaccount",
      hint: subAccount ? (subAccountName ?? shortenAddress(subAccount)) : "Choose where to trade",
      done: Boolean(subAccount),
    },
    {
      label: "Virtual account",
      hint: virtualAccount ? shortenAddress(virtualAccount) : "Pick a VA",
      done: Boolean(virtualAccount),
    },
    {
      label: "Session key",
      hint: sessionKey ? shortenAddress(sessionKey) : "Initialize a session key",
      done: Boolean(sessionKey),
    },
    {
      label: "Delegation",
      hint: delegationActive ? "Granted" : delegationLoading ? "Checking…" : "Grant close access",
      done: delegationActive,
    },
    {
      label: "Pick position",
      hint: selectedPosition ? `Quote #${selectedPosition.id.toString()}` : "Choose a position",
      done: Boolean(selectedPosition),
    },
    { label: "Close", hint: "Configure and submit", done: false },
  ];

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_220px]">
      <div className="flex min-h-60 flex-col gap-5">
        {current === 0 ? (
          <WalletPanel />
        ) : current === 1 ? (
          <SubaccountStep
            owner={owner}
            selected={subAccount}
            onSelect={(account) => {
              onSelectSubAccount(account);
              setStep(2);
            }}
          />
        ) : current === 2 ? (
          <VirtualAccountStep
            subAccount={subAccount}
            selected={virtualAccount}
            onSelect={(va) => {
              setVirtualAccount(va);
              setStep(3);
            }}
          />
        ) : current === 3 ? (
          <SessionKeyPrompt address={sessionKey} owner={owner} />
        ) : current === 4 ? (
          <DelegationPrompt
            subAccount={subAccount}
            sessionKey={sessionKey}
            active={delegationActive}
            loading={delegationLoading}
            isRefetching={closeDelegation.isRefetching}
            onRefetch={() => void closeDelegation.refetch()}
            grant={grant}
            onGrant={onGrant}
          />
        ) : current === 5 ? (
          <PositionPickerStep
            virtualAccount={virtualAccount}
            positions={positions}
            isLoading={positionsQuery.isLoading}
            isRefetching={positionsQuery.isRefetching}
            error={positionsQuery.error}
            onRefetch={() => void positionsQuery.refetch()}
            selected={selectedQuoteId}
            onSelect={(id) => {
              setSelectedQuoteId(id);
              setStep(6);
            }}
          />
        ) : (
          <ClosePositionStep
            partyA={virtualAccount!}
            sessionKey={sessionKey!}
            position={selectedPosition!}
            onRefreshPosition={() => void positionsQuery.refetch()}
            isRefreshingPosition={positionsQuery.isRefetching}
            idPrefix="integration-instant-close"
          />
        )}
      </div>

      <div className="lg:border-border/50 lg:border-l lg:pl-8">
        <FlowRail steps={steps} current={current} maxReachable={maxStep} onStepClick={setStep} />
      </div>
    </div>
  );
}

/**
 * Tiny refetch trigger used by every step that loads data. Shows a spinner
 * while refetching so the user gets feedback without a layout shift.
 */
function RefetchButton({
  isRefetching,
  onClick,
  testId,
}: {
  isRefetching: boolean;
  onClick: () => void;
  testId: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isRefetching}
      data-testid={testId}
      className="text-foreground hover:bg-muted/60 ring-border/60 disabled:text-muted-foreground inline-flex items-center gap-1.5 rounded px-2 py-1 text-[0.7rem] font-medium tracking-wide uppercase ring-1 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
    >
      {isRefetching ? <Spinner className="size-3" /> : null}
      {isRefetching ? "Refreshing…" : "Refresh"}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Step 2 — Virtual account
// ---------------------------------------------------------------------------

function VirtualAccountStep({
  subAccount,
  selected,
  onSelect,
}: {
  subAccount?: Address;
  selected?: Address;
  onSelect: (va: Address) => void;
}) {
  const query = useVirtualAccountsAddressesOfSubAccount({
    subAccount: subAccount ?? zeroAddress,
    query: { enabled: Boolean(subAccount) },
  });

  if (!subAccount) {
    return <ResultNote testId="instant-close-va-disconnected">Pick a subaccount first.</ResultNote>;
  }
  if (query.isLoading) {
    return (
      <ResultNote testId="instant-close-va-loading" loading>
        Loading virtual accounts…
      </ResultNote>
    );
  }
  if (query.error) {
    return (
      <div className="flex flex-col gap-2">
        <ResultError testId="instant-close-va-error" kind={query.error.kind} message={query.error.message} />
        <RefetchButton
          isRefetching={query.isRefetching}
          onClick={() => void query.refetch()}
          testId="instant-close-va-retry"
        />
      </div>
    );
  }
  const items = query.data ?? [];
  const header = (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground text-xs">
        {items.length} virtual account{items.length === 1 ? "" : "s"}
      </span>
      <RefetchButton
        isRefetching={query.isRefetching}
        onClick={() => void query.refetch()}
        testId="instant-close-va-retry"
      />
    </div>
  );
  if (items.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        {header}
        <ResultNote testId="instant-close-va-empty">
          No virtual accounts yet for this subaccount. Open a position first to create one.
        </ResultNote>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {header}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" data-testid="instant-close-va-list">
        {items.map((va) => (
          <VirtualAccountOption key={va} address={va} active={va === selected} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}

/**
 * One row in {@link VirtualAccountStep}. Reads the VA's `(symbolId,
 * isolationType)` via {@link useVirtualAccount} (cached forever — fixed at
 * creation) and resolves the symbol name through {@link useOnchainContractMarkets}.
 */
function VirtualAccountOption({
  address,
  active,
  onSelect,
}: {
  address: Address;
  active: boolean;
  onSelect: (va: Address) => void;
}) {
  const detail = useVirtualAccount({ account: address });
  const markets = useOnchainContractMarkets({
    start: 0n,
    size: 1000n,
    query: { staleTime: Infinity, gcTime: Infinity },
  });
  const market = useMemo(
    () => (detail.data && markets.data ? markets.data.find((m) => m.symbolId === detail.data!.symbolId) : undefined),
    [detail.data, markets.data],
  );
  const sideLabel = detail.data ? labelForIsolation(detail.data.isolationType) : undefined;

  return (
    <button
      type="button"
      onClick={() => onSelect(address)}
      data-testid={`instant-close-va-${address}`}
      className={cn(
        "focus-visible:ring-ring/40 flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition-all outline-none focus-visible:ring-2",
        active
          ? "border-primary/40 bg-primary/5 ring-primary/20 ring-1"
          : "border-border/70 hover:border-border hover:bg-muted/40",
      )}
    >
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-foreground font-mono text-xs">{shortenAddress(address)}</span>
        <span className="text-muted-foreground text-[0.7rem] leading-tight">
          {market ? market.name : detail.data ? `symbol ${detail.data.symbolId.toString()}` : "Loading…"}
          {sideLabel ? ` · ${sideLabel}` : ""}
        </span>
      </span>
      {active ? <Badge variant="positive">Selected</Badge> : null}
    </button>
  );
}

/** Translate a VA's isolation type into a short user-facing label. */
function labelForIsolation(isolation: VirtualAccountIsolationType): string {
  switch (isolation) {
    case VIRTUAL_ACCOUNT_ISOLATION_TYPE.MARKET_LONG:
      return "Long";
    case VIRTUAL_ACCOUNT_ISOLATION_TYPE.MARKET_SHORT:
      return "Short";
    case VIRTUAL_ACCOUNT_ISOLATION_TYPE.MARKET:
      return "Market";
    case VIRTUAL_ACCOUNT_ISOLATION_TYPE.POSITION:
      return "Position";
    default:
      return "";
  }
}

// ---------------------------------------------------------------------------
// Step 3 — Session key prompt
// ---------------------------------------------------------------------------

function SessionKeyPrompt({ address, owner }: { address?: Address; owner?: Address }) {
  if (address) {
    return (
      <div className="border-border/70 bg-muted/20 flex flex-col gap-3 rounded-xl border p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Session key</span>
          <Badge variant="positive">Ready</Badge>
        </div>
        <div className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">address</span>
          <span className="text-foreground font-mono" data-testid="instant-close-session-key-address">
            {address}
          </span>
        </div>
      </div>
    );
  }
  return (
    <div className="border-border/70 bg-muted/20 flex flex-col gap-3 rounded-xl border p-4">
      <span className="text-muted-foreground text-sm">
        {owner
          ? "No session key for the connected wallet. Initialize one to sign instant-close operations without prompting the wallet."
          : "Connect a wallet to initialize a session key."}
      </span>
      <Button asChild size="sm" disabled={!owner}>
        <Link href="/session-keys" data-testid="instant-close-init-session-key">
          Go to Session Keys
        </Link>
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 4 — Delegation
// ---------------------------------------------------------------------------

function DelegationPrompt({
  subAccount,
  sessionKey,
  active,
  loading,
  isRefetching,
  onRefetch,
  grant,
  onGrant,
}: {
  subAccount?: Address;
  sessionKey?: Address;
  active: boolean;
  loading: boolean;
  isRefetching: boolean;
  onRefetch: () => void;
  grant: ReturnType<typeof useGrantDelegation>;
  onGrant: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-end">
        <RefetchButton isRefetching={isRefetching} onClick={onRefetch} testId="instant-close-delegation-retry" />
      </div>
      <div className="border-border/70 bg-muted/20 grid gap-3 rounded-xl border p-4 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="text-foreground font-mono text-xs">requestToClosePosition</span>
          {loading ? (
            <Badge variant="secondary">Checking…</Badge>
          ) : active ? (
            <Badge variant="positive">Active</Badge>
          ) : (
            <Badge variant="warning">Missing</Badge>
          )}
        </div>
        <div className="border-border/60 flex flex-col gap-1 border-t pt-3">
          <span className="text-muted-foreground text-xs">subaccount</span>
          <span className="text-foreground font-mono">{subAccount ? shortenAddress(subAccount) : "—"}</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground text-xs">delegate</span>
          <span className="text-foreground font-mono">{sessionKey ? shortenAddress(sessionKey) : "—"}</span>
        </div>
      </div>

      <Button
        type="button"
        size="lg"
        onClick={onGrant}
        disabled={!subAccount || !sessionKey || grant.isPending}
        data-testid="instant-close-grant-delegation"
        className="w-full"
      >
        {grant.isPending ? <Spinner className="size-4" /> : null}
        {grant.isPending ? "Granting delegation…" : "Grant delegation for 1 year"}
      </Button>

      {grant.error ? (
        <ResultError testId="instant-close-grant-error" kind={grant.error.kind} message={grant.error.message} />
      ) : null}
      {grant.isSuccess ? (
        <ResultSuccess testId="instant-close-grant-success">
          <span className="text-foreground">Delegation granted.</span>
          <TxReceipt
            hash={grant.data.hash}
            receipt={
              grant.data.receipt
                ? { blockNumber: grant.data.receipt.blockNumber, status: String(grant.data.receipt.status) }
                : undefined
            }
          />
        </ResultSuccess>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 5 — Position picker
// ---------------------------------------------------------------------------

function PositionPickerStep({
  virtualAccount,
  positions,
  isLoading,
  isRefetching,
  error,
  onRefetch,
  selected,
  onSelect,
}: {
  virtualAccount?: Address;
  positions: ClosablePosition[];
  isLoading: boolean;
  isRefetching: boolean;
  error: { kind: string; message: string } | null;
  onRefetch: () => void;
  selected?: bigint;
  onSelect: (id: bigint) => void;
}) {
  if (!virtualAccount) {
    return <ResultNote testId="instant-close-positions-empty">Pick a virtual account first.</ResultNote>;
  }
  if (isLoading) {
    return (
      <ResultNote testId="instant-close-positions-loading" loading>
        Loading on-chain positions…
      </ResultNote>
    );
  }
  if (error) {
    return (
      <div className="flex flex-col gap-2">
        <ResultError testId="instant-close-positions-error" kind={error.kind} message={error.message} />
        <RefetchButton isRefetching={isRefetching} onClick={onRefetch} testId="instant-close-positions-retry" />
      </div>
    );
  }
  const header = (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground text-xs">
        {positions.length} position{positions.length === 1 ? "" : "s"}
      </span>
      <RefetchButton isRefetching={isRefetching} onClick={onRefetch} testId="instant-close-positions-retry" />
    </div>
  );
  if (positions.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        {header}
        <ResultNote testId="instant-close-positions-none">No open positions for this VA.</ResultNote>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {header}
      <div className="grid grid-cols-1 gap-2" data-testid="instant-close-positions-list">
        {positions.map((p) => {
          const active = p.id === selected;
          const remaining = p.quantity - p.closedAmount;
          return (
            <button
              key={p.id.toString()}
              type="button"
              onClick={() => onSelect(p.id)}
              data-testid={`instant-close-position-${p.id.toString()}`}
              className={cn(
                "focus-visible:ring-ring/40 flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition-all outline-none focus-visible:ring-2",
                active
                  ? "border-primary/40 bg-primary/5 ring-primary/20 ring-1"
                  : "border-border/70 hover:border-border hover:bg-muted/40",
              )}
            >
              <span className="flex min-w-0 flex-col">
                <span className="text-foreground text-sm leading-tight font-medium">
                  Quote #{p.id.toString()} · symbol {p.symbolId.toString()}
                </span>
                <span className="text-muted-foreground font-mono text-[0.7rem] leading-tight">
                  remaining {formatUnits(remaining, WEI_DECIMALS)}
                </span>
              </span>
              <Badge variant={p.positionType === PositionType.LONG ? "positive" : "destructive"}>
                {p.positionType === PositionType.LONG ? "Long" : "Short"}
              </Badge>
            </button>
          );
        })}
      </div>
    </div>
  );
}
