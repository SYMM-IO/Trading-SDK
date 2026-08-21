"use client";

import { MicroLabel } from "@/components/panel";
import { Pill, SolverPill } from "@/components/pill";
import { DataRow, DataTable, EmptyState, SkeletonRows } from "@/components/table";
import { Numeric } from "@/components/value";
import { FAMILY_PALETTE, type Deployment, type MarketFamily } from "@/config/deployments";
import { useDeploymentQueries } from "@/features/data/use-deployment-queries";
import { formatRelativeTime, formatUsd, fromWei, shortenAddress } from "@/lib/format";
import {
  BalanceChangeType,
  BalanceHistoryFilter,
  getBalanceHistoryQueryOptions,
  getChainConfig,
  getTransferHistoryQueryOptions,
  type BalanceHistoryRow,
  type GetBalanceHistoryReturnType,
  type GetTransferHistoryReturnType,
  type TransferRow,
} from "@symmio/trading-core";
import { useMemo } from "react";
import type { Address, Hex } from "viem";
import { AccountCell } from "./account-cell";
import { ActivityGate } from "./activity-gate";
import type { DeploymentReadState, TransferKindFilter } from "./activity-types";
import { DeploymentNotices } from "./subgraph-notice";
import type { ActivityAccountsResult } from "./use-activity-accounts";

const COLUMNS =
  "minmax(104px,0.7fr) minmax(104px,0.8fr) minmax(132px,0.9fr) minmax(104px,0.8fr) minmax(150px,1.1fr) minmax(112px,0.8fr) minmax(84px,0.6fr)";

/** Rows per read, per deployment. */
const PAGE_SIZE = 100;

/** How a single collateral movement reads to a user. */
type LedgerKind = "deposit" | "withdraw" | "margin-out" | "margin-in";

const KIND_LABELS: Record<LedgerKind, string> = {
  deposit: "↓ Deposit",
  withdraw: "↑ Withdraw",
  "margin-out": "→ Margin out",
  "margin-in": "← Margin in",
};

/** One merged ledger row, whichever subgraph collection it came from. */
interface LedgerRow {
  key: string;
  kind: LedgerKind;
  /** Signed display amount in collateral units — positive into the account. */
  amount: number;
  timestamp: number;
  transaction: Hex;
  /** Counterparty for a margin move; the sub-account itself for a deposit or withdrawal. */
  endpoint: Address;
  /** The user's own sub-account this movement belongs to. */
  account: Address;
  deployment: Deployment;
  family: MarketFamily;
}

export interface TransfersTabProps {
  accounts: ActivityAccountsResult;
  kind: TransferKindFilter;
}

/**
 * Collateral in and out of the sub-accounts, merged across deployments.
 *
 * Two different subgraph collections feed this: real deposits and withdrawals
 * come from the analytics `balanceChanges` (`useBalanceHistory`, whose
 * `useDepositHistory` / `useWithdrawHistory` wrappers are just the pinned
 * filters used below), while margin moved between a user's own SubAccount and
 * its Virtual Accounts comes from the events subgraph `internalTransfers`
 * (`useTransferHistory`). They also disagree on scale — balance rows are in the
 * collateral token's decimals, transfer rows are always 18 — so both are
 * normalized before they can share a column.
 *
 * Both hooks read one chain at a time, so the same query-options factories they
 * wrap are fanned out over the deployments here instead.
 */
