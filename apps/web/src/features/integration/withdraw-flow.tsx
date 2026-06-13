"use client";

import { Field } from "@/components/field";
import { ResultError, ResultNote, ResultSuccess } from "@/components/result";
import { TxReceipt } from "@/components/tx-result";
import { formatUsd } from "@/lib/format";
import { createClassicWithdrawPart, WithdrawStatus, type WithdrawRequest } from "@symm-frontier/core";
import {
  useFinalizeWithdrawRequest,
  useInitiateWithdraw,
  usePendingWithdrawRequests,
  useRequestCancelWithdraw,
  useWithdrawableTime,
} from "@symm-frontier/react";
import { Badge } from "@symm-frontier/ui/components/badge";
import { Button } from "@symm-frontier/ui/components/button";
import { Input } from "@symm-frontier/ui/components/input";
import { Spinner } from "@symm-frontier/ui/components/spinner";
import { shortenAddress } from "@symm-frontier/utils";
import { useEffect, useState } from "react";
import { isAddress, type Address } from "viem";
import { WalletPanel } from "../inspector/wallet-panel";
import { AmountField } from "./amount-field";
import { FlowRail, type FlowStep } from "./flow-rail";
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
export function WithdrawFlow({ owner, subAccount, subAccountName, onSelectSubAccount, decimals, chainId, ready }: Props) {
  const [step, setStep] = useState(0);
  const [amount, setAmount] = useState<string>("");
  const [receiver, setReceiver] = useState<string>("");

  const withdrawableTime = useWithdrawableTime({ user: subAccount });
  const initiate = useInitiateWithdraw();

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
    const part = createClassicWithdrawPart({
      id: 0n,
      amount: parsed,
      receiver: validReceiver,
      chainId: BigInt(chainId),
    });
    initiate.mutate({ account: subAccount, parts: [part] });
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
      done: initiate.isSuccess,
    },
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
              initiate.reset();
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
                initiate.reset();
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
                  initiate.reset();
                }}
                placeholder="0x…"
                className="font-mono"
                aria-invalid={receiver.length > 0 && !validReceiver}
              />
            </Field>

            <Button
              type="button"
              size="lg"
              disabled={!canInitiate || initiate.isPending}
              onClick={onInitiate}
              data-testid="button-initiate-withdraw"
              className="w-full"
            >
              {initiate.isPending ? <Spinner className="size-4" /> : null}
              {parsed === undefined ? "Enter an amount" : "Initiate withdrawal"}
            </Button>

            <InitiateStatus initiate={initiate} />

            {subAccount ? <PendingRequests subAccount={subAccount} decimals={decimals} /> : null}
          </>
        )}
      </div>

      <div className="lg:border-border/50 lg:border-l lg:pl-8">
        <FlowRail steps={steps} current={current} maxReachable={maxStep} onStepClick={setStep} />
      </div>
    </div>
  );
}

function WithdrawableReadout({ query }: { query: ReturnType<typeof useWithdrawableTime> }) {
  if (query.data === undefined) return null;
  const at = Number(query.data) * 1000;
  const ready = Date.now() >= at;

  return (
    <div className="border-border/60 bg-muted/30 flex items-center gap-2.5 rounded-xl border px-4 py-2.5 text-sm">
      <span className={ready ? "bg-positive size-2 rounded-full" : "bg-warning size-2 rounded-full"} aria-hidden />
      <span className="text-foreground">
        {ready ? "Withdrawable immediately" : `Cooldown until ${new Date(at).toLocaleString()}`}
      </span>
    </div>
  );
}

function InitiateStatus({ initiate }: { initiate: ReturnType<typeof useInitiateWithdraw> }) {
  if (initiate.isPending) {
    return (
      <ResultNote testId="integration-withdraw-status" loading>
        Submitting withdrawal request… confirm in your wallet.
      </ResultNote>
    );
  }
  if (initiate.error) {
    return (
      <ResultError testId="integration-withdraw-status" kind={initiate.error.kind} message={initiate.error.message} />
    );
  }
  if (initiate.isSuccess) {
    return (
      <ResultSuccess testId="integration-withdraw-status">
        <span className="text-foreground">Withdrawal initiated. Finalize it below after the cooldown.</span>
        <TxReceipt
          hash={initiate.data.hash}
          receipt={
            initiate.data.receipt
              ? { blockNumber: initiate.data.receipt.blockNumber, status: String(initiate.data.receipt.status) }
              : undefined
          }
        />
      </ResultSuccess>
    );
  }
  return null;
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
  const finalizable = Date.now() >= cooldownAt;
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
          {finalizable ? "ready to finalize" : `cooldown until ${new Date(cooldownAt).toLocaleTimeString()}`}
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
