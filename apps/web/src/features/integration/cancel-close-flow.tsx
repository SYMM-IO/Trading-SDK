"use client";

import { ResultError, ResultNote } from "@/components/result";
import { PositionType, QuoteStatus, type GetPartyAOpenPositionsReturnType } from "@symmio/trading-core";
import {
  useCoolDownsOfMA,
  useForceCancelCloseRequest,
  useForceClose,
  useForceCloseEligibility,
  useMarkets,
  usePartyAOpenPositions,
  useRequestToCancelCloseRequest,
} from "@symmio/trading-react";
import { Button } from "@symmio/ui/components/button";
import { Spinner } from "@symmio/ui/components/spinner";
import { shortenAddress } from "@symmio/utils";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { formatUnits, type Address } from "viem";
import { WalletPanel } from "../inspector/wallet-panel";
import { FlowRail, type FlowStep } from "./flow-rail";
import { SubaccountStep } from "./subaccount-step";

type Position = GetPartyAOpenPositionsReturnType[number];

const WEI_DECIMALS = 18;
function formatWei(value: bigint): string {
  return Number(formatUnits(value, WEI_DECIMALS)).toLocaleString(undefined, { maximumFractionDigits: 6 });
}

interface Props {
  owner?: Address;
  subAccount?: Address;
  subAccountName?: string;
  onSelectSubAccount: (account: Address) => void;
  /** Connected and on the expected chain. */
  ready: boolean;
}

/**
 * Cancel-close wizard (majors / rasa): Connect → Select subaccount → pick a
 * position whose close is pending and cancel the close request. Routes
 * `requestToCancelCloseRequest` (and, once stalled + cooled down,
 * `forceCancelCloseRequest`) through the AccountLayer `_call` proxy. Shown only
 * when the solver supports limit orders (gated by the panel).
 */
export function CancelCloseFlow({ owner, subAccount, subAccountName, onSelectSubAccount, ready }: Props) {
  const [step, setStep] = useState(0);

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
        hint: subAccount ? (subAccountName ?? shortenAddress(subAccount)) : "Choose a subaccount",
        done: Boolean(subAccount),
      },
      content: <SubaccountStep owner={owner} selected={subAccount} onSelect={onSelectSubAccount} />,
    },
    {
      step: { label: "Cancel close", hint: "Pick a pending close to cancel", done: false },
      content: subAccount ? (
        <CancelCloseStep subAccount={subAccount} />
      ) : (
        <ResultNote testId="cancel-close-needs-subaccount">Select a subaccount first.</ResultNote>
      ),
    },
  ];

  // Furthest reachable stage = the first not-done one (stages are dependency-ordered).
  const maxStep = (() => {
    const firstIncomplete = stages.findIndex((s) => !s.step.done);
    return firstIncomplete === -1 ? stages.length - 1 : firstIncomplete;
  })();
  const current = Math.min(step, maxStep);
  useEffect(() => {
    setStep((p) => Math.max(p, maxStep));
  }, [maxStep]);

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_220px]">
      <div className="flex min-h-60 flex-col gap-5">{stages[current]?.content}</div>
      <div className="lg:border-border/50 lg:border-l lg:pl-8">
        <FlowRail steps={stages.map((s) => s.step)} current={current} maxReachable={maxStep} onStepClick={setStep} />
      </div>
    </div>
  );
}

function CancelCloseStep({ subAccount }: { subAccount: Address }) {
  const { data, isLoading, isRefetching, error, refetch } = usePartyAOpenPositions({ partyA: subAccount, live: true });
  const cancel = useRequestToCancelCloseRequest();
  const force = useForceCancelCloseRequest();

  // Force-cancel-close cooldown is the 3rd `coolDownsOfMA` value (seconds).
  const { data: coolDowns } = useCoolDownsOfMA();
  const forceCancelCloseCooldown = coolDowns?.[2];

  // Only positions whose close is pending are actionable here.
  const closing = useMemo(
    () =>
      (data ?? []).filter(
        (q) => q.quoteStatus === QuoteStatus.CLOSE_PENDING || q.quoteStatus === QuoteStatus.CANCEL_CLOSE_PENDING,
      ),
    [data],
  );

  // A stalled close becomes force-cancellable only after the cooldown elapses;
  // tick once a second so the Force button flips on without a manual refresh.
  const hasCancelClosePending = closing.some((q) => q.quoteStatus === QuoteStatus.CANCEL_CLOSE_PENDING);
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    if (!hasCancelClosePending) return;
    const id = setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, [hasCancelClosePending]);

  // Resolve symbolId → ticker so rows show the market symbol, not a raw id.
  const marketsQuery = useMarkets();
  const symbolBySymbolId = useMemo(
    () => new Map((marketsQuery.data ?? []).map((market) => [market.symbolId, market.symbol])),
    [marketsQuery.data],
  );

  if (isLoading) {
    return (
      <ResultNote testId="cancel-close-loading" loading>
        Loading pending closes…
      </ResultNote>
    );
  }
  if (error) {
    return <ResultError testId="cancel-close-error" kind={error.kind} message={error.message} />;
  }
  if (closing.length === 0) {
    return <ResultNote testId="cancel-close-empty">No pending closes for this subaccount.</ResultNote>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground text-xs">
          {closing.length} pending close{closing.length === 1 ? "" : "s"}
        </span>
        <Button type="button" size="sm" variant="outline" onClick={() => void refetch()} disabled={isRefetching}>
          {isRefetching ? <Spinner className="size-3" /> : null}
          Refresh
        </Button>
      </div>

      {cancel.isError ? (
        <ResultError testId="cancel-close-submit-error" kind={cancel.error.kind} message={cancel.error.message} />
      ) : null}
      {force.isError ? (
        <ResultError testId="cancel-close-force-error" kind={force.error.kind} message={force.error.message} />
      ) : null}

      <div className="flex flex-col gap-2" data-testid="cancel-close-list">
        {closing.map((quote) => (
          <PendingCloseRow
            key={quote.id.toString()}
            quote={quote}
            market={symbolBySymbolId.get(Number(quote.symbolId)) ?? `#${quote.symbolId.toString()}`}
            subAccount={subAccount}
            cancel={cancel}
            force={force}
            forceCancelCloseCooldown={forceCancelCloseCooldown}
            nowSec={nowSec}
          />
        ))}
      </div>
    </div>
  );
}

