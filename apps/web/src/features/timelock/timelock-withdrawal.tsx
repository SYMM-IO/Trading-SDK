"use client";

import { Field } from "@/components/field";
import { ResultError, ResultNote, ResultSuccess, ResultWarning } from "@/components/result";
import { TxReceipt } from "@/components/tx-result";
import { AmountField } from "@/features/integration/amount-field";
import { parseAmount } from "@/features/integration/parse-amount";
import type { EarlyWithdrawalCall } from "@symmio/trading-core";
import { useEarlyWithdraw, useSubAccount, useWalletAccount } from "@symmio/trading-react";
import { Button } from "@symmio/ui/components/button";
import { Input } from "@symmio/ui/components/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@symmio/ui/components/select";
import { useEffect, useRef, useState } from "react";
import { isAddress, isAddressEqual, zeroAddress, type Address } from "viem";
import { withTimelockAttemptLock } from "./timelock-recovery";
import type { TimelockContext } from "./use-timelock-context";

interface Props {
  account: Address;
  context: TimelockContext;
  recovery: string | null;
  saveRecovery: (value: string | null) => void;
  onBusyChange: (busy: boolean) => void;
  storageKey: string;
}

/** Explicit withdrawal variants; no deallocation or duplicate approval is hidden in this console. */
export function TimelockWithdrawal({ account, context, recovery, saveRecovery, onBusyChange, storageKey }: Props) {
  const wallet = useWalletAccount();
  const root = useSubAccount({ account: context.policy.data?.rootAccount, chainId: context.chainId });
  const [method, setMethod] = useState<EarlyWithdrawalCall["method"]>("initiateWithdraw");
  const [amount, setAmount] = useState("");
  const [receiver, setReceiver] = useState("");
  const [localError, setLocalError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const withdrawal = useEarlyWithdraw();
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const decimals = context.config.getChainConfig(context.chainId).addresses.collateralDecimals;
  const parsed = parseAmount(amount, decimals);
  const validReceiver = isAddress(receiver) ? receiver : undefined;
  const isOwner = Boolean(wallet.address && root.data?.owner && isAddressEqual(wallet.address, root.data.owner));
  const canSubmit =
    context.ready &&
    !context.unsupported &&
    isOwner &&
    wallet.isOnExpectedChain &&
    wallet.chainId === context.chainId &&
    parsed !== undefined &&
    (method === "withdraw" || validReceiver) &&
    !recovery &&
    !busy &&
    !withdrawal.isPending;

  async function submit() {
    if (!canSubmit || parsed === undefined || !wallet.address) return;
    setBusy(true);
    onBusyChange(true);
    setLocalError(undefined);
    let issued = false;
    let started = false;
    let savedApproval: string | undefined;
    let ownsJournal = false;
    try {
      await withTimelockAttemptLock(storageKey, async () => {
        // Save before any signature/HTTP request. Reload never quietly enables a second issuance.
        saveRecovery(
          "An approval attempt is in progress or has an unknown outcome. Reconcile it before another attempt.",
        );
        ownsJournal = true;
        const block = await context.config.getClient({ chainId: context.chainId }).getBlock();
        if (!alive.current) {
          saveRecovery(null);
          return;
        }
        const call: EarlyWithdrawalCall =
          method === "withdraw"
            ? { method, amount: parsed }
            : method === "withdrawTo"
              ? { method, amount: parsed, recipient: validReceiver! }
              : {
                  method,
                  parts: [
                    {
                      id: 0n,
                      amount: parsed,
                      receiver: validReceiver!,
                      chainId: BigInt(context.chainId),
                      virtualProvider: zeroAddress,
                      expressProvider: zeroAddress,
                    },
                  ],
                };
        started = true;
        const result = await withdrawal.mutateAsync({
          account,
          chainId: context.chainId,
          solverId: context.solverId,
          from: wallet.address,
          withdrawal: call,
          deadline: block.timestamp + 300n,
          onApproval: (approval) => {
            issued = true;
            savedApproval = JSON.stringify(
              approval,
              (_, value: unknown) => (typeof value === "bigint" ? value.toString() : value),
              2,
            );
            saveRecovery(savedApproval);
            if (!alive.current)
              throw new Error("Account or deployment changed. Reconcile the saved approval before executing.");
          },
        });
        if (result.receipt?.status === "success") saveRecovery(null);
      });
    } catch (error) {
      const cause = error instanceof Error ? error.cause : undefined;
      if (savedApproval && cause && typeof cause === "object" && "hash" in cause && typeof cause.hash === "string") {
        try {
          saveRecovery(JSON.stringify({ approval: JSON.parse(savedApproval), transactionHash: cause.hash }, null, 2));
        } catch {
          /* The approval journal remains; storage error is shown by the parent. */
        }
      }
      // Even wallet rejection can happen AFTER approval issuance. Keep issued approvals.
      if (
        ownsJournal &&
        (!started ||
          (!issued && error && typeof error === "object" && "kind" in error && error.kind === "user-rejected"))
      ) {
        try {
          saveRecovery(null);
        } catch {
          /* Keep recovery blocked when storage is unavailable. */
        }
      }
      if (alive.current) setLocalError(error instanceof Error ? error.message : String(error));
    } finally {
      onBusyChange(false);
      if (alive.current) setBusy(false);
    }
  }

  return (
    <section className="flex flex-col gap-4" data-testid="timelock-withdrawal">
      <h3 className="text-sm font-medium">Withdrawal with solver approval</h3>
      <ResultNote>
        Amounts use collateral units. Funds must already be available; this action does not deallocate margin.
        Initiation still requires Core cooldown and finalization on the Withdraw tab.
      </ResultNote>
      <fieldset disabled={busy || Boolean(recovery)} className="flex flex-col gap-4">
        <Field label="Withdrawal method" htmlFor="timelock-method">
          <Select
            value={method}
            onValueChange={(value) => setMethod(value as EarlyWithdrawalCall["method"])}
            disabled={busy || Boolean(recovery)}
          >
            <SelectTrigger id="timelock-method">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["initiateWithdraw", "withdraw", "withdrawTo"].map((value) => (
                <SelectItem key={value} value={value}>
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <AmountField id="timelock-amount" label="Amount" value={amount} onChange={setAmount} decimals={decimals} />
        {method !== "withdraw" ? (
          <Field label="Receiver" htmlFor="timelock-receiver">
            <Input
              id="timelock-receiver"
              value={receiver}
              onChange={(event) => setReceiver(event.target.value)}
              placeholder="0x…"
            />
          </Field>
        ) : null}
      </fieldset>
      {!isOwner ? (
        <ResultNote>Connect the owner wallet of the root account to execute this withdrawal.</ResultNote>
      ) : null}
      <Button disabled={!canSubmit} onClick={() => void submit()} data-testid="timelock-early-withdraw">
        {busy ? "Waiting for approval and transaction confirmation…" : "Request approval and withdraw"}
      </Button>
      <ResultNote>
        Requests one approval, then executes using the owner wallet and the configured gasless mode. No automatic retry
        or delayed fallback.
      </ResultNote>
      {localError ? <ResultError kind={withdrawal.error?.code ?? withdrawal.error?.kind} message={localError} /> : null}
      {withdrawal.error?.timelock ? (
        <ResultWarning>
          {withdrawal.error.timelock.errorCategory}:{" "}
          {withdrawal.error.timelock.errorDetail ?? withdrawal.error.timelock.errorMessage}
        </ResultWarning>
      ) : null}
      {withdrawal.data?.receipt ? (
        <ResultSuccess>
          {withdrawal.variables?.withdrawal.method === "initiateWithdraw"
            ? "Withdrawal initiation confirmed; finalize after the Core cooldown."
            : "Withdrawal confirmed."}
          <TxReceipt
            hash={withdrawal.data.hash}
            receipt={{ blockNumber: withdrawal.data.receipt.blockNumber, status: withdrawal.data.receipt.status }}
          />
        </ResultSuccess>
      ) : null}
    </section>
  );
}
