"use client";

import { Field } from "@/components/field";
import { ResultError, ResultNote, ResultSuccess } from "@/components/result";
import { TxReceipt } from "@/components/tx-result";
import { useFlowWriteOption, type GaslessWriteOption } from "@/features/gasless/gasless-write-mode-store";
import { SessionKeySignerNote } from "@/features/gasless/session-key-signer-note";
import { formatUsd } from "@/lib/format";
import { formatRemaining, useCountdown } from "@/lib/use-countdown";
import {
  SubAccountIsolationType,
  WithdrawStatus,
  type ExpressWithdrawStatus,
  type WithdrawRequest,
  type WithdrawRoute,
  type WithdrawRouteChoice,
  type WithdrawRouteChoices,
} from "@symmio/trading-core";
import {
  getWithdrawRequestActions,
  isExpressWithdrawCancellable,
  isExpressWithdrawPayoutComplete,
  useAccountBalanceInfo,
  useAccountBalanceOf,
  useExpressWithdrawStatus,
  useExpressWithdrawStatuses,
  useFinalizeWithdrawRequest,
  usePendingWithdrawRequests,
  useRequestCancelWithdraw,
  useSubAccount,
  useWithdraw,
  useWithdrawRouteChoices,
  useWithdrawWithExpress,
  useWithdrawableTime,
  type ExpressWithdrawStatusEntry,
  type SymmioRequestError,
} from "@symmio/trading-react";
import { Badge } from "@symmio/ui/components/badge";
import { Button } from "@symmio/ui/components/button";
import { Input } from "@symmio/ui/components/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@symmio/ui/components/select";
import { Spinner } from "@symmio/ui/components/spinner";
import { shortenAddress } from "@symmio/utils";
import { useEffect, useState } from "react";
import { isAddress, isAddressEqual, zeroAddress, type Address } from "viem";
import { WalletPanel } from "../inspector/wallet-panel";
import { AmountField } from "./amount-field";
import { FlowLayout } from "./flow-layout";
import type { FlowStep } from "./flow-rail";
import { parseAmount } from "./parse-amount";
import { SubaccountStep } from "./subaccount-step";

/**
 * Relay outcomes that mean "submitted, status unknown" rather than "failed":
 * the wait ran out of budget, or the submit itself was never confirmed.
 */
const PENDING_RELAY_CODES = [
  "GASLESS_SUBMIT_UNCONFIRMED",
  "GASLESS_TERMINAL_TIMEOUT",
  "GASLESS_BROADCAST_TIMEOUT",
] as const;

/** The pending-relay code in a withdraw error, if the relay's status was lost rather than failed. */
function getPendingRelayCode(error: SymmioRequestError | null): (typeof PENDING_RELAY_CODES)[number] | undefined {
  return PENDING_RELAY_CODES.find((code) => error?.message.includes(code));
}

interface Props {
  owner?: Address;
  subAccount?: Address;
  subAccountName?: string;
  onSelectSubAccount: (account: Address) => void;
  decimals: number;
  chainId?: number;
  /** Connected and on the expected chain. */
  ready: boolean;
}

/**
 * Withdraw wizard: Connect → Select subaccount → Withdraw. Navigable via the rail.
 * The withdraw step previews and submits the SDK-selected classic or Express
 * route (Classic stays selectable while the preview loads or fails), shows
 * provider/cooldown progress, and lists every active withdraw request (classic,
 * Express, or any other provider) with the finalize / cancel actions Core and
 * the provider still accept.
 */
