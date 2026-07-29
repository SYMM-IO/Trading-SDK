"use client";

import { ResultError, ResultNote } from "@/components/result";
import { useSessionKey } from "@/features/session-keys/use-session-key";
import {
  getPartyAOpenPositionsQueryOptions,
  INSTANT_TRADE_REQUIRED_SELECTORS,
  NotificationType,
  PositionType,
  REQUEST_TO_CLOSE_POSITION_SELECTOR,
  SymmioRequestError,
  useGrantDelegation,
  useInstantCloseBulkAuto,
  useIsDelegationActive,
  useMarkets,
  useNotifications,
  useSymmioChainId,
  useSymmioConfig,
  useVirtualAccountsAddressesOfSubAccount,
  type InstantCloseBulkAutoOrder,
  type Notification,
} from "@symmio/trading-react";
import { Badge } from "@symmio/ui/components/badge";
import { Button } from "@symmio/ui/components/button";
import { Input } from "@symmio/ui/components/input";
import { Spinner } from "@symmio/ui/components/spinner";
import { cn } from "@symmio/ui/lib/utils";
import { shortenAddress } from "@symmio/utils";
import { useQueries } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatUnits, zeroAddress, type Address } from "viem";
import { WalletPanel } from "../inspector/wallet-panel";
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

/** One row in the multi-select picker — a quote plus the VA it lives on. */
interface ClosableRow {
  vaAddress: Address;
  quoteId: bigint;
  symbolId: bigint;
  positionType: PositionType;
  quantity: bigint;
  closedAmount: bigint;
}

/**
 * Lifecycle stage of one submitted close, derived from the bulk-submit
 * mutation result plus close-side notifications.
 *
 * - `submitting` — waiting on the bulk POST to complete.
 * - `pending` — POST acked; waiting on the hedger to confirm the close.
 * - `closing` — hedger reported the close request was sent.
 * - `closed` — hedger reported the close was filled / settled.
 * - `failed` — bulk POST failed, or the hedger reported a failure for this quote.
 */
export type CloseSubmissionStatus = "submitting" | "pending" | "closing" | "closed" | "failed";

/** One submitted close, tracked locally for status display. */
interface CloseSubmission {
  /** Stable picker-row key; used to lock the corresponding row in the list. */
  rowKey: string;
  vaAddress: Address;
  quoteId: bigint;
  symbolId: bigint;
  positionType: PositionType;
  /** Remaining quantity at the moment of submit. */
  remaining: bigint;
  status: CloseSubmissionStatus;
  /** Last `lastSeenAction` we observed on the notifications stream. */
  lastSeenAction: string | null;
  /** Optional human-readable detail (failure reason, etc.). */
  message: string | null;
}

/**
 * Close All flow: Connect → Subaccount → Session key → Delegation → Pick
 * positions (multi-select across every VA) → Submit one bulk close.
 *
 * Mirrors {@link InstantCloseFlow} but skips the per-VA pick — instead it
 * fetches every VA under the subaccount in parallel and aggregates their open
 * positions into a single multi-select list. Submission goes through
 * {@link useInstantCloseBulkAuto} in one solver round-trip.
 */
