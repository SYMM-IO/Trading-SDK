"use client";

import { Field } from "@/components/field";
import { ResultError, ResultNote, ResultSuccess } from "@/components/result";
import { TxReceipt } from "@/components/tx-result";
import { useFlowWriteOption, type GaslessWriteOption } from "@/features/gasless/gasless-write-mode-store";
import { SessionKeySignerNote } from "@/features/gasless/session-key-signer-note";
import { formatUsd } from "@/lib/format";
import {
  SubAccountIsolationType,
  WithdrawStatus,
  type WithdrawRequest,
  type WithdrawRoute,
  type WithdrawRouteChoice,
  type WithdrawRouteChoices,
} from "@symmio/trading-core";
import {
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
 * route, shows provider/cooldown progress, and keeps classic pending requests
 * available for inline finalize / cancel actions.
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
  const routeChoices = useWithdrawRouteChoices({
    user: subAccount ?? zeroAddress,
    amount: parsed ?? 0n,
    receiver: validReceiver ?? zeroAddress,
    chainId,
    query: { enabled: canInitiate && withdraw.isIdle && classicWithdraw.isIdle },
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
  const hasSelectedRoute = withdrawMethod === "auto" ? routeChoices.data !== undefined : selectedRoute !== undefined;

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
    if (!subAccount || parsed === undefined || !validReceiver || chainId === undefined || !routeChoices.data) return;
    // `account`/`chainId` are bound on the hook (which resolves the subaccount's
    // isolation via useSubAccount); `parsed` is in the collateral token's decimals
    // and the hook builds the part + scales the deallocate amount.
    if (withdrawMethod === "classic") {
      withdraw.reset();
      classicWithdraw.mutate({ amount: parsed, receiver: validReceiver, ...initiateWrite });
      return;
    }

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
    <FlowLayout steps={steps} current={current} maxReachable={maxStep} onStepClick={setStep}>
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
              amount={parsed}
              decimals={decimals}
            />
          ) : null}

          <Button
            type="button"
            size="lg"
            disabled={
              !canInitiate ||
              routeChoices.isFetching ||
              !hasSelectedRoute ||
              withdraw.isPending ||
              classicWithdraw.isPending
            }
            onClick={onInitiate}
            data-testid="button-initiate-withdraw"
            className="w-full"
          >
            {withdraw.isPending || classicWithdraw.isPending || routeChoices.isFetching ? (
              <Spinner className="size-4" />
            ) : null}
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
              automatic={withdrawMethod === "auto"}
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

function WithdrawalMethodSelect({
  query,
  value,
  onValueChange,
  amount,
  decimals,
}: {
  query: ReturnType<typeof useWithdrawRouteChoices>;
  value: string;
  onValueChange: (value: string) => void;
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
      <Select value={value} onValueChange={onValueChange} disabled={!query.data || query.isFetching}>
        <SelectTrigger id="integration-withdraw-method" data-testid="integration-withdraw-method">
          <SelectValue placeholder="Choose a withdrawal method" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="auto" description={autoDescription}>
            Auto (recommended)
          </SelectItem>
          {classic ? (
            <SelectItem
              value="classic"
              description={
                classic.finalize === "immediate"
                  ? "Classic protocol route; the request can be finalized immediately"
                  : "Classic protocol route; finalize after the cooldown"
              }
            >
              Classic
            </SelectItem>
          ) : null}
          {express.map((choice) => (
            <SelectItem
              key={getExpressMethodValue(choice)}
              value={getExpressMethodValue(choice)}
              description={getExpressChoiceDescription(choice, amount, decimals)}
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
  automatic,
  amount,
  decimals,
}: {
  query: ReturnType<typeof useWithdrawRouteChoices>;
  route: WithdrawRoute | WithdrawRouteChoice | undefined;
  automatic: boolean;
  amount: bigint;
  decimals: number;
}) {
  if (query.isFetching) {
    return <ResultNote loading>Checking available withdrawal routes…</ResultNote>;
  }
  if (query.error) {
    return <ResultError kind={query.error.kind} message={query.error.message} />;
  }
  if (!route) return <ResultNote>The selected withdrawal method is no longer available.</ResultNote>;

  if (route.kind === "classic") {
    const fallbackDescription =
      automatic && "reason" in route
        ? {
            "service-disabled": "Express is disabled on this chain; the classic cooldown path will be used.",
            "service-error": "The Express service is unavailable; the classic cooldown path will be used.",
            "no-option": "No preferred Express option is available; the classic cooldown path will be used.",
            "unsupported-account": "This account requires deallocation, so the classic cooldown path will be used.",
            "cooldown-ready": "The cooldown is already satisfied; initiation and finalization will be atomic.",
          }[route.reason]
        : route.finalize === "immediate"
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
    return (
      <ResultError testId="integration-withdraw-status" kind={withdraw.error.kind} message={withdraw.error.message} />
    );
  }
  if (withdraw.isSuccess) {
    if (withdraw.data.route.kind === "express") {
      const progress = status.data;
      const failed =
        progress?.onChain.status === "CANCELLED" ||
        progress?.onChain.status === "SUSPENDED" ||
        progress?.local.status === "FAILED" ||
        progress?.local.status === "CANCELLED" ||
        progress?.local.status === "SUSPENDED";
      if (status.error) {
        return (
          <ResultError testId="integration-withdraw-status" kind={status.error.kind} message={status.error.message} />
        );
      }
      if (failed) {
        return (
          <ResultError
            testId="integration-withdraw-status"
            kind="unknown"
            message={`Express withdrawal stopped (${progress?.local.status ?? progress?.onChain.status}).`}
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
  const activeExpressEntries = express.entries.filter(
    (entry) => entry.status === undefined || !isExpressWithdrawPayoutComplete(entry.status),
  );
  const expressRequestIds = new Set(express.entries.map((entry) => entry.request.id));
  const classicItems = (query.data ?? []).filter(
    (request) => isAddressEqual(request.provider, zeroAddress) && !expressRequestIds.has(request.id),
  );
  const itemCount = classicItems.length + activeExpressEntries.length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <h3 className="text-muted-foreground text-xs font-medium tracking-[0.18em] uppercase">Pending withdrawals</h3>
        <span className="bg-border/80 h-px flex-1" aria-hidden />
        <span className="text-muted-foreground font-mono text-xs">{itemCount}</span>
      </div>

      {query.isLoading ? (
        <ResultNote loading>Loading active withdrawals…</ResultNote>
      ) : itemCount === 0 ? (
        <ResultNote testId="integration-pending-empty">No active withdrawals for this subaccount.</ResultNote>
      ) : (
        <ul className="divide-border/60 border-border/70 divide-y overflow-hidden rounded-xl border">
          {classicItems.map((request) => (
            <RequestRow
              key={`classic-${request.id}`}
              request={request}
              subAccount={subAccount}
              decimals={decimals}
              finalize={finalize}
              cancel={cancel}
              finalizeWrite={finalizeWrite}
              cancelWrite={cancelWrite}
            />
          ))}
          {activeExpressEntries.map((entry) => (
            <ExpressRequestRow key={`express-${entry.request.id}`} entry={entry} decimals={decimals} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ExpressRequestRow({ entry, decimals }: { entry: ExpressWithdrawStatusEntry; decimals: number }) {
  const { request, status, error, isFetching } = entry;
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
    </li>
  );
}

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
  const cooldownAt = Number(request.cooldownEndTime) * 1000;
  const { remainingMs, ready: finalizable } = useCountdown(cooldownAt);
  const finalizingThis = finalize.isPending && finalize.variables?.requestId === request.id;
  const cancellingThis = cancel.isPending && cancel.variables?.requestId === request.id;

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3" data-request-id={String(request.id)}>
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <span className="text-foreground font-mono text-sm">#{String(request.id)}</span>
          <Badge variant="secondary">{WithdrawStatus[request.status] ?? String(request.status)}</Badge>
        </div>
        <span className="text-muted-foreground text-xs">
          {formatUsd(request.totalAmount, decimals)} USDC ·{" "}
          {finalizable ? "ready to finalize" : `cooldown ends in ${formatRemaining(remainingMs)}`}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          disabled={!finalizable || finalizingThis}
          onClick={() => finalize.mutate({ user: subAccount, requestId: request.id, ...finalizeWrite })}
          data-testid={`finalize-${request.id}`}
        >
          {finalizingThis ? <Spinner className="size-4" /> : null}
          Finalize
        </Button>
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
      </div>
    </li>
  );
}

/**
 * Live "time remaining" until `targetMs`, re-rendering as it counts down — every
 * second inside the final hour, every 30 s before that. `ready` flips true at 0.
 * The withdraw cooldown is a protocol-configured on-chain value, so this handles
 * a longer-than-a-day cooldown too (see {@link formatRemaining}).
 */
function useCountdown(targetMs: number): { remainingMs: number; ready: boolean } {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (targetMs - Date.now() <= 0) return; // already ready — no ticker
    let timeout: number;
    const tick = () => {
      setNow(Date.now());
      const remaining = targetMs - Date.now();
      if (remaining <= 0) return;
      timeout = window.setTimeout(tick, remaining < 3_600_000 ? 1000 : 30_000);
    };
    timeout = window.setTimeout(tick, targetMs - Date.now() < 3_600_000 ? 1000 : 30_000);
    return () => window.clearTimeout(timeout);
  }, [targetMs]);
  const remainingMs = targetMs - now;
  return { remainingMs, ready: remainingMs <= 0 };
}

/**
 * Human "time remaining" — `2d 3h 10m` / `3h 10m` / `10m 04s` / `4s`. Includes a
 * day segment when ≥ 24 h so a cooldown longer than a day never renders as a bare
 * clock time.
 */
function formatRemaining(ms: number): string {
  if (ms <= 0) return "now";
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
  return `${seconds}s`;
}