interface PendingCloseRowProps {
  quote: Position;
  market: string;
  subAccount: Address;
  cancel: ReturnType<typeof useRequestToCancelCloseRequest>;
  force: ReturnType<typeof useForceCancelCloseRequest>;
  forceCancelCloseCooldown: bigint | undefined;
  nowSec: number;
}

function PendingCloseRow({
  quote,
  market,
  subAccount,
  cancel,
  force,
  forceCancelCloseCooldown,
  nowSec,
}: PendingCloseRowProps) {
  const cancelling = cancel.isPending && cancel.variables?.quoteId === quote.id;
  const forcing = force.isPending && force.variables?.quoteId === quote.id;

  // Force **close** (execute the pending close at an oracle price) — its own flow,
  // available on a CLOSE_PENDING LIMIT position once its cooldown passes.
  const forceClose = useForceClose();
  const forceCloseElig = useForceCloseEligibility({ quote });
  const forceClosing = forceClose.isPending;

  // Only a CLOSE_PENDING close can be cancel-requested; a CANCEL_CLOSE_PENDING one
  // already requested and awaits the cooldown before it can be forced.
  const cancellable = quote.quoteStatus === QuoteStatus.CLOSE_PENDING;
  const cancelClosePending = quote.quoteStatus === QuoteStatus.CANCEL_CLOSE_PENDING;
  // Force eligible once now ≥ statusModifyTimestamp + forceCancelCloseCooldown.
  const forceReadyAt =
    cancelClosePending && forceCancelCloseCooldown !== undefined
      ? Number(quote.statusModifyTimestamp) + Number(forceCancelCloseCooldown)
      : undefined;
  const forceEligible = forceReadyAt !== undefined && nowSec >= forceReadyAt;
  const secondsLeft = forceReadyAt === undefined ? undefined : Math.max(0, forceReadyAt - nowSec);

  return (
    <div
      className="border-border/70 bg-muted/20 flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-sm"
      data-testid={`cancel-close-row-${quote.id.toString()}`}
    >
      <div className="flex flex-col gap-0.5">
        <span className="font-medium">
          Q#{quote.id.toString()} · {market}{" "}
          <span className={quote.positionType === PositionType.LONG ? "text-emerald-500" : "text-destructive"}>
            {quote.positionType === PositionType.LONG ? "Long" : "Short"}
          </span>
        </span>
        <span className="text-muted-foreground font-mono text-xs">
          {formatWei(quote.quantity)} @ {formatWei(quote.requestedClosePrice)} ·{" "}
          {QuoteStatus[quote.quoteStatus] ?? quote.quoteStatus}
          {cancelClosePending && !forceEligible && secondsLeft ? ` · force in ${secondsLeft}s` : ""}
          {cancellable && forceCloseElig.reason === "cooldown"
            ? ` · force close in ${forceCloseElig.cooldownRemaining}s`
            : ""}
        </span>
        {forceClose.isError ? (
          <span
            className="text-destructive text-xs"
            data-testid={`cancel-close-forceclose-error-${quote.id.toString()}`}
          >
            {forceClose.error.message}
          </span>
        ) : null}
      </div>
      {cancelClosePending ? (
        <Button
          type="button"
          size="sm"
          variant="destructive"
          disabled={force.isPending || !forceEligible}
          onClick={() => force.mutate({ account: subAccount, quoteId: quote.id })}
          data-testid={`cancel-close-force-${quote.id.toString()}`}
        >
          {forcing ? <Spinner className="size-3" /> : null}
          {forcing ? "Forcing…" : "Force cancel"}
        </Button>
      ) : (
        <div className="flex items-center gap-2">
          {/* Force close: enabled once eligible (LIMIT + cooldown passed + not expired). */}
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={forceClose.isPending || !forceCloseElig.eligible}
            // Debug/temporary: skip the client price checks and the pre-write
            // simulation so the tx broadcasts even if it will revert on-chain.
            onClick={() =>
              forceClose.mutate({
                account: subAccount,
                quoteId: quote.id,
                skipPriceCheck: true,
                simulateBeforeWrite: false,
              })
            }
            title={
              forceCloseElig.reason === "cooldown" ? `Force close in ${forceCloseElig.cooldownRemaining}s` : undefined
            }
            data-testid={`cancel-close-forceclose-${quote.id.toString()}`}
          >
            {forceClosing ? <Spinner className="size-3" /> : null}
            {forceClosing ? "Closing…" : "Force close"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="destructive"
            disabled={cancel.isPending || !cancellable}
            onClick={() => cancel.mutate({ account: subAccount, quoteId: quote.id })}
            data-testid={`cancel-close-cancel-${quote.id.toString()}`}
          >
            {cancelling ? <Spinner className="size-3" /> : null}
            {cancelling ? "Cancelling…" : "Cancel close"}
          </Button>
        </div>
      )}
    </div>
  );
}