export function CloseAllFlow({ owner, subAccount, subAccountName, onSelectSubAccount, ready }: Props) {
  const { sessionKeyAddress } = useSessionKey();
  const sessionKey = sessionKeyAddress ?? undefined;

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [slippage, setSlippage] = useState<string>("1");
  /**
   * When enabled, every selected row carries its own close-percent input
   * (default 100). When disabled, every row closes fully.
   */
  const [partialMode, setPartialMode] = useState<boolean>(false);
  /** Per-row close percent (1–100) keyed by `rowKey(row)`. */
  const [percents, setPercents] = useState<Record<string, string>>({});
  /**
   * One row per submitted close: a snapshot of the picker row plus a live
   * status driven by the notifications stream. Rows already present here are
   * disabled in the picker (cannot be toggled off / re-submitted).
   */
  const [submissions, setSubmissions] = useState<CloseSubmission[]>([]);

  // Reset selection + submissions whenever the subaccount changes.
  useEffect(() => {
    setSelected(new Set());
    setSubmissions([]);
    setPercents({});
  }, [subAccount]);

  // Delegation lives on the subaccount and is inherited by every owned VA, so
  // one signer can submit closes across multiple VAs.
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

  // Every VA under this subaccount.
  const vasQuery = useVirtualAccountsAddressesOfSubAccount({
    subAccount: subAccount ?? zeroAddress,
    query: { enabled: Boolean(subAccount) },
  });
  const virtualAccounts = vasQuery.data ?? [];

  const { rows, isLoading: rowsLoading, errors: rowsErrors, refetchAll } = useAggregatedPositions(virtualAccounts);

  const marketsQuery = useMarkets();
  const marketsBySymbolId = useMemo(() => {
    const map = new Map<bigint, { id: number; name: string; pricePrecision: number; quantityPrecision: number }>();
    for (const market of marketsQuery.data ?? []) {
      if (market.symbolId === undefined || !market.name) continue;
      map.set(BigInt(market.symbolId), {
        id: market.symbolId,
        name: market.name,
        pricePrecision: Number(market.pricePrecision ?? 0),
        quantityPrecision: Number(market.quantityPrecision ?? 0),
      });
    }
    return map;
  }, [marketsQuery.data]);

  const mutation = useInstantCloseBulkAuto();

  /**
   * Listen for close-side notifications and update each submission's status
   * accordingly. Only quotes the user actually submitted from this flow are
   * routed; other notifications are ignored.
   */
  useNotifications({
    account: subAccount,
    enabled: Boolean(subAccount) && submissions.length > 0,
    onNotification: (notification) => {
      setSubmissions((current) => applyNotificationToSubmissions(current, notification));
    },
  });

  /**
   * Rows the picker should disable while a close is in flight. A submission
   * that reached a terminal state — `failed` (retry the same quote) or
   * `closed` (settled on-chain; for a partial close the picker row still has
   * remaining qty so the user can close more) — is unlocked again so the
   * user can re-select without resetting the panel.
   */
  const lockedKeys = useMemo(() => {
    const set = new Set<string>();
    for (const submission of submissions) {
      if (submission.status === "failed") continue;
      if (submission.status === "closed") continue;
      set.add(submission.rowKey);
    }
    return set;
  }, [submissions]);

  const hasSelection = selected.size > 0;
  const slippageNumber = Number(slippage);
  const validSlippage = Number.isFinite(slippageNumber) && slippageNumber > 0;
  const canSubmit =
    hasSelection && validSlippage && !mutation.isPending && delegationActive && sessionKey !== undefined;

  // Step gating: 0 connect → 1 subaccount → 2 session-key → 3 delegation → 4 picker
  const maxStep = !ready ? 0 : !subAccount ? 1 : !sessionKey ? 2 : !delegationActive ? 3 : 4;
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

  function toggleRow(row: ClosableRow) {
    const key = rowKey(row);
    // Locked rows can't be toggled — they're already in flight or finished.
    if (lockedKeys.has(key)) return;
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }
  function selectAll() {
    setSelected(new Set(rows.filter((row) => !lockedKeys.has(rowKey(row))).map(rowKey)));
  }
  function clearAll() {
    setSelected(new Set());
  }

  async function handleSubmit() {
    if (!canSubmit || !sessionKey) return;
    const orders: InstantCloseBulkAutoOrder[] = [];
    const snapshot: ClosableRow[] = [];
    for (const row of rows) {
      if (!selected.has(rowKey(row))) continue;
      if (lockedKeys.has(rowKey(row))) continue;
      const market = marketsBySymbolId.get(row.symbolId);
      if (!market) continue;
      const remaining = row.quantity - row.closedAmount;
      if (remaining <= 0n) continue;
      const closeWei = resolveCloseQuantity(remaining, partialMode, percents[rowKey(row)]);
      if (closeWei <= 0n) continue;
      snapshot.push(row);
      orders.push({
        partyA: row.vaAddress,
        market: {
          id: market.id,
          name: market.name,
          pricePrecision: market.pricePrecision,
          quantityPrecision: market.quantityPrecision,
        },
        positionType: row.positionType,
        quoteId: row.quoteId,
        quantityToClose: formatUnits(closeWei, WEI_DECIMALS),
        slippage: slippageNumber,
      });
    }
    if (orders.length === 0) return;

    // Lock the rows immediately and reset the counter; the submission section
    // below now owns these quotes' lifecycle.
    const newSubmissions: CloseSubmission[] = snapshot.map((row) => ({
      rowKey: rowKey(row),
      vaAddress: row.vaAddress,
      quoteId: row.quoteId,
      symbolId: row.symbolId,
      positionType: row.positionType,
      remaining: row.quantity - row.closedAmount,
      status: "submitting",
      lastSeenAction: null,
      message: null,
    }));
    setSubmissions((current) => [...newSubmissions, ...current]);
    setSelected(new Set());

    try {
      await mutation.mutateAsync({ from: sessionKey, orders });
      setSubmissions((current) =>
        current.map((submission) =>
          newSubmissions.some((added) => added.rowKey === submission.rowKey) && submission.status === "submitting"
            ? { ...submission, status: "pending" }
            : submission,
        ),
      );
    } catch {
      // Mutation `error` is rendered in the panel and the submitted rows are
      // marked as failed below; nothing else to do here.
      setSubmissions((current) =>
        current.map((submission) =>
          newSubmissions.some((added) => added.rowKey === submission.rowKey)
            ? { ...submission, status: "failed", message: "Bulk request rejected." }
            : submission,
        ),
      );
    }
  }

  const steps: FlowStep[] = [
    { label: "Connect wallet", hint: ready && owner ? shortenAddress(owner) : "Connect your wallet", done: ready },
    {
      label: "Select subaccount",
      hint: subAccount ? (subAccountName ?? shortenAddress(subAccount)) : "Choose where to trade",
      done: Boolean(subAccount),
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
    { label: "Close positions", hint: `${selected.size} selected`, done: false },
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
          <SessionKeyPrompt address={sessionKey} owner={owner} />
        ) : current === 3 ? (
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
        ) : (
          <PickerStep
            rows={rows}
            isLoading={vasQuery.isLoading || rowsLoading}
            errors={rowsErrors}
            virtualAccountsCount={virtualAccounts.length}
            selected={selected}
            lockedKeys={lockedKeys}
            onToggle={toggleRow}
            onSelectAll={selectAll}
            onClearAll={clearAll}
            onRefetch={() => {
              void vasQuery.refetch();
              refetchAll();
            }}
            slippage={slippage}
            onSlippageChange={setSlippage}
            slippageValid={validSlippage}
            partialMode={partialMode}
            onPartialModeChange={setPartialMode}
            percents={percents}
            onPercentChange={(key, value) => setPercents((current) => ({ ...current, [key]: value }))}
            canSubmit={canSubmit}
            submitting={mutation.isPending}
            onSubmit={() => void handleSubmit()}
            error={mutation.error}
            submissions={submissions}
            onClearSubmissions={() => setSubmissions([])}
          />
        )}
      </div>

      <div className="lg:border-border/50 lg:border-l lg:pl-8">
        <FlowRail steps={steps} current={current} maxReachable={maxStep} onStepClick={setStep} />
      </div>
    </div>
  );
}

