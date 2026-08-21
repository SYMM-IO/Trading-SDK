"use client";

import { MicroLabel } from "@/components/panel";
import { Skeleton } from "@/components/table";
import { Numeric } from "@/components/value";
import type { FundingAccount } from "@/features/accounts/account-provider";
import { formatUsd } from "@/lib/format";
import { getCollateralBalanceQueryKey, type WithdrawRequest } from "@symmio/trading-core";
import {
  predicateMatch,
  useFinalizeWithdrawRequest,
  usePendingWithdrawRequests,
  useRequestCancelWithdraw,
  useSymmioConfig,
} from "@symmio/trading-react";
import { useQueryClient } from "@tanstack/react-query";
import { GatedSubmit } from "./gated-submit";
import { useWriteToast } from "./use-write-toast";
import { formatCountdown, WITHDRAW_STATUS_STYLES } from "./withdraw-status";

export interface PendingWithdrawsProps {
  account: FundingAccount;
  /** Collateral token decimals — request parts are in the token's own units. */
  collateralDecimals: number;
}

/**
 * The account's in-flight withdraw requests, with their two exits.
 *
 * A withdrawal is not one transaction: `useWithdraw` opens a request, the
 * cooldown runs, and then somebody finalizes it. `useFinalizeWithdrawRequest`
 * is permissionless — any wallet may submit it — but it still needs the wallet
 * on the request's own chain, so it goes through the same chain gate as
 * everything else here.
 */
export function PendingWithdraws({ account, collateralDecimals }: PendingWithdrawsProps) {
  const { deployment } = account;
  const runWrite = useWriteToast();

  const pending = usePendingWithdrawRequests({
    user: account.address,
    chainId: deployment.chainId,
  });
  const config = useSymmioConfig();
  const queryClient = useQueryClient();

  const finalize = useFinalizeWithdrawRequest();
  const cancel = useRequestCancelWithdraw();

  /* The SDK invalidates the three withdraw lists on success but not the wallet's
     collateral balance — even though finalizing is exactly the step that pays
     the ERC-20 out. With this app's `refetchOnWindowFocus: false`, the deposit
     modal would keep showing the pre-payout wallet balance indefinitely. */
  const invalidateWalletBalance = () => {
    const configKey = config.getChainConfigKey(deployment.chainId);
    void queryClient.invalidateQueries({
      predicate: predicateMatch(getCollateralBalanceQueryKey, { configKey }),
    });
  };

  const requests = pending.data ?? [];

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <MicroLabel>In flight</MicroLabel>
        <span className="ml-auto text-2xs text-fg-3">
          {requests.length > 0 ? `${requests.length} request${requests.length > 1 ? "s" : ""}` : null}
        </span>
      </div>

      {pending.isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      ) : pending.error ? (
        <p className="rounded-md border border-line-subtle bg-bg-2 px-3 py-2 text-sm text-warn">
          Could not read pending withdrawals from {deployment.solverName}&apos;s chain.
        </p>
      ) : requests.length === 0 ? (
        <p className="rounded-md border border-line-subtle bg-bg-2 px-3 py-2 text-sm text-fg-3">
          No withdrawal is in flight for this account.
        </p>
      ) : (
        requests.map((request) => (
          <RequestRow
            key={String(request.id)}
            request={request}
            account={account}
            collateralDecimals={collateralDecimals}
            isBusy={finalize.isPending || cancel.isPending}
            onFinalize={() =>
              void runWrite({ pending: "Finalizing withdrawal…", success: "Withdrawal paid out" }, async () => {
                const result = await finalize.mutateAsync({
                  user: account.address,
                  requestId: request.id,
                  chainId: deployment.chainId,
                });
                invalidateWalletBalance();
                return result;
              })
            }
            onCancel={() =>
              void runWrite(
                {
                  pending: "Cancelling withdrawal…",
                  success: "Cancellation requested",
                  tone: "warn",
                },
                () =>
                  cancel.mutateAsync({
                    account: account.address,
                    requestId: request.id,
                    chainId: deployment.chainId,
                  }),
              )
            }
          />
        ))
      )}
    </div>
  );
}

interface RequestRowProps {
  request: WithdrawRequest;
  account: FundingAccount;
  collateralDecimals: number;
  isBusy: boolean;
  onFinalize: () => void;
  onCancel: () => void;
}

function RequestRow({ request, account, collateralDecimals, isBusy, onFinalize, onCancel }: RequestRowProps) {
  const total = request.parts.reduce((sum, part) => sum + part.amount, 0n);
  const style = WITHDRAW_STATUS_STYLES[request.status];
  const secondsLeft = Number(request.cooldownEndTime) - Math.floor(Date.now() / 1000);
  const matured = secondsLeft <= 0;

  return (
    <div className="flex flex-col gap-2 rounded-md border border-line-subtle bg-bg-2 p-3">
      <div className="flex items-center gap-2">
        <Numeric size="md" tone="strong">
          {formatUsd(Number(total) / 10 ** collateralDecimals, { exact: true })}
        </Numeric>
        <span
          className="rounded-full px-2 py-0.5 text-2xs font-semibold tracking-[0.12em] uppercase"
          style={{ background: "var(--bg-0)", color: style.color }}
        >
          {style.label}
        </span>
        <span className="tnum ml-auto text-2xs text-fg-3">
          #{String(request.id)} · {matured ? "ready" : formatCountdown(secondsLeft)}
        </span>
      </div>

      <div className="flex gap-2">
        <GatedSubmit
          deployment={account.deployment}
          label="Finalize"
          onSubmit={onFinalize}
          disabled={!matured || isBusy}
          size="sm"
          className="flex-1"
        />
        {/* `requestCancelWithdraw` is an `AccountLayer._call` like its Finalize
            sibling, so it needs the same gate. Ungated it threw a connector
            chain mismatch that the SDK reports as "No connected wallet". */}
        <GatedSubmit
          deployment={account.deployment}
          label="Cancel"
          onSubmit={onCancel}
          disabled={isBusy}
          variant="ghost"
          size="sm"
        />
      </div>
    </div>
  );
}
