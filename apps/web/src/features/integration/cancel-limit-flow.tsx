"use client";

import { ResultError, ResultNote } from "@/components/result";
import { PositionType, QuoteStatus, type UnifiedQuote } from "@symmio/trading-core";
import {
  useCoolDownsOfMA,
  useForceCancelQuote,
  useLimitOrders,
  useMarkets,
  useRequestToCancelQuote,
} from "@symmio/trading-react";
import { Button } from "@symmio/ui/components/button";
import { Spinner } from "@symmio/ui/components/spinner";
import { shortenAddress } from "@symmio/utils";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { formatUnits, type Address } from "viem";
import { WalletPanel } from "../inspector/wallet-panel";
import { QuoteLifecycleBadge } from "../quotes/quote-lifecycle-badge";
import { FlowRail, type FlowStep } from "./flow-rail";
import { SubaccountStep } from "./subaccount-step";

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
 * Cancel-limit wizard (majors / rasa): Connect → Select subaccount → pick a
 * resting LIMIT order and cancel it. Cancel routes `requestToCancelQuote` through
 * the AccountLayer `_call` proxy (the owner's wallet, no session key). Shown only
 * when the solver supports limit orders (gated by the panel).
 */
export function CancelLimitFlow({ owner, subAccount, subAccountName, onSelectSubAccount, ready }: Props) {
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
      step: { label: "Cancel limit order", hint: "Pick an order to cancel", done: false },
      content: subAccount ? (
        <CancelLimitStep subAccount={subAccount} />
      ) : (
        <ResultNote testId="cancel-limit-needs-subaccount">Select a subaccount first.</ResultNote>
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

function CancelLimitStep({ subAccount }: { subAccount: Address }) {
  const { quotes, isLoading, error, refetch, socketStatus } = useLimitOrders({ partyA: subAccount, live: true });
  const cancel = useRequestToCancelQuote();
  const force = useForceCancelQuote();

  // Force-cancel cooldown is the 2nd `coolDownsOfMA` value (seconds).
  const { data: coolDowns } = useCoolDownsOfMA();
  const forceCancelCooldown = coolDowns?.[1];

  // A resting cancel becomes force-cancellable only after the cooldown elapses;
  // tick once a second so the Force button flips on without a manual refresh.
  const hasCancelPending = quotes.some((quote) => quote.quoteStatus === QuoteStatus.CANCEL_PENDING);
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    if (!hasCancelPending) return;
    const id = setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, [hasCancelPending]);

  // Resolve symbolId → ticker so rows show the market symbol, not a raw id.
  const marketsQuery = useMarkets();
  const symbolBySymbolId = useMemo(
    () => new Map((marketsQuery.data ?? []).map((market) => [market.symbolId, market.symbol])),
    [marketsQuery.data],
  );

  if (isLoading) {
    return (
      <ResultNote testId="cancel-limit-loading" loading>
        Loading limit orders…
      </ResultNote>
    );
  }
  if (error) {
    return <ResultError testId="cancel-limit-error" kind={error.kind} message={error.message} />;
  }
  if (quotes.length === 0) {
    return <ResultNote testId="cancel-limit-empty">No limit orders for this subaccount.</ResultNote>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground text-xs">
          {quotes.length} limit order{quotes.length === 1 ? "" : "s"} · live {socketStatus}
        </span>
        <Button type="button" size="sm" variant="outline" onClick={() => refetch()}>
          Refresh
        </Button>
      </div>

      {cancel.isError ? (
        <ResultError testId="cancel-limit-submit-error" kind={cancel.error.kind} message={cancel.error.message} />
      ) : null}
      {force.isError ? (
        <ResultError testId="cancel-limit-force-error" kind={force.error.kind} message={force.error.message} />
      ) : null}

      <div className="flex flex-col gap-2" data-testid="cancel-limit-list">
        {quotes.map((quote) => (
          <LimitOrderRow
            key={quote.key}
            quote={quote}
            market={symbolBySymbolId.get(Number(quote.symbolId)) ?? `#${quote.symbolId.toString()}`}
            subAccount={subAccount}
            cancel={cancel}
            force={force}
            forceCancelCooldown={forceCancelCooldown}
            nowSec={nowSec}
          />
        ))}
      </div>
    </div>
  );
}

interface LimitOrderRowProps {
  quote: UnifiedQuote;
  market: string;
  subAccount: Address;
  cancel: ReturnType<typeof useRequestToCancelQuote>;
  force: ReturnType<typeof useForceCancelQuote>;
  forceCancelCooldown: bigint | undefined;
  nowSec: number;
}

function LimitOrderRow({ quote, market, subAccount, cancel, force, forceCancelCooldown, nowSec }: LimitOrderRowProps) {
  // Actions need a real on-chain quote id; an off-chain row is still writing on-chain.
  const onchainId = quote.origin === "onchain" ? quote.quoteId : undefined;
  const testKey = onchainId !== undefined ? onchainId.toString() : quote.key;

  const cancelling = cancel.isPending && onchainId !== undefined && cancel.variables?.quoteId === onchainId;
  const forcing = force.isPending && onchainId !== undefined && force.variables?.quoteId === onchainId;

  // Only a PENDING (unlocked) or LOCKED quote can be cancelled; a CANCEL_PENDING
  // one already requested cancel and awaits the cooldown.
  const cancellable =
    onchainId !== undefined && (quote.quoteStatus === QuoteStatus.PENDING || quote.quoteStatus === QuoteStatus.LOCKED);
  const cancelPending = onchainId !== undefined && quote.quoteStatus === QuoteStatus.CANCEL_PENDING;
  // Force-cancel eligible once now ≥ statusModifyTimestamp + cooldown.
  const forceReadyAt =
    cancelPending && forceCancelCooldown !== undefined && quote.statusModifyTimestamp !== undefined
      ? Number(quote.statusModifyTimestamp) + Number(forceCancelCooldown)
      : undefined;
  const forceEligible = cancelPending && forceReadyAt !== undefined && nowSec >= forceReadyAt;
  const secondsLeft = forceReadyAt === undefined ? undefined : Math.max(0, forceReadyAt - nowSec);

  return (
    <div
      className="border-border/70 bg-muted/20 flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-sm"
      data-testid={`cancel-limit-row-${testKey}`}
    >
      <div className="flex flex-col gap-0.5">
        <span className="flex items-center gap-2 font-medium">
          {onchainId !== undefined ? `Q#${onchainId.toString()}` : `#${quote.tempQuoteId ?? "—"}`} · {market}{" "}
          <span className={quote.positionType === PositionType.LONG ? "text-emerald-500" : "text-destructive"}>
            {quote.positionType === PositionType.LONG ? "Long" : "Short"}
          </span>
          <QuoteLifecycleBadge lifecycle={quote.lifecycle} />
        </span>
        <span className="text-muted-foreground font-mono text-xs">
          {formatWei(quote.quantity)} @ {formatWei(quote.requestedOpenPrice)}
          {cancelPending && !forceEligible && secondsLeft ? ` · force in ${secondsLeft}s` : ""}
        </span>
      </div>
      {cancelPending ? (
        <Button
          type="button"
          size="sm"
          variant="destructive"
          disabled={force.isPending || !forceEligible}
          onClick={() => force.mutate({ account: subAccount, quoteId: onchainId! })}
          data-testid={`cancel-limit-force-${testKey}`}
        >
          {forcing ? <Spinner className="size-3" /> : null}
          {forcing ? "Forcing…" : "Force cancel"}
        </Button>
      ) : (
        <Button
          type="button"
          size="sm"
          variant="destructive"
          disabled={cancel.isPending || !cancellable}
          onClick={() => cancel.mutate({ account: subAccount, quoteId: onchainId! })}
          data-testid={`cancel-limit-cancel-${testKey}`}
        >
          {cancelling ? <Spinner className="size-3" /> : null}
          {cancelling ? "Cancelling…" : "Cancel"}
        </Button>
      )}
    </div>
  );
}
