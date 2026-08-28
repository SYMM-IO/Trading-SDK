"use client";

import { MicroLabel } from "@/components/panel";
import { DataRow, DataTable } from "@/components/table";
import { Numeric } from "@/components/value";
import { cn } from "@/lib/cn";
import { shortenAddress } from "@/lib/format";
import { PoolTransactionStatus, PoolTransactionType, type ListingDepositChainId } from "@symmio/trading-core";
import { usePoolTransactions } from "@symmio/trading-react";
import { LifecyclePill } from "../listing-chips";
import { depositChainLabel, listingAmount, listingDateTime, listingUsd } from "../listing-values";
import { TableFoot, TableStates, type TonedLabel } from "../pool-table-cells";
import { POOLS_CHAIN_ID, usePoolsSupported } from "../pools-deployment";

/** The cash book: type, wallet, token amount, USD value, status, time. */
const POOL_TRANSACTION_COLUMNS =
  "minmax(116px,0.7fr) minmax(152px,1fr) minmax(140px,1fr) minmax(124px,0.9fr) minmax(116px,0.8fr) minmax(148px,1fr)";

/** Rows per transaction read. `count` still reports the true total behind it. */
const TRANSACTION_PAGE_SIZE = 100;

/**
 * How a deposit or withdrawal's lifecycle reads.
 *
 * A refund is not a failure and a cancellation is not a rejection, so neither
 * gets the red that `rejected` earns — money that came back is a closed loop,
 * and coloring it like a fault would misreport a routine outcome.
 */
const TRANSACTION_STATUS_DISPLAY: Record<PoolTransactionStatus, TonedLabel> = {
  [PoolTransactionStatus.SUCCESS]: { label: "Success", color: "var(--state-opened)" },
  [PoolTransactionStatus.PENDING]: { label: "Pending", color: "var(--state-pending)" },
  [PoolTransactionStatus.REJECTED]: { label: "Rejected", color: "var(--state-liquidated)" },
  [PoolTransactionStatus.REFUND]: { label: "Refunded", color: "var(--state-canceled)" },
  [PoolTransactionStatus.CANCELED]: { label: "Canceled", color: "var(--state-canceled)" },
};

/** Display for a transaction status, tolerating one the backend added later. */
function transactionStatusDisplay(status: PoolTransactionStatus | string): TonedLabel {
  return TRANSACTION_STATUS_DISPLAY[status as PoolTransactionStatus] ?? { label: String(status), color: "var(--fg-3)" };
}

/** Which way the money moved. The arrow is the fastest read in the column. */
const TRANSACTION_TYPE_LABELS: Record<PoolTransactionType, string> = {
  [PoolTransactionType.DEPOSIT]: "↓ Deposit",
  [PoolTransactionType.WITHDRAW]: "↑ Withdraw",
};

interface AddressCellProps {
  address?: string | null;
  /** Leading characters kept. A base58 Solana wallet reads better with more. */
  lead?: number;
  /** Trailing characters kept. */
  tail?: number;
  className?: string;
}

/**
 * A bare address cell.
 *
 * Monospace because these are compared character by character, and truncating
 * rather than wrapping because a wrapped address in a grid row pushes the whole
 * row's baseline out of line with its neighbours.
 */
function AddressCell({ address, lead = 6, tail = 4, className }: AddressCellProps) {
  return (
    <span title={address ?? undefined} className={cn("tnum truncate text-sm text-fg-2", className)}>
      {shortenAddress(address, lead, tail)}
    </span>
  );
}

export interface PoolTransfersBookProps {
  /** The pool's token contract address — base58 on Solana, `0x…` elsewhere. */
  address: string;
  /** The token's own deposit chain, which is not the chain the perp settles on. */
  chainId: ListingDepositChainId;
  /** The pool token's ticker, printed after a token amount. */
  ticker?: string;
}

/**
 * Money into and out of the pool, from every LP.
 *
 * The one book that survives a pool having no solver market — a deposit is real
 * from the moment the listing is created, long before anything can trade against
 * it. Wallets here are on the token's own deposit chain, so a Solana pool's
 * addresses are base58 rather than `0x…`.
 */
export function PoolTransfersBook({ address, chainId, ticker }: PoolTransfersBookProps) {
  const supported = usePoolsSupported();

  /* Mounted only while its own tab is on screen, so the tab half of the gate is
     the mount itself. This is the one book keyed by the pool's token address
     rather than by a market, which is why it survives a pool with no symbolId. */
  const transactions = usePoolTransactions({
    marketAddress: address,
    size: TRANSACTION_PAGE_SIZE,
    chainId: POOLS_CHAIN_ID,
    query: { enabled: supported && address.length > 0 },
  });

  const rows = transactions.data?.items ?? [];

  /* The backend's true total across every page, not this page's length — the
     footnote leans on the difference rather than implying the page is all of it. */
  const total = transactions.data?.count ?? 0;

  return (
    <>
      <DataTable
        columns={POOL_TRANSACTION_COLUMNS}
        head={
          <>
            <MicroLabel>Type</MicroLabel>
            <MicroLabel>Wallet</MicroLabel>
            <MicroLabel className="text-right">Token amount</MicroLabel>
            <MicroLabel className="text-right">USD value</MicroLabel>
            <MicroLabel>Status</MicroLabel>
            <MicroLabel className="text-right">When</MicroLabel>
          </>
        }
      >
        <TableStates
          columns={POOL_TRANSACTION_COLUMNS}
          cells={6}
          isPending={transactions.isPending}
          error={transactions.error}
          isEmpty={rows.length === 0}
          book="this pool's transfers"
          emptyTitle="No deposits or withdrawals"
          emptyBody="Nobody has put collateral into this pool or taken any out. Refunded deposits would be listed here too."
        />

        {rows.map((row) => (
          <DataRow key={row.transactionId} columns={POOL_TRANSACTION_COLUMNS}>
            <span className="text-sm text-fg-1">{TRANSACTION_TYPE_LABELS[row.type]}</span>

            <AddressCell address={row.walletAddress} lead={8} tail={6} />

            <div className="truncate text-right">
              <Numeric size="sm" tone="strong">
                {listingAmount(row.tokenAmount)}
              </Numeric>
              {ticker ? <span className="ml-1 text-2xs text-fg-3">{ticker}</span> : null}
            </div>

            <div className="text-right">
              <Numeric size="sm">{listingUsd(row.usdcAmount, { exact: true })}</Numeric>
            </div>

            <LifecyclePill {...transactionStatusDisplay(row.status)} />

            <div className="text-right">
              <Numeric size="sm" tone="muted">
                {listingDateTime(row.time)}
              </Numeric>
            </div>
          </DataRow>
        ))}
      </DataTable>

      <TableFoot>
        {rows.length > 0 ? (
          <>
            Showing <span className="tnum text-fg-2">{rows.length.toLocaleString("en-US")}</span> of{" "}
            <span className="tnum text-fg-2">{total.toLocaleString("en-US")}</span>{" "}
            {total === 1 ? "transfer" : "transfers"} — the backend pages this endpoint and reports the true total, so
            the rest exist even though only the newest {TRANSACTION_PAGE_SIZE} are read here.{" "}
          </>
        ) : null}
        Every LP’s deposits and withdrawals, not just yours. Wallets are on {depositChainLabel(chainId)}, the chain the
        token lives on — not the chain the perp settles on.
      </TableFoot>
    </>
  );
}
