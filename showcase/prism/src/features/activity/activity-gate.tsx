"use client";

import { EmptyState, SkeletonRows } from "@/components/table";
import type { ReactNode } from "react";
import type { ActivityAccountsResult } from "./use-activity-accounts";

export interface ActivityGateProps {
  accounts: ActivityAccountsResult;
  /** The table's column template, so the loading skeleton matches its shape. */
  columns: string;
  cells: number;
  children: ReactNode;
}

/**
 * The three states every Activity tab shares before it has anything to read.
 *
 * All four tabs key off the same sub-accounts, so no wallet, no accounts yet,
 * and no accounts at all are answered once here rather than four times — and
 * always with a skeleton in the table's own shape, never a spinner.
 */
export function ActivityGate({ accounts, columns, cells, children }: ActivityGateProps) {
  if (!accounts.isConnected) {
    return (
      <EmptyState
        title="Connect a wallet"
        body="Activity is read per sub-account. Connect to see the merged history and event stream across both deployments."
      />
    );
  }

  if (accounts.isLoading && accounts.accounts.length === 0) {
    return <SkeletonRows columns={columns} cells={cells} rows={5} />;
  }

  if (accounts.accounts.length === 0) {
    return (
      <EmptyState
        title="No funding accounts in scope"
        body="This wallet holds no SYMMIO sub-account on the selected deployments. Create one from Portfolio, or widen the solver filter."
      />
    );
  }

  return <>{children}</>;
}
