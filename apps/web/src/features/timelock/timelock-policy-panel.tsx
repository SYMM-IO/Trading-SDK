"use client";

import { DataList, DataRow } from "@/components/data-list";
import { ResultError, ResultNote, ResultSuccess } from "@/components/result";
import { TxReceipt } from "@/components/tx-result";
import { useFlowWriteOption, useGaslessWriteOption } from "@/features/gasless/gasless-write-mode-store";
import {
  useProtectedFunctionCatalog,
  useSetupTimelockPolicy,
  useSubAccount,
  useWalletAccount,
} from "@symmio/trading-react";
import { Button } from "@symmio/ui/components/button";
import { Card, CardContent } from "@symmio/ui/components/card";
import Link from "next/link";
import { isAddressEqual, toFunctionSelector } from "viem";
import type { TimelockContext } from "./use-timelock-context";

/** Owner-confirmed setup via SDK defaults; on-chain readiness never pretends to prove solver indexing. */
export function TimelockPolicyPanel({ context, compact = false }: { context: TimelockContext; compact?: boolean }) {
  const { policy, info, capability, chainId, solverId } = context;
  const catalog = useProtectedFunctionCatalog();
  const wallet = useWalletAccount();
  const root = useSubAccount({ account: policy.data?.rootAccount, chainId });
  const setup = useSetupTimelockPolicy();
  const write = useGaslessWriteOption("setupTimelocks");
  const flowWrite = useFlowWriteOption("setupTimelocks");
  const selectorFunctions = new Map(
    catalog.map((item) => [
      toFunctionSelector({
        type: "function",
        name: item.name,
        inputs: item.inputs,
        outputs: [],
        stateMutability: "nonpayable",
      }).toLowerCase(),
      item,
    ]),
  );
  const owner = root.data?.owner;
  const canWrite = Boolean(
    wallet.isOnExpectedChain &&
    wallet.chainId === chainId &&
    wallet.address &&
    owner &&
    isAddressEqual(wallet.address, owner),
  );
  const error = (context.capability ? undefined : info.error) ?? policy.error ?? setup.error;

  if (context.unsupported)
    return (
      <section className="border-border/70 flex flex-col gap-4 rounded-xl border p-4" data-testid="timelock-policy">
        <h3 className="text-sm font-medium">Trading protection</h3>
        <DataList>
          <DataRow label="Scope" value={`${catalog.length} selectors`} />
        </DataList>
        <ResultNote>
          This solver does not advertise timelock approvals. You can still{" "}
          <Link
            className="underline"
            href={
              context.account
                ? `/contracts/timelock?account=${encodeURIComponent(context.account)}`
                : "/contracts/timelock"
            }
          >
            configure protection directly in Contracts
          </Link>{" "}
          if needed.
        </ResultNote>
      </section>
    );

  return (
    <section className="border-border/70 flex flex-col gap-4 rounded-xl border p-4" data-testid="timelock-policy">
      <h3 className="text-sm font-medium">Trading protection</h3>
      {error ? <ResultError kind={error.code ?? error.kind} message={error.message} /> : null}
      {!capability || !policy.data ? (
        <>
          {compact ? (
            <DataList>
              <DataRow label="Scope" value={`${catalog.length} selectors`} />
            </DataList>
          ) : null}
          <ResultNote loading={!error}>Reading deployment and root policy…</ResultNote>
        </>
      ) : (
        <>
          {compact ? (
            <>
              <ResultNote>Configure trading protection for the root account before continuing.</ResultNote>
              <DataList>
                <DataRow label="Root account" value={policy.data.rootAccount} />
                <DataRow label="Scope" value={`${policy.data.selectors.length} selectors`} />
                <DataRow label="Minimum cooldown" value={`${policy.data.requiredDelay} seconds`} />
                <DataRow
                  label="Status"
                  value={`${policy.data.selectors.filter((item) => item.status === "ok").length} / ${policy.data.selectors.length} configured`}
                />
              </DataList>
            </>
          ) : (
            <>
              <DataList>
                <DataRow label="Root account" value={policy.data.rootAccount} />
                <DataRow label="Minimum cooldown" value={`${policy.data.requiredDelay} seconds`} />
                <DataRow label="Unlocker" value={capability.unlocker} />
                <DataRow
                  label="Approval validity"
                  value={`${capability.validitySeconds} seconds (not an HTTP timeout)`}
                />
              </DataList>
              <details>
                <summary className="cursor-pointer text-sm">
                  {policy.data.selectors.filter((item) => item.status === "ok").length} / {policy.data.selectors.length}{" "}
                  selectors configured
                </summary>
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {policy.data.selectors.map((item) => {
                    const fn = selectorFunctions.get(item.selector.toLowerCase());
                    return (
                      <li key={item.selector}>
                        <Card size="sm" className="h-full py-3 shadow-none" data-testid="policy-selector-card">
                          <CardContent className="space-y-1">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-mono text-xs font-medium">{fn?.name ?? "Unknown function"}</span>
                              <span className="text-muted-foreground text-xs">{fn?.target ?? "Unknown target"}</span>
                            </div>
                            <div className="text-muted-foreground font-mono text-xs">{item.selector}</div>
                            <div className="text-muted-foreground text-xs">
                              {item.status} · {item.delay.toString()}s
                            </div>
                          </CardContent>
                        </Card>
                      </li>
                    );
                  })}
                </ul>
              </details>
            </>
          )}
          {!policy.data.ready ? (
            <Button
              disabled={!canWrite || setup.isPending || Boolean(setup.error && setup.error.kind !== "user-rejected")}
              onClick={() => {
                if (!policy.data || !canWrite) return;
                setup.mutate({
                  account: policy.data.rootAccount,
                  chainId,
                  solverId,
                  from: wallet.address,
                  ...(compact ? flowWrite : write),
                });
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
        </>
      )}
      <ResultNote>The solver may take time to recognize changes confirmed on chain.</ResultNote>
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