function rowKey(row: ClosableRow): string {
  return `${row.vaAddress}:${row.quoteId.toString()}`;
}

/**
 * Resolve the wei amount to close for a single row. When partial mode is off
 * (or the percent is invalid/empty), closes the full remaining quantity. When
 * a percent is set, scales it against the remaining qty and clamps to the
 * remaining (so 100% / >100% always means "all").
 */
function resolveCloseQuantity(remaining: bigint, partialMode: boolean, percentRaw: string | undefined): bigint {
  if (!partialMode) return remaining;
  if (percentRaw === undefined || percentRaw.trim() === "") return remaining;
  const value = Number(percentRaw);
  if (!Number.isFinite(value) || value <= 0) return 0n;
  if (value >= 100) return remaining;
  return scalePercent(remaining, value);
}

/** Wei `remaining × percent / 100`, rounded down via BigInt math. */
function scalePercent(remaining: bigint, percent: number): bigint {
  const bps = Math.round(percent * 100); // basis points: 50% = 5000
  if (bps <= 0) return 0n;
  if (bps >= 10_000) return remaining;
  return (remaining * BigInt(bps)) / 10_000n;
}

/**
 * Solver `lastSeenAction` values that mean the close request reached the
 * hedger (`closing`) or settled on-chain (`closed`). Mirrors the existing
 * close-side mapping in `applyNotificationToQuotes`.
 */
const CLOSING_ACTIONS = new Set(["InstantRequestToClosePosition", "RequestToClosePosition", "FillLimitOrderClose"]);
const CLOSED_ACTIONS = new Set(["FillMarketOrderInstantClose"]);

/** Match a notification to one submission by on-chain quote id. */
function submissionMatchesNotification(submission: CloseSubmission, notification: Notification): boolean {
  return notification.quoteId === submission.quoteId.toString();
}