export function TransfersTab({ accounts, kind }: TransfersTabProps) {
  const wantsBalances = kind !== "internal";
  const wantsTransfers = kind === "all" || kind === "internal";

  const balances = useDeploymentQueries<GetBalanceHistoryReturnType>(
    (config, deployment) =>
      getBalanceHistoryQueryOptions(config, {
        chainId: deployment.chainId,
        accounts: accounts.addressesFor(deployment.family),
        filter: BALANCE_FILTERS[kind],
        first: PAGE_SIZE,
      }),
    { enabled: wantsBalances },
  );

  const transfers = useDeploymentQueries<GetTransferHistoryReturnType>(
    (config, deployment) =>
      getTransferHistoryQueryOptions(config, {
        chainId: deployment.chainId,
        accounts: accounts.addressesFor(deployment.family),
        direction: "all",
        first: PAGE_SIZE,
      }),
    { enabled: wantsTransfers },
  );

  const rows = useMemo(() => {
    const merged: LedgerRow[] = [];

    if (wantsBalances) {
      for (const result of balances.results) {
        const decimals = getChainConfig(result.deployment.chainId).addresses.collateralDecimals;
        for (const row of result.data?.rows ?? []) {
          merged.push(toBalanceLedgerRow(row, decimals, result.deployment));
        }
      }
    }

    if (wantsTransfers) {
      for (const result of transfers.results) {
        for (const row of result.data?.rows ?? []) {
          merged.push(toTransferLedgerRow(row, result.deployment));
        }
      }
    }

    return merged.sort((a, b) => b.timestamp - a.timestamp);
  }, [balances.results, transfers.results, wantsBalances, wantsTransfers]);

  const balanceStates = useReadStates(accounts, balances.results, wantsBalances);
  const transferStates = useReadStates(accounts, transfers.results, wantsTransfers);
  const isLoading = (wantsBalances && balances.isLoading) || (wantsTransfers && transfers.isLoading);

  return (
    <ActivityGate accounts={accounts} columns={COLUMNS} cells={7}>
      <DeploymentNotices states={balanceStates} source="analytics" label="deposit / withdraw history" />
      <DeploymentNotices states={transferStates} source="events" label="internal transfers" />

      <DataTable
        columns={COLUMNS}
        head={
          <>
            <MicroLabel>Solver</MicroLabel>
            <MicroLabel>Account</MicroLabel>
            <MicroLabel>Movement</MicroLabel>
            <MicroLabel>Amount</MicroLabel>
            <MicroLabel>Counterparty</MicroLabel>
            <MicroLabel>Tx</MicroLabel>
            <MicroLabel>When</MicroLabel>
          </>
        }
      >
        {isLoading && rows.length === 0 ? <SkeletonRows columns={COLUMNS} cells={7} rows={5} /> : null}

        {rows.map((row) => (
          <DataRow key={row.key} columns={COLUMNS} accent={FAMILY_PALETTE[row.family].base}>
            <SolverPill family={row.family} />
            <AccountCell name={accounts.nameFor(row.account)} address={row.account} />
            <Pill>{KIND_LABELS[row.kind]}</Pill>
            <Numeric size="sm" tone="strong">
              {formatUsd(row.amount, { exact: true, signed: true })}
            </Numeric>
            <span className="tnum truncate text-sm text-fg-2">{shortenAddress(row.endpoint, 8, 6)}</span>
            <span className="tnum truncate text-sm text-fg-3">{shortenAddress(row.transaction, 8, 4)}</span>
            <Numeric size="sm" tone="muted">
              {formatRelativeTime(row.timestamp)}
            </Numeric>
          </DataRow>
        ))}
      </DataTable>

      {!isLoading && rows.length === 0 ? (
        <EmptyState
          title="No collateral movement"
          body="Deposits, withdrawals and margin moved between a sub-account and its virtual accounts all land here."
        />
      ) : null}
    </ActivityGate>
  );
}

/** Server-side filter per tab state. `internal` skips the balance read entirely. */
const BALANCE_FILTERS: Record<TransferKindFilter, BalanceHistoryFilter> = {
  all: BalanceHistoryFilter.All,
  deposit: BalanceHistoryFilter.Deposit,
  withdraw: BalanceHistoryFilter.Withdraw,
  internal: BalanceHistoryFilter.All,
};

/** A deposit/withdraw row, scaled out of collateral decimals and signed by direction. */
function toBalanceLedgerRow(row: BalanceHistoryRow, decimals: number, deployment: Deployment): LedgerRow {
  const deposit = row.type === BalanceChangeType.Deposit;
  const magnitude = fromWei(row.amount, decimals);

  return {
    key: `${deployment.family}:balance:${row.id}`,
    kind: deposit ? "deposit" : "withdraw",
    amount: deposit ? magnitude : -magnitude,
    timestamp: row.timestamp,
    transaction: row.transaction,
    endpoint: row.account,
    account: row.account,
    deployment,
    family: deployment.family,
  };
}

/** An internal margin move. Always 18-decimal, regardless of the collateral token. */
function toTransferLedgerRow(row: TransferRow, deployment: Deployment): LedgerRow {
  const incoming = row.direction === "incoming";
  const magnitude = fromWei(row.amount);

  return {
    key: `${deployment.family}:transfer:${row.id}`,
    kind: incoming ? "margin-in" : "margin-out",
    amount: incoming ? magnitude : -magnitude,
    timestamp: row.timestamp,
    transaction: row.transaction,
    endpoint: incoming ? row.from : row.to,
    /* Direction is resolved relative to the queried accounts, so the leg that
       is *not* the endpoint is always one of the user's own sub-accounts. */
    account: incoming ? row.to : row.from,
    deployment,
    family: deployment.family,
  };
}

/**
 * Collapse a fan-out into one read state per in-scope deployment.
 *
 * The fan-out follows the palette mode, which can be wider than the screen's
 * solver filter, so deployments the user filtered out are dropped rather than
 * reported as silent.
 */
function useReadStates<T extends { rows: unknown[] }>(
  accounts: ActivityAccountsResult,
  results: readonly { deployment: Deployment; data?: T; isLoading: boolean; error: Error | null }[],
  enabled: boolean,
): readonly DeploymentReadState[] {
  return useMemo(() => {
    if (!enabled) return [];

    return accounts.deployments.map((deployment) => {
      const result = results.find((entry) => entry.deployment.family === deployment.family);
      const attempted = accounts.addressesFor(deployment.family).length > 0;

      return {
        deployment,
        isLoading: attempted && (result?.isLoading ?? false),
        error: attempted ? (result?.error ?? null) : null,
        rowCount: result?.data?.rows.length ?? 0,
        attempted,
      };
    });
  }, [accounts, results, enabled]);
}
