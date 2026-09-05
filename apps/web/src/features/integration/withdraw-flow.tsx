"use client";

import { Field } from "@/components/field";
import { ResultError, ResultNote, ResultSuccess } from "@/components/result";
import { TxReceipt } from "@/components/tx-result";
import { formatUsd } from "@/lib/format";
import { SubAccountIsolationType, WithdrawStatus, type WithdrawRequest } from "@symmio/trading-core";
import {
  useAccountBalanceInfo,
  useAccountBalanceOf,
  useFinalizeWithdrawRequest,
  usePendingWithdrawRequests,
  useRequestCancelWithdraw,
  useSubAccount,
  useWithdraw,
  useWithdrawableTime,
} from "@symmio/trading-react";
import { Badge } from "@symmio/ui/components/badge";
import { Button } from "@symmio/ui/components/button";
import { Input } from "@symmio/ui/components/input";
import { Spinner } from "@symmio/ui/components/spinner";
import { shortenAddress } from "@symmio/utils";
import { useEffect, useState } from "react";
import { isAddress, type Address } from "viem";
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
 * The withdraw step initiates a classic same-chain request, shows the cooldown
 * timing, and lists pending requests with inline finalize / cancel actions.
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

  const withdrawableTime = useWithdrawableTime({ user: subAccount });
  const withdraw = useWithdraw({ account: subAccount, chainId });

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

  const parsed = parseAmount(amount, decimals);
  const validReceiver = isAddress(receiver) ? (receiver as Address) : undefined;
  const canInitiate = Boolean(subAccount && parsed !== undefined && validReceiver && chainId !== undefined);

  const maxStep = !ready ? 0 : !subAccount ? 1 : 2;
  const current = Math.min(step, maxStep);

  useEffect(() => {
    setStep((previous) => Math.max(previous, maxStep));
  }, [maxStep]);

  function onInitiate() {
    if (!subAccount || parsed === undefined || !validReceiver || chainId === undefined) return;
    // `account`/`chainId` are bound on the hook (which resolves the subaccount's
    // isolation via useSubAccount); `parsed` is in the collateral token's decimals
    // and the hook builds the part + scales the deallocate amount.
    withdraw.mutate({ amount: parsed, receiver: validReceiver });
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
      hint: canInitiate ? "Ready to initiate" : "Amount & receiver",
      done: withdraw.isSuccess,
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
            withdraw.reset();
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
              withdraw.reset();
            }}
            decimals={decimals}
            invalid={amount.length > 0 && parsed === undefined}
          />

          <Field
            label="Receiver"
            htmlFor="integration-withdraw-receiver"
            action={
              owner ? (
                <Button type="button" size="xs" variant="ghost" onClick={() => setReceiver(owner)}>
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
                withdraw.reset();
              }}
              placeholder="0x…"
              className="font-mono"
              aria-invalid={receiver.length > 0 && !validReceiver}
            />
          </Field>

          <Button
            type="button"
            size="lg"
            disabled={!canInitiate || withdraw.isPending}
            onClick={onInitiate}
            data-testid="button-initiate-withdraw"
            className="w-full"
          >
            {withdraw.isPending ? <Spinner className="size-4" /> : null}
            {parsed === undefined ? "Enter an amount" : "Initiate withdrawal"}
          </Button>

          <InitiateStatus withdraw={withdraw} />

          {subAccount ? (
            <SubaccountBalance isCustom={isCustom} margin={marginBalance} available={availableBalance} />
          ) : null}

          {subAccount ? <PendingRequests subAccount={subAccount} decimals={decimals} /> : null}
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

function InitiateStatus({ withdraw }: { withdraw: ReturnType<typeof useWithdraw> }) {
  if (withdraw.isPending) {
    return (
      <ResultNote testId="integration-withdraw-status" loading>
        Submitting withdrawal request… confirm in your wallet.
      </ResultNote>
    );
  }
  if (withdraw.error) {
    return (
      <ResultError testId="integration-withdraw-status" kind={withdraw.error.kind} message={withdraw.error.message} />
    );
  }
  if (withdraw.isSuccess) {
    return (
      <ResultSuccess testId="integration-withdraw-status">
        <span className="text-foreground">Withdrawal initiated. Finalize it below after the cooldown.</span>
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

function PendingRequests({ subAccount, decimals }: { subAccount: Address; decimals: number }) {
  /** Re-render every second so cooldown countdowns and finalize-readiness stay live. */
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const query = usePendingWithdrawRequests({ user: subAccount });
  const finalize = useFinalizeWithdrawRequest();
  const cancel = useRequestCancelWithdraw();

  const items = query.data ?? [];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <h3 className="text-muted-foreground text-xs font-medium tracking-[0.18em] uppercase">Pending withdrawals</h3>
        <span className="bg-border/80 h-px flex-1" aria-hidden />
        <span className="text-muted-foreground font-mono text-xs">{items.length}</span>
      </div>

      {items.length === 0 ? (
        <ResultNote testId="integration-pending-empty">No active withdrawals for this subaccount.</ResultNote>
      ) : (
        <ul className="divide-border/60 border-border/70 divide-y overflow-hidden rounded-xl border">
          {items.map((request) => (
            <RequestRow
              key={String(request.id)}
              request={request}
              subAccount={subAccount}
              decimals={decimals}
              finalize={finalize}
              cancel={cancel}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function RequestRow({
  request,
  subAccount,
  decimals,
  finalize,
  cancel,
}: {
  request: WithdrawRequest;
  subAccount: Address;
  decimals: number;
  finalize: ReturnType<typeof useFinalizeWithdrawRequest>;
  cancel: ReturnType<typeof useRequestCancelWithdraw>;
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
          onClick={() => finalize.mutate({ user: subAccount, requestId: request.id })}
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
          onClick={() => cancel.mutate({ account: subAccount, requestId: request.id })}
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