/**
 * Fold one notification into the in-flight submission list. Returns the same
 * reference when nothing matched so React skips the re-render.
 */
function applyNotificationToSubmissions(submissions: CloseSubmission[], notification: Notification): CloseSubmission[] {
  let mutated = false;
  const next = submissions.map((submission) => {
    if (!submissionMatchesNotification(submission, notification)) return submission;
    const action = notification.lastSeenAction ?? "";
    let status: CloseSubmissionStatus = submission.status;
    let message: string | null = submission.message;
    if (notification.type === NotificationType.FAILED) {
      status = "failed";
      message = notification.failureMessage ?? notification.failureType ?? "Close failed.";
    } else if (notification.type === NotificationType.SUCCESS) {
      if (CLOSED_ACTIONS.has(action)) status = "closed";
      else if (CLOSING_ACTIONS.has(action) && submission.status !== "closed") status = "closing";
    }
    if (status === submission.status && action === submission.lastSeenAction && message === submission.message) {
      return submission;
    }
    mutated = true;
    return { ...submission, status, message, lastSeenAction: action || submission.lastSeenAction };
  });
  return mutated ? next : submissions;
}

/**
 * Fetch open positions for every VA in parallel via TanStack `useQueries`,
 * flatten into one row list. Returns the rows + per-VA loading/error state
 * for the UI.
 */
function useAggregatedPositions(virtualAccounts: readonly Address[]): {
  rows: ClosableRow[];
  isLoading: boolean;
  errors: { vaAddress: Address; error: SymmioRequestError }[];
  refetchAll: () => void;
} {
  const config = useSymmioConfig();
  const chainId = useSymmioChainId();
  const queries = useQueries({
    queries: virtualAccounts.map((vaAddress) =>
      getPartyAOpenPositionsQueryOptions(config, {
        partyA: vaAddress,
        start: 0n,
        size: 200n,
        chainId,
      }),
    ),
  });

  return useMemo(() => {
    const rows: ClosableRow[] = [];
    const errors: { vaAddress: Address; error: SymmioRequestError }[] = [];
    let isLoading = false;
    virtualAccounts.forEach((vaAddress, index) => {
      const query = queries[index];
      if (!query) {
        isLoading = true;
        return;
      }
      if (query.isLoading) isLoading = true;
      if (query.error) errors.push({ vaAddress, error: query.error as SymmioRequestError });
      const data = query.data as
        | { id: bigint; symbolId: bigint; positionType: PositionType; quantity: bigint; closedAmount: bigint }[]
        | undefined;
      for (const q of data ?? []) {
        rows.push({
          vaAddress,
          quoteId: q.id,
          symbolId: q.symbolId,
          positionType: q.positionType,
          quantity: q.quantity,
          closedAmount: q.closedAmount,
        });
      }
    });
    const refetchAll = () => {
      for (const query of queries) void query.refetch();
    };
    return { rows, isLoading, errors, refetchAll };
  }, [virtualAccounts, queries]);
}

