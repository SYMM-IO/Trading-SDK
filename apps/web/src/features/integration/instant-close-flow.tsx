"use client";

import { ResultError, ResultNote, ResultSuccess } from "@/components/result";
import { TxReceipt } from "@/components/tx-result";
import { useSessionKey } from "@/features/session-keys/use-session-key";
import type { SolverId } from "@symmio/trading-core";
import {
  INSTANT_TRADE_REQUIRED_SELECTORS,
  PositionType,
  REQUEST_TO_CLOSE_POSITION_SELECTOR,
  SubAccountIsolationType,
  VIRTUAL_ACCOUNT_ISOLATION_TYPE,
  useGrantDelegation,
  useGroupedQuotes,
  useIsDelegationActive,
  useOnchainContractMarkets,
  usePartyAOpenPositions,
  useSubAccount,
  useSymmioChainId,
  useSymmioConfig,
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
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { formatUnits, zeroAddress, type Address } from "viem";
import { WalletPanel } from "../inspector/wallet-panel";
import { ClosePositionStep, type ClosablePosition } from "./close-position-step";
import { FlowRail, type FlowStep } from "./flow-rail";
import { GroupCloseStep } from "./group-close-step";
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
 * Instant Close wizard: Connect → Subaccount → [Virtual Account] →
 * Session key → Delegation → Pick position → Close.
 *
 * The margin model follows the sub-account's isolation type: a **CUSTOM
 * (cross-margin)** sub-account has no Virtual Account — its positions live on
 * the sub-account itself — so the Virtual Account step is skipped and the
 * sub-account is used as PartyA. The VA isolations keep the VA-pick step.
 *
 * Each step is navigable via the rail; data loads in the step that needs it.
 */
export function InstantCloseFlow({ owner, subAccount, subAccountName, onSelectSubAccount, ready }: Props) {
  const config = useSymmioConfig();
  const chainId = useSymmioChainId();
  const { sessionKeyAddress } = useSessionKey();
  const sessionKey = sessionKeyAddress ?? undefined;

  // ---- Solver: which of the chain's solvers the close targets (one per chain
  // today — HyperEVM → enigma, Base → rasa). Reset on chain switch. ----
  const solverIds = config.listSolverIds(chainId);
  const [solverId, setSolverId] = useState<SolverId>(() => config.getDefaultSolverId(chainId));
  useEffect(() => {
    setSolverId(config.getDefaultSolverId(chainId));
  }, [config, chainId]);

  // ---- Margin model from the SELECTED SUB-ACCOUNT's isolation type. CUSTOM
  // isolation is cross-margin (no Virtual Account); the VA isolations own their
  // positions under per-market VAs. Isolation is fixed at creation → cache
  // forever. ----
  const subAccountQuery = useSubAccount({
    account: subAccount ?? zeroAddress,
    query: { enabled: Boolean(subAccount), staleTime: Infinity },
  });
  const isolationKnown = !subAccount || subAccountQuery.data !== undefined;
  const isCrossMargin = subAccountQuery.data?.isolationType === SubAccountIsolationType.CUSTOM;

  const [virtualAccount, setVirtualAccount] = useState<Address>();
  const [selectedQuoteId, setSelectedQuoteId] = useState<bigint>();
  /** When on, the picked position's whole market + side cohort closes as one. */
  const [groupMode, setGroupMode] = useState(false);

  // The account that owns the positions and signs the close: the sub-account
  // itself (cross-margin) or the picked VA (VA isolations).
  const effectivePartyA = isCrossMargin ? subAccount : virtualAccount;

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
  // `(subaccount, sessionKey, selector)` whether the close runs against a child
  // VA or the sub-account itself.
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

  // Positions for the owning account (VA or sub-account). `live` burst-refetches
  // when a settle frame lands on `partyA`'s stream — so a rasa cross-margin close
  // (partyA = sub-account) updates the list without the manual Refresh. Enigma
  // positions live under a VA whose frames arrive on the sub-account's stream, so
  // that case keeps its magic-sidebar-driven refresh.
  const positionsQuery = usePartyAOpenPositions({
    partyA: effectivePartyA,
    live: true,
    start: 0n,
    size: 200n,
    query: { enabled: Boolean(effectivePartyA) },
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

  // Group mode: fold the VA's quotes into market + side groups and pick the one
  // containing the selected position — its quantities concatenate into one total.
  const groupedQuotes = useGroupedQuotes({
    partyA: virtualAccount,
    enabled: groupMode && Boolean(virtualAccount),
    includeVirtualAccounts: false,
  });
  // The group to close: the one containing an explicitly picked position, else
  // the VA's first group (a lowcap VA is isolated per market + side, so there
  // is normally exactly one).
  const selectedGroup = useMemo(() => {
    const byPick =
      selectedQuoteId === undefined
        ? undefined
        : groupedQuotes.groups.find((group) => group.quotes.some((quote) => quote.quoteId === selectedQuoteId));
    return byPick ?? groupedQuotes.groups[0];
  }, [groupedQuotes.groups, selectedQuoteId]);

  function onGrant() {
    if (!subAccount || !sessionKey) return;
    grant.mutate({
      account: { addr: subAccount, isPartyB: false },
      delegatedSigner: sessionKey,
      selectors: INSTANT_TRADE_REQUIRED_SELECTORS,
      expiryTimestamp: BigInt(Math.floor(Date.now() / 1000) + DELEGATION_TTL_SECONDS),
    });
  }

  // ---- Stages. The Virtual Account step is present only for VA isolations; a
  // cross-margin sub-account closes under itself, so it is dropped. The
  // subaccount step also waits on the isolation read so the VA step never
  // flashes for a cross-margin account. ----
  const subAccountReady = Boolean(subAccount) && isolationKnown;
  const showVaStep = subAccountReady && !isCrossMargin;

  const stages: { step: FlowStep; content: ReactNode }[] = [
    {
      step: {
        label: "Connect wallet",
        hint: ready && owner ? shortenAddress(owner) : "Connect your wallet",
        done: ready,
      },
      content: <WalletPanel />,
    },
    {
      step: {
        label: "Select subaccount",
        hint: subAccount
          ? isolationKnown
            ? (subAccountName ?? shortenAddress(subAccount))
            : "Reading isolation…"
          : "Choose where to trade",
        done: subAccountReady,
      },
      content: <SubaccountStep owner={owner} selected={subAccount} onSelect={onSelectSubAccount} />,
    },
    ...(showVaStep
      ? [
          {
            step: {
              label: "Virtual account",
              hint: virtualAccount ? shortenAddress(virtualAccount) : "Pick a VA",
              done: Boolean(virtualAccount),
            },
            content: (
              <VirtualAccountStep subAccount={subAccount} selected={virtualAccount} onSelect={setVirtualAccount} />
            ),
          },
        ]
      : []),
    {
      step: {
        label: "Session key",
        hint: sessionKey ? shortenAddress(sessionKey) : "Initialize a session key",
        done: Boolean(sessionKey),
      },
      content: <SessionKeyPrompt address={sessionKey} owner={owner} />,
    },
    {
      step: {
        label: "Delegation",
        hint: delegationActive ? "Granted" : delegationLoading ? "Checking…" : "Grant close access",
        done: delegationActive,
      },
      content: (
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
      ),
    },
    {
      step: {
        label: "Pick position",
        hint: groupMode
          ? "Group close"
          : selectedPosition
            ? `Quote #${selectedPosition.id.toString()}`
            : "Choose a position",
        done: Boolean(selectedPosition) || groupMode,
      },
      content: (
        <PositionPickerStep
          partyA={effectivePartyA}
          positions={positions}
          isLoading={positionsQuery.isLoading}
          isRefetching={positionsQuery.isRefetching}
          error={positionsQuery.error}
          onRefetch={() => void positionsQuery.refetch()}
          selected={selectedQuoteId}
          onSelect={setSelectedQuoteId}
          groupMode={groupMode}
          onToggleGroupMode={setGroupMode}
        />
      ),
    },
    {
      step: {
        label: "Close",
        hint: groupMode ? "Close the whole group" : "Configure and submit",
        done: false,
      },
      content: groupMode ? (
        selectedGroup ? (
          <GroupCloseStep
            group={selectedGroup}
            sessionKey={sessionKey!}
            subAccount={subAccount!}
            onRefresh={() => void positionsQuery.refetch()}
            isRefreshing={positionsQuery.isRefetching}
            idPrefix="integration-instant-close"
          />
        ) : (
          <ResultNote testId="integration-instant-close-group-loading" loading>
            Folding the VA&apos;s positions into a group…
          </ResultNote>
        )
      ) : (
        <ClosePositionStep
          partyA={effectivePartyA!}
          sessionKey={sessionKey!}
          solverId={solverId}
          position={selectedPosition!}
          onRefreshPosition={() => void positionsQuery.refetch()}
          isRefreshingPosition={positionsQuery.isRefetching}
          idPrefix="integration-instant-close"
        />
      ),
    },
  ];

  // Furthest reachable stage = the first not-done one (stages are ordered by
  // dependency, so this enforces sequential completion without index math).
  const maxStep = (() => {
    const firstIncomplete = stages.findIndex((s) => !s.step.done);
    return firstIncomplete === -1 ? stages.length - 1 : firstIncomplete;
  })();

  const [step, setStep] = useState(0);
  const current = Math.min(step, maxStep);
  useEffect(() => {
    setStep((p) => Math.max(p, maxStep));
  }, [maxStep]);

  return (
    <div className="flex flex-col gap-6">
      {/* Solver target: which of the chain's solvers receives the close. */}
      <div
        className="border-border/70 bg-muted/20 flex items-center justify-between gap-3 rounded-xl border px-4 py-3"
        data-testid="instant-close-solver-picker"
      >
        <div className="flex flex-col gap-0.5">
          <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Solver</span>
          <span className="text-muted-foreground text-xs">
            The close, its mark price, and the hedger endpoint route to the selected solver; the margin model follows
            the sub-account&apos;s isolation type.
          </span>
        </div>
        <div className="flex items-center gap-2">
          {solverIds.map((id) => (
            <Button
              key={id}
              type="button"
              size="sm"
              variant={id === solverId ? "default" : "outline"}
              onClick={() => setSolverId(id)}
              data-testid={`instant-close-solver-${id}`}
            >
              {id}
            </Button>
          ))}
          {solverIds.length === 1 ? (
            <span className="text-muted-foreground text-[0.7rem]">
              Only solver on this chain — switch network for the other kind.
            </span>
          ) : null}
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_220px]">
        <div className="flex min-h-60 flex-col gap-5">{stages[current]?.content}</div>

        <div className="lg:border-border/50 lg:border-l lg:pl-8">
          <FlowRail steps={stages.map((s) => s.step)} current={current} maxReachable={maxStep} onStepClick={setStep} />
        </div>
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

/** Inline "stacked layers" glyph for the group-close toggle (apps/web uses inline SVG, never lucide). */
function LayersIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-3.5"
      aria-hidden
    >
      <path d="m12 2 8.5 4.5L12 11 3.5 6.5 12 2Z" />
      <path d="m3.5 12 8.5 4.5 8.5-4.5" />
      <path d="m3.5 17 8.5 4.5 8.5-4.5" />
    </svg>
  );
}

function PositionPickerStep({
  partyA,
  positions,
  isLoading,
  isRefetching,
  error,
  onRefetch,
  selected,
  onSelect,
  groupMode,
  onToggleGroupMode,
}: {
  /** Owner of the positions — the picked VA, or the sub-account for cross-margin. */
  partyA?: Address;
  positions: ClosablePosition[];
  isLoading: boolean;
  isRefetching: boolean;
  error: { kind: string; message: string } | null;
  onRefetch: () => void;
  selected?: bigint;
  onSelect: (id: bigint) => void;
  groupMode: boolean;
  onToggleGroupMode: (on: boolean) => void;
}) {
  if (!partyA) {
    return <ResultNote testId="instant-close-positions-empty">Pick an account first.</ResultNote>;
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
      <span className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant={groupMode ? "default" : "outline"}
          onClick={() => onToggleGroupMode(!groupMode)}
          disabled={positions.length === 0}
          data-testid="instant-close-group-toggle"
          className="gap-1.5"
        >
          <LayersIcon />
          Group close
        </Button>
        <RefetchButton isRefetching={isRefetching} onClick={onRefetch} testId="instant-close-positions-retry" />
      </span>
    </div>
  );
  if (positions.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        {header}
        <ResultNote testId="instant-close-positions-none">No open positions for this account.</ResultNote>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {header}
      {groupMode ? (
        <ResultNote testId="instant-close-group-note">
          Group close is on — every quote of the same market and side closes together, their quantities concatenated
          into one total. No single position pick needed.
        </ResultNote>
      ) : null}
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
