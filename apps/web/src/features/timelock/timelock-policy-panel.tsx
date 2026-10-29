"use client";

import { DataList, DataRow } from "@/components/data-list";
import { ResultError, ResultNote, ResultSuccess } from "@/components/result";
import { TxReceipt } from "@/components/tx-result";
import { useSetupTimelockPolicy, useSubAccount, useWalletAccount } from "@symmio/trading-react";
import { Button } from "@symmio/ui/components/button";
import { Checkbox } from "@symmio/ui/components/checkbox";
import { Label } from "@symmio/ui/components/label";
import { isAddressEqual } from "viem";
import type { TimelockContext } from "./use-timelock-context";

/** Owner-confirmed setup via SDK defaults; on-chain readiness never pretends to prove solver indexing. */
export function TimelockPolicyPanel({ context }: { context: TimelockContext }) {
  const { policy, info, capability, chainId, solverId } = context;
  const wallet = useWalletAccount();
  const root = useSubAccount({ account: policy.data?.rootAccount, chainId });
  const setup = useSetupTimelockPolicy();
  const owner = root.data?.owner;
  const canWrite = Boolean(
    wallet.isOnExpectedChain &&
    wallet.chainId === chainId &&
    wallet.address &&
    owner &&
    isAddressEqual(wallet.address, owner),
  );
  const error = info.error ?? policy.error ?? setup.error;

  if (context.unsupported) return <ResultNote>This deployment does not advertise timelock approvals.</ResultNote>;

  return (
    <section className="border-border/70 flex flex-col gap-4 rounded-xl border p-4" data-testid="timelock-policy">
      <h3 className="text-sm font-medium">Trading protection</h3>
      {error ? <ResultError kind={error.code ?? error.kind} message={error.message} /> : null}
      {!capability || !policy.data ? (
        <ResultNote loading={!error}>Reading deployment and root policy…</ResultNote>
      ) : (
        <>
          <DataList>
            <DataRow label="Root account" value={policy.data.rootAccount} />
            <DataRow label="Minimum cooldown" value={`${policy.data.requiredDelay} seconds`} />
            <DataRow label="Unlocker" value={capability.unlocker} />
            <DataRow label="Approval validity" value={`${capability.validitySeconds} seconds (not an HTTP timeout)`} />
          </DataList>
          <details>
            <summary className="cursor-pointer text-sm">
              {policy.data.selectors.filter((item) => item.status === "ok").length} / {policy.data.selectors.length}{" "}
              selectors configured
            </summary>
            <ul className="mt-2 space-y-1 font-mono text-xs">
              {policy.data.selectors.map((item) => (
                <li key={item.selector}>
                  {item.selector} · {item.status} · {item.delay.toString()}s
                </li>
              ))}
            </ul>
          </details>
          {!policy.data.ready ? (
            <Button
              disabled={!canWrite || setup.isPending || Boolean(setup.error)}
              onClick={() => {
                if (!policy.data || !canWrite) return;
                context.acknowledgeIndexing(false);
                setup.mutate({ account: policy.data.rootAccount, chainId, solverId, from: wallet.address });
              }}
              data-testid="timelock-setup"
            >
              {setup.isPending ? "Confirming setup…" : "Configure trading protection"}
            </Button>
          ) : (
            <ResultSuccess>All required selectors satisfy the on-chain policy.</ResultSuccess>
          )}
          {!canWrite ? (
            <ResultNote>Connect the owner wallet of the root account on the selected chain to configure it.</ResultNote>
          ) : null}
          {policy.data.selectors.some((item) => item.status === "ok") ? (
            <Label className="items-start">
              <Checkbox
                checked={context.indexingAcknowledged}
                onCheckedChange={(value) => context.acknowledgeIndexing(value === true)}
                data-testid="timelock-indexing"
              />
              <span>I have independently verified that the solver has indexed this policy.</span>
            </Label>
          ) : null}
        </>
      )}
      <ResultNote>
        On-chain confirmation does not prove solver indexing. This console has no indexing-status endpoint and never
        requests an approval to check it.
      </ResultNote>
      {setup.data ? (
        <>
          <ResultNote>Setup confirmed. Solver indexing: {setup.data.indexing}.</ResultNote>
          <TxReceipt
            hash={setup.data.hash}
            receipt={{ blockNumber: setup.data.receipt.blockNumber, status: setup.data.receipt.status }}
          />
        </>
      ) : null}
      {setup.error ? (
        <ResultNote>
          Reconcile any submitted transaction before trying setup again. Reducing a delay or replacing an unlocker may
          require authorization or a schedule; the SDK blocks unapproved changes.
        </ResultNote>
      ) : null}
      <Button
        variant="outline"
        size="sm"
        disabled={setup.isPending || policy.isFetching || info.isFetching}
        onClick={() => {
          void info.refetch();
          if (capability) void policy.refetch();
        }}
      >
        Refresh policy
      </Button>
    </section>
  );
}