function PickerStep({
  rows,
  isLoading,
  errors,
  virtualAccountsCount,
  selected,
  lockedKeys,
  onToggle,
  onSelectAll,
  onClearAll,
  onRefetch,
  slippage,
  onSlippageChange,
  slippageValid,
  partialMode,
  onPartialModeChange,
  percents,
  onPercentChange,
  canSubmit,
  submitting,
  onSubmit,
  error,
  submissions,
  onClearSubmissions,
}: {
  rows: ClosableRow[];
  isLoading: boolean;
  errors: { vaAddress: Address; error: SymmioRequestError }[];
  virtualAccountsCount: number;
  selected: Set<string>;
  lockedKeys: Set<string>;
  onToggle: (row: ClosableRow) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  onRefetch: () => void;
  slippage: string;
  onSlippageChange: (value: string) => void;
  slippageValid: boolean;
  partialMode: boolean;
  onPartialModeChange: (value: boolean) => void;
  percents: Record<string, string>;
  onPercentChange: (key: string, value: string) => void;
  canSubmit: boolean;
  submitting: boolean;
  onSubmit: () => void;
  error: SymmioRequestError | null;
  submissions: CloseSubmission[];
  onClearSubmissions: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-muted-foreground text-xs">
          {rows.length} position{rows.length === 1 ? "" : "s"} across {virtualAccountsCount} VA
          {virtualAccountsCount === 1 ? "" : "s"}
        </span>
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" variant="ghost" onClick={onSelectAll} disabled={rows.length === 0}>
            Select all
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={onClearAll} disabled={selected.size === 0}>
            Clear
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onRefetch}>
            Refresh
          </Button>
        </div>
      </div>

      {isLoading && rows.length === 0 ? (
        <ResultNote testId="close-all-positions-loading" loading>
          Loading positions across {virtualAccountsCount} virtual account{virtualAccountsCount === 1 ? "" : "s"}…
        </ResultNote>
      ) : null}

      {rows.length === 0 && !isLoading ? (
        <ResultNote testId="close-all-positions-empty">No open positions to close.</ResultNote>
      ) : null}

      {rows.length > 0 ? (
        <div className="grid grid-cols-1 gap-2" data-testid="close-all-positions-list">
          {rows.map((row) => {
            const key = rowKey(row);
            const locked = lockedKeys.has(key);
            const active = !locked && selected.has(key);
            const remaining = row.quantity - row.closedAmount;
            const percentRaw = percents[key];
            const percentValue = percentRaw ?? "100";
            const percentNum = Number(percentValue);
            const percentValid = Number.isFinite(percentNum) && percentNum > 0 && percentNum <= 100;
            return (
              <div
                key={key}
                className={cn(
                  "flex flex-col gap-2 rounded-xl border px-3 py-2.5 transition-all",
                  locked
                    ? "border-border/40 bg-muted/30 cursor-not-allowed opacity-60"
                    : active
                      ? "border-primary/40 bg-primary/5 ring-primary/20 ring-1"
                      : "border-border/70 hover:border-border hover:bg-muted/40",
                )}
                data-testid={`close-all-row-${key}`}
              >
                <button
                  type="button"
                  onClick={() => onToggle(row)}
                  disabled={locked}
                  aria-disabled={locked}
                  className="focus-visible:ring-ring/40 flex items-center justify-between gap-3 text-left outline-none focus-visible:ring-2"
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="text-foreground text-sm leading-tight font-medium">
                      Quote #{row.quoteId.toString()} · symbol {row.symbolId.toString()}
                    </span>
                    <span className="text-muted-foreground font-mono text-[0.7rem] leading-tight">
                      VA {shortenAddress(row.vaAddress)} · remaining {formatUnits(remaining, WEI_DECIMALS)}
                      {locked ? " · submitted" : ""}
                    </span>
                  </span>
                  <Badge variant={row.positionType === PositionType.LONG ? "positive" : "destructive"}>
                    {row.positionType === PositionType.LONG ? "Long" : "Short"}
                  </Badge>
                </button>
                {partialMode && active ? (
                  <div className="flex items-center gap-2 text-[0.7rem]">
                    <span className="text-muted-foreground">Close %</span>
                    <Input
                      value={percentValue}
                      onChange={(event) => onPercentChange(key, event.target.value)}
                      inputMode="decimal"
                      className="h-7 w-20"
                      aria-invalid={!percentValid}
                      data-testid={`close-all-percent-${key}`}
                    />
                    <span className="text-muted-foreground font-mono">
                      ≈ {percentValid ? formatUnits(scalePercent(remaining, percentNum), WEI_DECIMALS) : "—"}
                    </span>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}

      {errors.length > 0 ? (
        <div className="border-destructive/40 bg-destructive/5 text-destructive flex flex-col gap-1 rounded-lg border p-3 text-xs">
          <span className="font-medium">Some virtual accounts failed to load:</span>
          {errors.map(({ vaAddress, error: err }) => (
            <span key={vaAddress}>
              {shortenAddress(vaAddress)} — {err.message}
            </span>
          ))}
        </div>
      ) : null}

      <div className="flex items-center gap-2 text-xs">
        <input
          id="close-all-partial-mode"
          type="checkbox"
          checked={partialMode}
          onChange={(event) => onPartialModeChange(event.target.checked)}
          data-testid="close-all-partial-mode"
        />
        <label className="text-muted-foreground" htmlFor="close-all-partial-mode">
          Partial close — set a percent per selected position. Defaults to 100%.
        </label>
      </div>

      <div className="flex items-center gap-3">
        <label className="text-muted-foreground text-xs" htmlFor="close-all-slippage">
          Slippage %
        </label>
        <Input
          id="close-all-slippage"
          value={slippage}
          onChange={(event) => onSlippageChange(event.target.value)}
          placeholder="1"
          inputMode="decimal"
          className="w-24"
          aria-invalid={!slippageValid}
          data-testid="close-all-slippage"
        />
      </div>

      <Button
        type="button"
        size="lg"
        disabled={!canSubmit}
        onClick={onSubmit}
        data-testid="close-all-submit"
        className="w-full"
      >
        {submitting ? <Spinner className="size-4" /> : null}
        {submitting
          ? `Closing ${selected.size} position${selected.size === 1 ? "" : "s"}…`
          : `Close ${selected.size} selected`}
      </Button>

      {error ? <ResultError testId="close-all-error" kind={error.kind} message={error.message} /> : null}

      {submissions.length > 0 ? <SubmissionsPanel submissions={submissions} onClear={onClearSubmissions} /> : null}
    </div>
  );
}

/**
 * Live status feed for every close the user submitted from this flow. Each row
 * starts at "submitting" and advances through `pending` → `closing` → `closed`
 * (or `failed`) as notifications arrive.
 */
function SubmissionsPanel({ submissions, onClear }: { submissions: CloseSubmission[]; onClear: () => void }) {
  const terminal = submissions.every((submission) => submission.status === "closed" || submission.status === "failed");
  return (
    <div className="border-border/70 bg-muted/10 flex flex-col gap-2 rounded-xl border p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-muted-foreground text-[0.7rem] font-medium tracking-wide uppercase">
          Submitted closes · {submissions.length}
        </span>
        {terminal ? (
          <Button type="button" size="sm" variant="outline" onClick={onClear} data-testid="close-all-clear-submissions">
            Clear
          </Button>
        ) : null}
      </div>
      <div className="flex flex-col gap-2" data-testid="close-all-submissions-list">
        {submissions.map((submission) => (
          <SubmissionRow key={submission.rowKey} submission={submission} />
        ))}
      </div>
    </div>
  );
}

function SubmissionRow({ submission }: { submission: CloseSubmission }) {
  return (
    <div
      className="border-border/50 bg-background flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
      data-testid={`close-all-submission-${submission.rowKey}`}
    >
      <span className="flex min-w-0 flex-col">
        <span className="text-foreground text-sm leading-tight font-medium">
          Quote #{submission.quoteId.toString()} · symbol {submission.symbolId.toString()}
        </span>
        <span className="text-muted-foreground font-mono text-[0.7rem] leading-tight">
          VA {shortenAddress(submission.vaAddress)} · qty {formatUnits(submission.remaining, WEI_DECIMALS)}
          {submission.message ? ` · ${submission.message}` : ""}
        </span>
      </span>
      <StatusBadge status={submission.status} />
    </div>
  );
}

function StatusBadge({ status }: { status: CloseSubmissionStatus }) {
  switch (status) {
    case "submitting":
      return (
        <Badge variant="secondary">
          <Spinner className="size-3" /> Submitting
        </Badge>
      );
    case "pending":
      return (
        <Badge variant="secondary">
          <Spinner className="size-3" /> Pending
        </Badge>
      );
    case "closing":
      return (
        <Badge variant="warning">
          <Spinner className="size-3" /> Closing
        </Badge>
      );
    case "closed":
      return <Badge variant="positive">Closed</Badge>;
    case "failed":
      return <Badge variant="destructive">Failed</Badge>;
  }
}

// ---------------------------------------------------------------------------
// Step 2 — Session key prompt (copied from instant-close-flow to keep this self-contained)
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
          <span className="text-foreground font-mono" data-testid="close-all-session-key-address">
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
        <Link href="/session-keys" data-testid="close-all-init-session-key">
          Go to Session Keys
        </Link>
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 3 — Delegation prompt (copied from instant-close-flow)
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
        <button
          type="button"
          onClick={onRefetch}
          disabled={isRefetching}
          data-testid="close-all-delegation-retry"
          className="text-foreground hover:bg-muted/60 ring-border/60 disabled:text-muted-foreground inline-flex items-center gap-1.5 rounded px-2 py-1 text-[0.7rem] font-medium tracking-wide uppercase ring-1 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isRefetching ? <Spinner className="size-3" /> : null}
          {isRefetching ? "Refreshing…" : "Refresh"}
        </button>
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
        data-testid="close-all-grant-delegation"
        className="w-full"
      >
        {grant.isPending ? <Spinner className="size-4" /> : null}
        {grant.isPending ? "Granting delegation…" : "Grant delegation for 1 year"}
      </Button>

      {grant.error ? (
        <ResultError testId="close-all-grant-error" kind={grant.error.kind} message={grant.error.message} />
      ) : null}
    </div>
  );
}