export function WithdrawFlow({
  owner,
  subAccount,
  subAccountName,
  onSelectSubAccount,
  decimals,
  chainId,
  ready,
}: Props) {
  const [step, setStep] = useState(0);
  const [amount, setAmount] = useState<string>("");
  const [receiver, setReceiver] = useState<string>("");
  const [withdrawMethod, setWithdrawMethod] = useState("auto");

  const parsed = parseAmount(amount, decimals);
  const validReceiver = isAddress(receiver) ? (receiver as Address) : undefined;
  const canInitiate = Boolean(subAccount && parsed !== undefined && validReceiver && chainId !== undefined);

  const withdrawableTime = useWithdrawableTime({ user: subAccount, chainId });
  const withdraw = useWithdrawWithExpress({ account: subAccount, chainId });
  const classicWithdraw = useWithdraw({ account: subAccount, chainId });
  /**
   * A relay whose status was lost may still be executing, so it counts as
   * submitted: no fresh preview and no resubmit until the user edits the form.
   */
  const relayPending = getPendingRelayCode(withdraw.error) !== undefined;
  const submitting = withdraw.isPending || classicWithdraw.isPending;
  /**
   * Preview only while no submission is pending, possibly still relaying, or
   * has succeeded. A failed or rejected submission re-enables the stale preview,
   * which then refetches, so a retry submits a fresh offer instead of an expired
   * or consumed one. The gate never reads the preview's own state, so a preview
   * error cannot re-trigger it.
   */
  const routeChoices = useWithdrawRouteChoices({
    user: subAccount ?? zeroAddress,
    amount: parsed ?? 0n,
    receiver: validReceiver ?? zeroAddress,
    chainId,
    query: {
      enabled: canInitiate && !submitting && !relayPending && !withdraw.isSuccess && !classicWithdraw.isSuccess,
    },
  });
  /** The session key when the wallet menu's default is on; the CUSTOM path's deallocate leg rides along. */
  const initiateWrite = useFlowWriteOption("initiateWithdraw");

  // The subaccount's isolation strategy selects the withdraw path: CUSTOM
  // (cross-margin) funds sit in the ALLOCATED balance and must be deallocated
  // first; MARKET / MARKET_DIRECTION (VA) funds are already AVAILABLE.
  const subAccountQuery = useSubAccount({ account: subAccount, query: { staleTime: Infinity } });
  const isolationType = subAccountQuery.data?.isolationType;
  const isCustom = isolationType === SubAccountIsolationType.CUSTOM;

  // Balance shown on the withdraw step, per isolation: CUSTOM reads the allocated
  // balance (funds live in margin); the VA modes read the available balance.
  const marginBalance = useAccountBalanceInfo({ account: subAccount, query: { enabled: isCustom } });
  const availableBalance = useAccountBalanceOf({
    account: subAccount,
    query: { enabled: isolationType !== undefined && !isCustom },
  });

  const selectedRoute = getSelectedRoute(routeChoices.data, withdrawMethod);
  /**
   * Classic submits through `useWithdraw`, which needs no preview, so it stays
   * submittable while the preview loads or fails. Auto and Express submit the
   * exact previewed route, so they wait for a settled preview.
   */
  const classicSelected = withdrawMethod === "classic";
  const methodReady = classicSelected || (selectedRoute !== undefined && !routeChoices.isFetching);
  /** Every route debits the same available balance, so an over-balance amount blocks Classic too. */
  const insufficientBalance = routeChoices.error?.code === "WITHDRAW_INSUFFICIENT_BALANCE";

  const expressRequestId = withdraw.data?.route.kind === "express" ? withdraw.data.requestId : undefined;
  const expressStatus = useExpressWithdrawStatus({
    user: subAccount ?? zeroAddress,
    requestId: expressRequestId ?? 0n,
    chainId,
    query: { enabled: expressRequestId !== undefined },
  });
  const withdrawDone =
    classicWithdraw.isSuccess ||
    (withdraw.isSuccess &&
      (withdraw.data.route.kind === "classic" ||
        (expressStatus.data !== undefined && isExpressWithdrawPayoutComplete(expressStatus.data))));

  const maxStep = !ready ? 0 : !subAccount ? 1 : 2;
  const current = Math.min(step, maxStep);

  useEffect(() => {
    setStep((previous) => Math.max(previous, maxStep));
  }, [maxStep]);

  useEffect(() => {
    setWithdrawMethod("auto");
  }, [amount, chainId, receiver, subAccount]);

  function resetSubmission() {
    withdraw.reset();
    classicWithdraw.reset();
  }

  function onInitiate() {
    if (!subAccount || parsed === undefined || !validReceiver || chainId === undefined) return;
    // `account`/`chainId` are bound on the hook (which resolves the subaccount's
    // isolation via useSubAccount); `parsed` is in the collateral token's decimals
    // and the hook builds the part + scales the deallocate amount.
    if (withdrawMethod === "classic") {
      withdraw.reset();
      classicWithdraw.mutate({ amount: parsed, receiver: validReceiver, ...initiateWrite });
      return;
    }

    /** Auto and Express submit the exact previewed route. */
    if (!routeChoices.data) return;
    classicWithdraw.reset();
    if (withdrawMethod === "auto") {
      withdraw.mutate({
        amount: parsed,
        receiver: validReceiver,
        preparedRoute: routeChoices.data.recommended,
        ...initiateWrite,
      });
      return;
    }
    if (!selectedRoute || selectedRoute.kind !== "express") return;
    withdraw.mutate({ amount: parsed, receiver: validReceiver, preparedRoute: selectedRoute, ...initiateWrite });
  }

  const steps: FlowStep[] = [
    { label: "Connect wallet", hint: ready && owner ? shortenAddress(owner) : "Connect your wallet", done: ready },
    {
      label: "Select subaccount",
      hint: subAccount ? (subAccountName ?? shortenAddress(subAccount)) : "Choose where to withdraw from",
      done: Boolean(subAccount),
    },
    {
      label: "Withdraw",
      hint:
        selectedRoute?.kind === "express"
          ? `${selectedRoute.option.optionTypeName} selected`
          : canInitiate
            ? "Ready"
            : "Amount & receiver",
      done: withdrawDone,
    },
  ];

  return (
    <FlowLayout
      steps={steps}
      current={current}
      maxReachable={maxStep}
      onStepClick={(next) => {
        /** Picking a subaccount mid-write would reset the pending write and detach it from this view. */
        if (!submitting) setStep(next);
      }}
    >
      {current === 0 ? (
        <WalletPanel />
      ) : current === 1 ? (
        <SubaccountStep
          owner={owner}
          selected={subAccount}
          onSelect={(account) => {
            onSelectSubAccount(account);
            resetSubmission();
            setStep(2);
          }}
        />
      ) : (
        <>
          <WithdrawableReadout query={withdrawableTime} />

          {/**
           * Inputs lock while a write is in flight: editing one calls
           * `resetSubmission`, which would detach the pending write from this
           * view and re-enable submit for a duplicate request.
           */}
          <AmountField
            id="integration-withdraw-amount"
            testId="integration-withdraw-amount"
            label="Amount to withdraw"
            value={amount}
            onChange={(next) => {
              setAmount(next);
              resetSubmission();
            }}
            decimals={decimals}
            invalid={amount.length > 0 && parsed === undefined}
            disabled={submitting}
          />

          <Field
            label="Receiver"
            htmlFor="integration-withdraw-receiver"
            action={
              owner ? (
                <Button
                  type="button"
                  size="xs"
                  variant="ghost"
                  disabled={submitting}
                  onClick={() => {
                    setReceiver(owner);
                    resetSubmission();
                  }}
                >
                  Use wallet
                </Button>
              ) : undefined
            }
          >
            <Input
              id="integration-withdraw-receiver"
              data-testid="integration-withdraw-receiver"
              value={receiver}
              onChange={(e) => {
                setReceiver(e.target.value);
                resetSubmission();
              }}
              placeholder="0x…"
              className="font-mono"
              aria-invalid={receiver.length > 0 && !validReceiver}
              disabled={submitting}
            />
          </Field>

          {canInitiate && parsed !== undefined ? (
            <WithdrawalMethodSelect
              query={routeChoices}
              value={withdrawMethod}
              onValueChange={(value) => {
                setWithdrawMethod(value);
                resetSubmission();
              }}
              disabled={submitting}
              amount={parsed}
              decimals={decimals}
            />
          ) : null}

          <Button
            type="button"
            size="lg"
            disabled={!canInitiate || !methodReady || insufficientBalance || submitting || relayPending}
            onClick={onInitiate}
            data-testid="button-initiate-withdraw"
            className="w-full"
          >
            {submitting || (!classicSelected && routeChoices.isFetching) ? <Spinner className="size-4" /> : null}
            {parsed === undefined
              ? "Enter an amount"
              : withdrawMethod === "classic"
                ? "Initiate classic withdrawal"
                : selectedRoute?.kind === "express"
                  ? `Withdraw with ${selectedRoute.option.optionTypeName}`
                  : selectedRoute?.kind === "classic" && selectedRoute.finalize === "immediate"
                    ? "Withdraw now"
                    : "Initiate withdrawal"}
          </Button>

          {canInitiate && parsed !== undefined ? (
            <WithdrawRouteReadout
              query={routeChoices}
              route={selectedRoute}
              method={withdrawMethod}
              amount={parsed}
              decimals={decimals}
            />
          ) : null}

          <SessionKeySignerNote signer={initiateWrite.from}>
            Initiating also needs “Also allow withdrawals” ticked in the key’s grant on Session Keys.
          </SessionKeySignerNote>

          <InitiateStatus withdraw={withdraw} status={expressStatus} bySessionKey={initiateWrite.from !== undefined} />
          <ClassicInitiateStatus withdraw={classicWithdraw} bySessionKey={initiateWrite.from !== undefined} />

          {subAccount ? (
            <SubaccountBalance isCustom={isCustom} margin={marginBalance} available={availableBalance} />
          ) : null}

          {subAccount ? <PendingRequests subAccount={subAccount} decimals={decimals} chainId={chainId} /> : null}
        </>
      )}
    </FlowLayout>
  );
}

