"use client";

import { DataList, DataRow } from "@/components/data-list";
import { ResultError, ResultNote, ResultSuccess } from "@/components/result";
import { TxReceipt } from "@/components/tx-result";
import { useGaslessWriteOption } from "@/features/gasless/gasless-write-mode-store";
import { useWalletAccount, useWithdrawWithExpress } from "@symmio/trading-react";
import { Button } from "@symmio/ui/components/button";
import { Spinner } from "@symmio/ui/components/spinner";
import { ExpressWithdrawConfigNote } from "./express-withdraw-config-note";
import { WithdrawRouteSummary } from "./express-withdraw-route-view";
import { MethodCard } from "./method-card";
import { useWithdrawIntentForm, WithdrawIntentFields } from "./withdraw-intent-fields";
import { RoutePolicyFields, useRoutePolicyForm } from "./withdraw-route-policy-fields";

export function WriteWithdrawWithExpress() {
  const { isConnected, isOnExpectedChain } = useWalletAccount();
  const form = useWithdrawIntentForm();
  const policyForm = useRoutePolicyForm();
  const canSubmit = isConnected && isOnExpectedChain && form.intent !== undefined;

  /** `account` is bound on the hook, which resolves the subaccount's isolation before routing. */
  const mutation = useWithdrawWithExpress({ account: form.intent?.user });

  const write = useGaslessWriteOption("withdrawWithExpress");

  return (
    <MethodCard
      testId="method-withdrawWithExpress"
      name="withdrawWithExpress"
      mutability="nonpayable"
      gaslessRelayable
      description="Prepare a route under the policy, then submit it: an Express option through the provider, an atomic classic initiate + finalize, or a classic request to finalize after the cooldown."
    >
      <ExpressWithdrawConfigNote />
      <WithdrawIntentFields idPrefix="withdraw-with-express" form={form} onEdit={() => mutation.reset()} />
      <RoutePolicyFields idPrefix="withdraw-with-express" form={policyForm} onEdit={() => mutation.reset()} />

      <Button
        type="button"
        size="sm"
        disabled={!canSubmit || mutation.isPending}
        onClick={() => {
          if (!form.intent) return;
          mutation.mutate({
            amount: form.intent.amount,
            receiver: form.intent.receiver,
            policy: policyForm.policy,
            ...write,
          });
        }}
        data-testid="button-send-withdraw-with-express"
      >
        {mutation.isPending ? (
          <>
            <Spinner className="size-4" /> Sending…
          </>
        ) : (
          "Send transaction"
        )}
      </Button>

      <WritePanel mutation={mutation} />
    </MethodCard>
  );
}

function WritePanel({ mutation }: { mutation: ReturnType<typeof useWithdrawWithExpress> }) {
  if (mutation.isPending) {
    return (
      <ResultNote testId="result-withdrawWithExpress-pending" loading>
        Preparing the route, then submitting… waiting for wallet, then receipt.
      </ResultNote>
    );
  }
  if (mutation.error) {
    return (
      <ResultError
        testId="result-withdrawWithExpress-error"
        kind={mutation.error.kind}
        message={mutation.error.message}
      />
    );
  }
  if (mutation.isSuccess) {
    const { route, requestId } = mutation.data;
    return (
      <ResultSuccess testId="result-withdrawWithExpress-success">
        <span className="text-foreground">
          {route.kind === "express"
            ? "Express request initiated. Track payout with getExpressWithdrawStatus."
            : route.finalize === "immediate"
              ? "Withdrawal initiated and finalized in one transaction."
              : "Classic request initiated. Finalize it after the cooldown."}
        </span>
        <DataList>
          <DataRow label="route" value={<WithdrawRouteSummary route={route} />} />
          <DataRow label="requestId" value={String(requestId)} mono copyValue={String(requestId)} />
        </DataList>
        <TxReceipt
          hash={mutation.data.hash}
          receipt={{ blockNumber: mutation.data.receipt.blockNumber, status: String(mutation.data.receipt.status) }}
        />
      </ResultSuccess>
    );
  }
  return <ResultNote testId="result-withdrawWithExpress-idle">Fill the fields above and submit.</ResultNote>;
}
