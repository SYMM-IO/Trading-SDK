"use client";

import { Button } from "@/components/button";
import { MicroLabel, Panel } from "@/components/panel";
import { ChainPill, Pill, SolverPill } from "@/components/pill";
import { EmptyState, Skeleton } from "@/components/table";
import { Numeric } from "@/components/value";
import { FAMILY_PALETTE, type Deployment } from "@/config/deployments";
import { accountEquity } from "@/features/accounts/account-math";
import type { FundingAccount } from "@/features/accounts/account-provider";
import { useChainGate } from "@/features/wallet/use-chain-gate";
import { formatUsd, fromWei } from "@/lib/format";
import { useState } from "react";
import { AccountRow } from "./account-row";
import { NewAccountModal } from "./new-account-modal";

export interface DeploymentGroupProps {
  deployment: Deployment;
  accounts: readonly FundingAccount[];
  isLoading: boolean;
  /** This deployment's account read failed — the other group still renders. */
  error?: Error;
  /** False when the palette mode has narrowed the header totals away from this group. */
  inScope: boolean;
}

/**
 * Every funding account that settles on one deployment, as a ledger.
 *
 * The group, not the account, is the unit that matters: a deposit, a transfer
 * and a withdrawal all stay inside it, because the two deployments are separate
 * chains talking to separate solvers. The family-coloured hairline and the
 * solver and chain pills sit in the header for that reason — they are the
 * boundary, not decoration. The wallet can only be on one of those chains at a
 * time, so the switch is offered once, here, rather than on every row.
 */
export function DeploymentGroup({ deployment, accounts, isLoading, error, inScope }: DeploymentGroupProps) {
  const [creating, setCreating] = useState(false);
  const gate = useChainGate(deployment);
  const palette = FAMILY_PALETTE[deployment.family];

  const equity = accounts.reduce((total, account) => total + fromWei(accountEquity(account)), 0);
  const showSkeleton = isLoading && accounts.length === 0;

  return (
    <Panel className="relative overflow-hidden">
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-[2px]"
        style={{ background: `linear-gradient(90deg, ${palette.base}, ${palette.border} 40%, transparent 80%)` }}
      />

      <header className="flex flex-wrap items-start gap-x-6 gap-y-3 border-b border-line-subtle px-4 pt-3.5 pb-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="flex flex-wrap items-center gap-2 font-display text-lg font-semibold tracking-[-0.02em] text-fg-0">
            {deployment.label}
            <SolverPill family={deployment.family} />
            <ChainPill family={deployment.family} />
            {inScope ? null : <Pill>Outside current mode</Pill>}
          </h2>
          <p className="max-w-[72ch] text-sm text-fg-3">{deployment.blurb}</p>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-2">
          <div className="flex flex-col items-end gap-0.5 pr-1">
            <MicroLabel>Group equity</MicroLabel>
            {showSkeleton ? (
              <Skeleton className="h-3.5 w-20" />
            ) : (
              <Numeric size="md" tone="strong">
                {formatUsd(equity, { exact: true })}
              </Numeric>
            )}
          </div>
          {gate.needsSwitch ? (
            <Button
              variant="ghost"
              size="sm"
              loading={gate.isSwitching}
              title={`Deposits, withdrawals and grants here need the wallet on ${deployment.chainName}`}
              onClick={() => void gate.switchToDeployment()}
            >
              {gate.isSwitching ? null : (
                <span
                  aria-hidden
                  className="size-[6px] shrink-0 rounded-full"
                  style={{ background: `var(${deployment.chainColorVar})` }}
                />
              )}
              Switch to {deployment.chainName}
            </Button>
          ) : null}
          <Button variant="secondary" size="sm" onClick={() => setCreating(true)}>
            New account
          </Button>
        </div>
      </header>

      {error ? (
        <div className="m-3.5 rounded-lg border border-[var(--warn-500)]/35 bg-warn-bg px-4 py-3">
          <p className="text-md font-semibold text-warn">
            {deployment.solverName} on {deployment.chainName} did not answer
          </p>
          <p className="mt-1 text-sm text-fg-2">{error.message}</p>
          <p className="mt-1 text-2xs text-fg-3">
            The other group is unaffected — each deployment is read independently.
          </p>
        </div>
      ) : showSkeleton ? (
        <div className="prism-ledger">
          <LedgerHead />
          <LedgerSkeletonRow />
          <LedgerSkeletonRow />
        </div>
      ) : accounts.length === 0 ? (
        <EmptyState
          title={`No ${deployment.family} account yet`}
          body={`Accounts on ${deployment.chainName} are created once and reused. Everything you fund here trades against ${deployment.solverName}.`}
          action={
            <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
              Create the first one
            </Button>
          }
        />
      ) : (
        <div className="prism-ledger">
          <LedgerHead />
          {accounts.map((account) => (
            <AccountRow key={account.address} account={account} />
          ))}
        </div>
      )}

      <NewAccountModal
        deployment={deployment}
        existingCount={accounts.length}
        template={accounts[0]?.detail}
        open={creating}
        onClose={() => setCreating(false)}
      />
    </Panel>
  );
}

/** Column heads. The same subgrid as the rows, so they sit over their figures at every width. */
function LedgerHead() {
  return (
    <div className="prism-ledger-row border-b border-line-subtle px-4 py-2">
      <MicroLabel>Account</MicroLabel>
      <MicroLabel>Equity</MicroLabel>
      <MicroLabel className="hidden lg:inline">Free margin</MicroLabel>
      <MicroLabel className="hidden lg:inline">In positions</MicroLabel>
      <MicroLabel className="hidden md:inline">Unrealized</MicroLabel>
      <MicroLabel className="hidden md:inline">Liq. buffer</MicroLabel>
      <MicroLabel>Trading access</MicroLabel>
      <span aria-hidden />
    </div>
  );
}

function LedgerSkeletonRow() {
  return (
    <div className="prism-ledger-row border-b border-line-subtle px-4 py-3 last:border-b-0">
      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-3.5 w-28" />
        <Skeleton className="h-2.5 w-20" />
      </div>
      <Skeleton className="h-3.5 w-16" />
      <div className="hidden lg:block">
        <Skeleton className="h-3.5 w-16" />
      </div>
      <div className="hidden lg:block">
        <Skeleton className="h-3.5 w-16" />
      </div>
      <div className="hidden md:block">
        <Skeleton className="h-3.5 w-16" />
      </div>
      <div className="hidden md:block">
        <Skeleton className="h-[5px] w-full" />
      </div>
      <Skeleton className="h-5 w-20 rounded-full" />
      <Skeleton className="h-5 w-36" />
    </div>
  );
}