function WithdrawableReadout({ query }: { query: ReturnType<typeof useWithdrawableTime> }) {
  const at = query.data !== undefined ? Number(query.data) * 1000 : 0;
  const { remainingMs, ready } = useCountdown(at);
  if (query.data === undefined) return null;

  return (
    <div className="border-border/60 bg-muted/30 flex items-center gap-2.5 rounded-xl border px-4 py-2.5 text-sm">
      <span className={ready ? "bg-positive size-2 rounded-full" : "bg-warning size-2 rounded-full"} aria-hidden />
      <span className="text-foreground">
        {ready ? "Withdrawable immediately" : `Cooldown — ${formatRemaining(remainingMs)} left`}
      </span>
    </div>
  );
}

function getExpressMethodValue(choice: Extract<WithdrawRouteChoice, { kind: "express" }>): string {
  return `express:${choice.option.optionTypeName}:${choice.option.requestDbId}`;
}

function getSelectedRoute(
  choices: WithdrawRouteChoices | undefined,
  method: string,
): WithdrawRoute | WithdrawRouteChoice | undefined {
  if (!choices) return undefined;
  if (method === "auto") return choices.recommended;
  if (method === "classic") return choices.available.find((choice) => choice.kind === "classic");
  return choices.available.find((choice) => choice.kind === "express" && getExpressMethodValue(choice) === method);
}

function getExpressChoiceDescription(
  choice: Extract<WithdrawRouteChoice, { kind: "express" }>,
  amount: bigint,
  decimals: number,
): string {
  const grossFees = choice.option.fee + choice.option.operatorFee;
  const userFee = grossFees > choice.option.sponsorCoverage ? grossFees - choice.option.sponsorCoverage : 0n;
  const estimatedPayout = amount > userFee ? amount - userFee : 0n;
  return `Receive about ${formatUsd(estimatedPayout, decimals)} USDC · fee ${formatUsd(userFee, decimals)} USDC · ${formatRemaining(choice.option.estimatedTimeSeconds * 1000)}`;
}

/**
 * Auto, Classic, and every previewed Express offer. Classic needs no preview, so
 * it is always offered (its timing is only known once the preview settles), and
 * the choice is never blocked on the preview. Express offers come only from a
 * settled preview, so they are disabled while it refetches.
 */
function WithdrawalMethodSelect({
  query,
  value,
  onValueChange,
  disabled,
  amount,
  decimals,
}: {
  query: ReturnType<typeof useWithdrawRouteChoices>;
  value: string;
  onValueChange: (value: string) => void;
  /** Locks the choice while a submission is in flight. */
  disabled: boolean;
  amount: bigint;
  decimals: number;
}) {
  const classic = query.data?.available.find((choice) => choice.kind === "classic");
  const express = query.data?.available.filter((choice) => choice.kind === "express") ?? [];
  const recommendation = query.data?.recommended;
  const autoDescription = recommendation
    ? recommendation.kind === "express"
      ? `Recommended: ${recommendation.option.optionTypeName}`
      : recommendation.finalize === "immediate"
        ? "Recommended: Classic, available immediately"
        : "Recommended: Classic cooldown path"
    : "The SDK will choose the safest available route";

  return (
    <Field label="Withdrawal method" htmlFor="integration-withdraw-method">
      <Select value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger id="integration-withdraw-method" data-testid="integration-withdraw-method">
          <SelectValue placeholder="Choose a withdrawal method" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="auto" description={autoDescription}>
            Auto (recommended)
          </SelectItem>
          <SelectItem
            value="classic"
            description={
              classic?.finalize === "immediate"
                ? "Classic protocol route; the request can be finalized immediately"
                : "Classic protocol route; finalize after the cooldown"
            }
          >
            Classic
          </SelectItem>
          {express.map((choice) => (
            <SelectItem
              key={getExpressMethodValue(choice)}
              value={getExpressMethodValue(choice)}
              description={getExpressChoiceDescription(choice, amount, decimals)}
              disabled={query.isFetching}
            >
              {choice.option.optionTypeName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

function WithdrawRouteReadout({
  query,
  route,
  method,
  amount,
  decimals,
}: {
  query: ReturnType<typeof useWithdrawRouteChoices>;
  route: WithdrawRoute | WithdrawRouteChoice | undefined;
  /** Selected method: `auto`, `classic`, or an Express choice value. */
  method: string;
  amount: bigint;
  decimals: number;
}) {
  const automatic = method === "auto";
  /**
   * Classic submits without the preview, so the preview's loading and error
   * states only concern Auto and Express. An over-balance amount is the
   * exception: every route debits the same available balance, so that error
   * applies to Classic as well.
   */
  const previewApplies = method !== "classic" || query.error?.code === "WITHDRAW_INSUFFICIENT_BALANCE";
  if (previewApplies) {
    if (query.isFetching) {
      return <ResultNote loading>Checking available withdrawal routes…</ResultNote>;
    }
    if (query.error) {
      return (
        <div className="flex flex-col gap-2">
          <ResultError
            testId="integration-withdraw-route-error"
            kind={query.error.kind}
            message={query.error.message}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="self-start"
            onClick={() => void query.refetch()}
            data-testid="integration-withdraw-route-retry"
          >
            Retry route preview
          </Button>
        </div>
      );
    }
    /** No preview and no error: the query is disabled, e.g. after a successful withdrawal cleared it. */
    if (!query.data) return null;
    if (!route) return <ResultNote>The selected withdrawal method is no longer available.</ResultNote>;
  }

  if (!route || route.kind === "classic") {
    const fallbackDescription =
      route && automatic && "reason" in route
        ? {
            "service-disabled": "Express is disabled on this chain; the classic cooldown path will be used.",
            "service-error": "The Express service is unavailable; the classic cooldown path will be used.",
            "no-option": "No preferred Express option is available; the classic cooldown path will be used.",
            "unsupported-account": "This account requires deallocation, so the classic cooldown path will be used.",
            "cooldown-ready": "The cooldown is already satisfied; initiation and finalization will be atomic.",
          }[route.reason]
        : route?.finalize === "immediate"
          ? "The Classic request can be finalized immediately after initiation."
          : "The Classic protocol path will be initiated and can be finalized after the cooldown.";
    return (
      <ResultNote>
        <span className="flex items-center gap-2">
          <Badge variant="secondary">{automatic ? "Auto · Classic" : "Classic"}</Badge>
          {fallbackDescription}
        </span>
      </ResultNote>
    );
  }

  const { option } = route;
  const grossFees = option.fee + option.operatorFee;
  const userFee = grossFees > option.sponsorCoverage ? grossFees - option.sponsorCoverage : 0n;
  const estimatedPayout = amount > userFee ? amount - userFee : 0n;
  return (
    <ResultNote>
      <span className="flex flex-wrap items-center gap-2">
        <Badge>{automatic ? `Auto · ${option.optionTypeName}` : option.optionTypeName}</Badge>
        <span>
          Estimated payout {formatUsd(estimatedPayout, decimals)} USDC · fee {formatUsd(userFee, decimals)} USDC · about{" "}
          {formatRemaining(option.estimatedTimeSeconds * 1000)}
        </span>
      </span>
    </ResultNote>
  );
}

/**
 * How an Express request ended without a payout, if it did. The provider's
 * on-chain status is canonical, so it wins: the service's own status can lag
 * it, and polling stops at the on-chain terminal state, so it may never catch up.
 */
function getExpressStop(
  progress: ExpressWithdrawStatus,
):
  | { source: "provider"; status: "CANCELLED" | "SUSPENDED" }
  | { source: "service"; status: "FAILED" | "CANCELLED" | "SUSPENDED" }
  | undefined {
  const onChain = progress.onChain.status;
  if (onChain === "CANCELLED" || onChain === "SUSPENDED") return { source: "provider", status: onChain };
  const local = progress.local.status;
  if (local === "FAILED" || local === "CANCELLED" || local === "SUSPENDED") return { source: "service", status: local };
  return undefined;
}

function InitiateStatus({
  withdraw,
  status,
  bySessionKey,
}: {
  withdraw: ReturnType<typeof useWithdrawWithExpress>;
  status: ReturnType<typeof useExpressWithdrawStatus>;
  /** The session key signs, so there is no wallet prompt to wait on. */
  bySessionKey: boolean;
}) {
  if (withdraw.isPending) {
    return (
      <ResultNote testId="integration-withdraw-status" loading>
        {bySessionKey
          ? "Relaying the withdrawal request, signed by the session key…"
          : "Submitting withdrawal request… confirm in your wallet."}
      </ResultNote>
    );
  }
  if (withdraw.error) {
    /**
     * A relay whose status we lost is not a failed withdrawal: the request may
     * be executing right now. Rendering it as an error is what invites a second
     * signature for an intent that already went through.
     */
    const pendingCode = getPendingRelayCode(withdraw.error);
    if (pendingCode) {
      return (
        <ResultNote testId="integration-withdraw-status">
          The withdrawal was submitted, but its status is unavailable right now ({pendingCode}). It keeps running on the
          relayer — check the request on the Gasless page before submitting again; do not re-sign.
        </ResultNote>
      );
    }
    return (
      <ResultError testId="integration-withdraw-status" kind={withdraw.error.kind} message={withdraw.error.message} />
    );
  }
  if (withdraw.isSuccess) {
    if (withdraw.data.route.kind === "express") {
      const progress = status.data;
      if (status.error) {
        return (
          <ResultError testId="integration-withdraw-status" kind={status.error.kind} message={status.error.message} />
        );
      }
      const stop = progress ? getExpressStop(progress) : undefined;
      /**
       * A provider-side cancel refunds Core in the same transaction, so it is an
       * outcome, not a failure.
       */
      if (stop?.source === "provider" && stop.status === "CANCELLED") {
        return (
          <ResultNote testId="integration-withdraw-status">
            Express request #{String(withdraw.data.requestId)} was cancelled. Its amount is back in the subaccount’s
            available balance.
          </ResultNote>
        );
      }
      if (stop) {
        return (
          <ResultError
            testId="integration-withdraw-status"
            kind="unknown"
            message={`Express withdrawal stopped (${stop.source} ${stop.status}).`}
          />
        );
      }
      if (!progress || !isExpressWithdrawPayoutComplete(progress)) {
        const detail =
          progress?.local.status === "NOT_FOUND"
            ? "Waiting for the service to index the transaction."
            : progress?.onChain.status === "FINALIZED" && progress.onChain.optionType === "STANDARD"
              ? "Core released the funds; provider payout is still pending."
              : `Provider status: ${progress?.onChain.status ?? "pending"}.`;
        return (
          <ResultNote testId="integration-withdraw-status" loading={status.isFetching}>
            Express request #{String(withdraw.data.requestId)} submitted. {detail}
          </ResultNote>
        );
      }
    }

    return (
      <ResultSuccess testId="integration-withdraw-status">
        <span className="text-foreground">
          {withdraw.data.route.kind === "express"
            ? "Express withdrawal paid to the receiver."
            : withdraw.data.route.finalize === "immediate"
              ? "Withdrawal completed in one transaction."
              : "Withdrawal initiated. Finalize it below after the cooldown."}
        </span>
        <TxReceipt
          hash={withdraw.data.hash}
          receipt={
            withdraw.data.receipt
              ? { blockNumber: withdraw.data.receipt.blockNumber, status: String(withdraw.data.receipt.status) }
              : undefined
          }
        />
      </ResultSuccess>
    );
  }
  return null;
}

function ClassicInitiateStatus({
  withdraw,
  bySessionKey,
}: {
  withdraw: ReturnType<typeof useWithdraw>;
  /** The session key signs, so there is no wallet prompt to wait on. */
  bySessionKey: boolean;
}) {
  if (withdraw.isPending) {
    return (
      <ResultNote testId="integration-withdraw-status" loading>
        {bySessionKey
          ? "Relaying the Classic withdrawal request, signed by the session key…"
          : "Submitting Classic withdrawal request… confirm in your wallet."}
      </ResultNote>
    );
  }
  if (withdraw.error) {
    return (
      <ResultError testId="integration-withdraw-status" kind={withdraw.error.kind} message={withdraw.error.message} />
    );
  }
  if (!withdraw.isSuccess) return null;

  return (
    <ResultSuccess testId="integration-withdraw-status">
      <span className="text-foreground">Classic withdrawal initiated. Finalize it below when it is ready.</span>
      <TxReceipt
        hash={withdraw.data.hash}
        receipt={
          withdraw.data.receipt
            ? { blockNumber: withdraw.data.receipt.blockNumber, status: String(withdraw.data.receipt.status) }
            : undefined
        }
      />
    </ResultSuccess>
  );
}

/**
 * The subaccount's current withdrawable balance, per isolation. CUSTOM
 * (cross-margin) shows the allocated (margin) balance since that is what the
 * deallocate leg draws from; the VA modes show the available balance. Both values
 * are 18-decimal and refetch after a withdraw settles.
 */
function SubaccountBalance({
  isCustom,
  margin,
  available,
}: {
  isCustom: boolean;
  margin: ReturnType<typeof useAccountBalanceInfo>;
  available: ReturnType<typeof useAccountBalanceOf>;
}) {
  return (
    <div className="border-border/60 bg-muted/20 flex items-center justify-between rounded-lg border px-4 py-2.5 text-sm">
      <span className="text-muted-foreground">
        {isCustom ? "Subaccount margin (allocated) balance" : "Subaccount available balance"}
      </span>
      <span className="text-foreground font-mono" data-testid="integration-withdraw-subaccount-balance">
        {isCustom
          ? margin.data
            ? formatUsd(margin.data.allocatedBalance)
            : "—"
          : available.data !== undefined
            ? formatUsd(available.data)
            : "—"}
      </span>
    </div>
  );
}

function PendingRequests({
  subAccount,
  decimals,
  chainId,
}: {
  subAccount: Address;
  decimals: number;
  chainId?: number;
}) {
  /** Re-render every second so cooldown countdowns and finalize-readiness stay live. */
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const query = usePendingWithdrawRequests({ user: subAccount });
  const finalize = useFinalizeWithdrawRequest();
  const cancel = useRequestCancelWithdraw();
  const finalizeWrite = useFlowWriteOption("finalizeWithdrawRequest");
  const cancelWrite = useFlowWriteOption("requestCancelWithdraw");

  const express = useExpressWithdrawStatuses({
    requests: query.data ?? [],
    ...(chainId === undefined ? {} : { chainId }),
    enabled: query.data !== undefined,
  });
  /**
   * One row per active request, built in a single pass; Express service status
   * only adds detail to its request's row. The one exclusion is an Express
   * request whose receiver payout is proven. Classic requests and requests for
   * any other provider always keep a row, so a request still holding the
   * subaccount's collateral never drops out of the list.
   */
  const expressEntries = new Map(express.entries.map((entry) => [entry.request.id, entry]));
  const rows = (query.data ?? []).flatMap((request) => {
    const entry = expressEntries.get(request.id);
    return entry?.status && isExpressWithdrawPayoutComplete(entry.status) ? [] : [{ request, entry }];
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <h3 className="text-muted-foreground text-xs font-medium tracking-[0.18em] uppercase">Pending withdrawals</h3>
        <span className="bg-border/80 h-px flex-1" aria-hidden />
        <span className="text-muted-foreground font-mono text-xs">{rows.length}</span>
      </div>

      {query.isLoading ? (
        <ResultNote loading>Loading active withdrawals…</ResultNote>
      ) : (
        <>
          {query.error ? (
            <ResultError testId="integration-pending-error" kind={query.error.kind} message={query.error.message} />
          ) : null}
          {rows.length > 0 ? (
            <ul className="divide-border/60 border-border/70 divide-y overflow-hidden rounded-xl border">
              {rows.map(({ request, entry }) =>
                entry ? (
                  <ExpressRequestRow
                    key={String(request.id)}
                    entry={entry}
                    subAccount={subAccount}
                    decimals={decimals}
                    cancel={cancel}
                    cancelWrite={cancelWrite}
                  />
                ) : (
                  <RequestRow
                    key={String(request.id)}
                    request={request}
                    subAccount={subAccount}
                    decimals={decimals}
                    finalize={finalize}
                    cancel={cancel}
                    finalizeWrite={finalizeWrite}
                    cancelWrite={cancelWrite}
                  />
                ),
              )}
            </ul>
          ) : query.error ? null : (
            <ResultNote testId="integration-pending-empty">No active withdrawals for this subaccount.</ResultNote>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Whether a finalize/cancel mutation last targeted `request`. Request ids are
 * counted per subaccount, so the subaccount has to match as well.
 */
function targetsRequest(
  request: WithdrawRequest,
  account: Address | undefined,
  requestId: bigint | undefined,
): boolean {
  return account !== undefined && requestId === request.id && isAddressEqual(account, request.user);
}

/** A row's last failed finalize or cancel, on its own line under the row. */
function RowWriteError({ error, testId }: { error: SymmioRequestError | null; testId: string }) {
  if (!error) return null;
  return (
    <div className="basis-full">
      <ResultError testId={testId} kind={error.kind} message={error.message} />
    </div>
  );
}

function ExpressRequestRow({
  entry,
  subAccount,
  decimals,
  cancel,
  cancelWrite,
}: {
  entry: ExpressWithdrawStatusEntry;
  subAccount: Address;
  decimals: number;
  cancel: ReturnType<typeof useRequestCancelWithdraw>;
  cancelWrite: GaslessWriteOption;
}) {
  const { request, status, error, isFetching } = entry;
  /**
   * Core must accept the cancel, and the provider approves it only while its
   * status is ACCEPTED. While the service status cannot be read, Cancel stays
   * offered: Core still accepts it, and a provider refusal shows as this row's
   * error. There is no Finalize: on an Express request it releases the funds to
   * the provider rather than the receiver, and the service drives that step.
   */
  const cancellable =
    getWithdrawRequestActions(request).cancel && (status ? isExpressWithdrawCancellable(status) : error !== null);
  const cancelTargetsRow = targetsRequest(request, cancel.variables?.account, cancel.variables?.requestId);
  const cancellingThis = cancel.isPending && cancelTargetsRow;
  const detail = error
    ? error.message
    : !status
      ? "Checking provider status…"
      : status.local.status === "NOT_FOUND"
        ? "Waiting for the service to index the request"
        : status.onChain.status === "FINALIZED" && status.onChain.optionType === "STANDARD"
          ? "Core finalized; provider payout pending"
          : `Provider ${status.onChain.status} · service ${status.local.status}`;

  return (
    <li
      className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
      data-request-id={String(request.id)}
      data-testid={`express-withdraw-${request.id}`}
    >
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <span className="text-foreground font-mono text-sm">#{String(request.id)}</span>
          <Badge>{status?.onChain.optionType ?? "Express"}</Badge>
          {isFetching && !status ? <Spinner className="size-3.5" /> : null}
        </div>
        <span className={error ? "text-destructive text-xs" : "text-muted-foreground text-xs"}>
          {formatUsd(request.totalAmount, decimals)} USDC · {detail}
        </span>
      </div>

      {cancellable ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={cancellingThis}
          onClick={() => cancel.mutate({ account: subAccount, requestId: request.id, ...cancelWrite })}
          data-testid={`cancel-${request.id}`}
        >
          {cancellingThis ? <Spinner className="size-4" /> : null}
          Cancel
        </Button>
      ) : null}

      <RowWriteError error={cancelTargetsRow ? cancel.error : null} testId={`cancel-error-${request.id}`} />
    </li>
  );
}

/**
 * A classic request, or a request for a provider other than the configured
 * Express one. Its actions follow Core's status rules; Finalize also waits for
 * the cooldown.
 */
function RequestRow({
  request,
  subAccount,
  decimals,
  finalize,
  cancel,
  finalizeWrite,
  cancelWrite,
}: {
  request: WithdrawRequest;
  subAccount: Address;
  decimals: number;
  finalize: ReturnType<typeof useFinalizeWithdrawRequest>;
  cancel: ReturnType<typeof useRequestCancelWithdraw>;
  finalizeWrite: GaslessWriteOption;
  cancelWrite: GaslessWriteOption;
}) {
  const actions = getWithdrawRequestActions(request);
  const providerBacked = !isAddressEqual(request.provider, zeroAddress);
  const cooldownAt = Number(request.cooldownEndTime) * 1000;
  const { remainingMs, ready: cooldownOver } = useCountdown(cooldownAt);
  const finalizeTargetsRow = targetsRequest(request, finalize.variables?.user, finalize.variables?.requestId);
  const cancelTargetsRow = targetsRequest(request, cancel.variables?.account, cancel.variables?.requestId);
  const finalizingThis = finalize.isPending && finalizeTargetsRow;
  const cancellingThis = cancel.isPending && cancelTargetsRow;
  const detail =
    !actions.finalize && !actions.cancel
      ? "no action available"
      : providerBacked && request.status === WithdrawStatus.PENDING
        ? "awaiting provider acceptance"
        : cooldownOver
          ? "ready to finalize"
          : `cooldown ends in ${formatRemaining(remainingMs)}`;

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3" data-request-id={String(request.id)}>
      <div className="flex flex-col gap-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-foreground font-mono text-sm">#{String(request.id)}</span>
          <Badge variant="secondary">{WithdrawStatus[request.status] ?? String(request.status)}</Badge>
          {providerBacked ? (
            <Badge variant="outline" title={request.provider}>
              {request.isPureVirtual ? "Virtual provider" : "Provider"} {shortenAddress(request.provider)}
            </Badge>
          ) : null}
        </div>
        <span className="text-muted-foreground text-xs">
          {formatUsd(request.totalAmount, decimals)} USDC · {detail}
        </span>
      </div>

      {actions.finalize || actions.cancel ? (
        <div className="flex items-center gap-2">
          {actions.finalize ? (
            <Button
              type="button"
              size="sm"
              disabled={!cooldownOver || finalizingThis}
              onClick={() => finalize.mutate({ user: subAccount, requestId: request.id, ...finalizeWrite })}
              data-testid={`finalize-${request.id}`}
            >
              {finalizingThis ? <Spinner className="size-4" /> : null}
              Finalize
            </Button>
          ) : null}
          {actions.cancel ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={cancellingThis}
              onClick={() => cancel.mutate({ account: subAccount, requestId: request.id, ...cancelWrite })}
              data-testid={`cancel-${request.id}`}
            >
              {cancellingThis ? <Spinner className="size-4" /> : null}
              Cancel
            </Button>
          ) : null}
        </div>
      ) : null}

      <RowWriteError error={finalizeTargetsRow ? finalize.error : null} testId={`finalize-error-${request.id}`} />
      <RowWriteError error={cancelTargetsRow ? cancel.error : null} testId={`cancel-error-${request.id}`} />
    </li>
  );
}
