"use client";

import { Button } from "@/components/button";
import { MicroLabel } from "@/components/panel";
import { Segmented, type SegmentedOption } from "@/components/segmented";
import { DataRow, DataTable, EmptyState } from "@/components/table";
import { Numeric } from "@/components/value";
import { cn } from "@/lib/cn";
import { shortenAddress } from "@/lib/format";
import { PoolTransactionStatus, PoolTransactionType, type ListingDepositChainId } from "@symmio/trading-core";
import { usePoolTransactions, useWalletAccount } from "@symmio/trading-react";
import { useState } from "react";
import { CancelWithdrawAction } from "../cancel-withdraw-action";
import { LifecyclePill } from "../listing-chips";
import { depositChainLabel, listingAmount, listingDateTime, listingUsd } from "../listing-values";
import { TableFoot, TableStates, type TonedLabel } from "../pool-table-cells";
import { POOLS_CHAIN_ID, usePoolsSupported } from "../pools-deployment";

/**
 * The cash book: type, wallet, token amount, USD value, status, time — and a
 * cancel control on the connected wallet's own pending withdrawals.
 */
const POOL_TRANSACTION_COLUMNS =
  "minmax(116px,0.7fr) minmax(152px,1fr) minmax(140px,1fr) minmax(124px,0.9fr) minmax(116px,0.8fr) minmax(148px,1fr) minmax(92px,min-content)";

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

/**
 * Display for a transaction status, tolerating one the backend added later.
 *
 * Exported because the cross-pool ledger (`user-transfers-panel`) renders the
 * same five states from the other direction — one LP, every pool — and two
 * copies of a status palette drift the first time one of them gains a state.
 * Its natural long-term home is `listing-values.ts`, beside the market-status
 * twin `LISTING_STATUS_DISPLAY`; it lives here because this book is where a
 * transaction status first had to be drawn.
 */
export function transactionStatusDisplay(status: PoolTransactionStatus | string): TonedLabel {
  return TRANSACTION_STATUS_DISPLAY[status as PoolTransactionStatus] ?? { label: String(status), color: "var(--fg-3)" };
}

/** Which way the money moved. The arrow is the fastest read in the column. */
export const TRANSACTION_TYPE_LABELS: Record<PoolTransactionType, string> = {
  [PoolTransactionType.DEPOSIT]: "↓ Deposit",
  [PoolTransactionType.WITHDRAW]: "↑ Withdraw",
};

/** Whose rows the service is asked for: the pool's, or this wallet's. */
type TransferScope = "all" | "mine";

const SCOPE_OPTIONS: readonly SegmentedOption<TransferScope>[] = [
  { value: "all", label: "All actions" },
  { value: "mine", label: "Your actions" },
];

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
 *
 * ## Scope, and the caveat under it
 *
 * `getPoolTransactions` takes an optional `walletAddress`, which is what the
 * scope switch sends — server-side narrowing, not a filter over the page that
 * happened to load. The caveat is that the field it matches against is
 * documented as nothing more precise than "the wallet that made it", and this
 * flow is **custodial**: an LP funds a pool by sending tokens to a temporary
 * deposit wallet the service mints for them. The sibling endpoint's own row type
 * calls its wallet field "the temporary deposit wallet", so it is genuinely
 * unresolved whether a pool row's `wallet_address` is the LP's EOA or that
 * custodial address. If it is the latter, narrowing by the connected wallet
 * matches nothing at all — which is why the empty state for this scope says so
 * instead of reporting "you have no transfers here", and points at the authed
 * ledger, which needs no address to know whose rows are whose.
 *
 * ## Why a disconnected "yours" renders nothing at all
 *
 * With no wallet there is no filter to send, and `undefined` is byte for byte
 * the filter the pool-wide scope sends — so `getPoolTransactionsQueryOptions`
 * builds the **same** query key for both scopes. Disabling the read does not
 * save it: a disabled query still reports whatever is already cached under its
 * key, and the pool's whole ledger is sitting there from the other scope. So
 * this scope's rows are dropped at the render rather than left to `enabled`;
 * anything else prints every LP's money under the heading "your actions".
 */
export function PoolTransfersBook({ address, chainId, ticker }: PoolTransfersBookProps) {
  const supported = usePoolsSupported();
  const { address: connectedAddress } = useWalletAccount();

  const [scope, setScope] = useState<TransferScope>("all");

  /* With no wallet connected there is no "yours" to ask for, which makes the
     scope unanswerable rather than merely unfiltered — and, per the header
     block, its `undefined` filter shares a cache key with the pool-wide read.
     Both facts are named here because the second is what the rows below act on. */
  const walletFilter = scope === "mine" ? connectedAddress : undefined;
  const scopeIsUnanswerable = scope === "mine" && connectedAddress === undefined;

  /* Mounted only while its own tab is on screen, so the tab half of the gate is
     the mount itself. This is the one book keyed by the pool's token address
     rather than by a market, which is why it survives a pool with no symbolId.
     `placeholderData` keeps the rows up while the scope switch refetches, so
     flipping the control never blanks the table. */
  const transactions = usePoolTransactions({
    marketAddress: address,
    walletAddress: walletFilter,
    size: TRANSACTION_PAGE_SIZE,
    chainId: POOLS_CHAIN_ID,
    query: {
      enabled: supported && address.length > 0 && !scopeIsUnanswerable,
      placeholderData: (previous) => previous,
    },
  });

  /* Everything the table and the footnote read comes through this page, so an
     unanswerable scope forgets the cached pool-wide one in a single place. Left
     as `transactions.data`, the rows and the total would both be the other
     scope's answer wearing this scope's label. */
  const page = scopeIsUnanswerable ? undefined : transactions.data;

  const rows = page?.items ?? [];

  /* The backend's true total across every page, not this page's length — the
     footnote leans on the difference rather than implying the page is all of it. */
  const total = page?.count ?? 0;

  /* Case-insensitive because an EVM address round-trips through this backend in
     whatever case it was stored in, and a checksummed wallet compared byte for
     byte against a lowercased row silently owns none of its own withdrawals.
     A base58 Solana address is unaffected: it only ever matches itself. */
  const owner = connectedAddress?.toLowerCase();

  return (
    <>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line-subtle px-4 py-2.5">
        <Segmented<TransferScope> options={SCOPE_OPTIONS} value={scope} onChange={setScope} size="sm" />
        <p className="min-w-0 text-2xs text-fg-3">
          {scope === "all"
            ? "The pool’s whole ledger — every LP’s deposits and withdrawals."
            : scopeIsUnanswerable
              ? "There is no wallet to narrow to, so this scope lists nothing rather than the pool’s ledger."
              : "Narrowed by the service to the connected wallet, not filtered from the page above."}
        </p>
      </div>

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
            {/* The action column has no name: it holds one control on a handful
                of rows, and heading it "Cancel" would read as a column of them. */}
            <span />
          </>
        }
      >
        {/* The disconnected scope is its own state rather than one more string
            handed to `TableStates`: it is the one empty table that is not the
            service answering, and it is the only one with a way out that needs
            no wallet. Connecting is already the header's primary button, so the
            action here is the other exit rather than a second one of those. */}
        {scopeIsUnanswerable ? (
          <EmptyState
            title="Connect a wallet to see your own transfers"
            body="This scope asks the service for one wallet’s rows, and there is no wallet to ask about — so nothing is listed. Connect one from the header to read your own deposits and withdrawals, or switch back to the pool’s whole ledger. Note that deposits here are custodial: if the service records a row against the temporary deposit address it minted rather than against your wallet, this scope stays empty even once connected, and the authed transfers page is the reliable read."
            action={
              <Button variant="secondary" size="sm" onClick={() => setScope("all")}>
                Show the pool’s ledger
              </Button>
            }
          />
        ) : (
          <TableStates
            columns={POOL_TRANSACTION_COLUMNS}
            cells={7}
            isPending={transactions.isPending}
            error={transactions.error}
            isEmpty={rows.length === 0}
            book="this pool's transfers"
            emptyTitle={scope === "mine" ? "Nothing here under your wallet" : "No deposits or withdrawals"}
            emptyBody={
              scope === "mine"
                ? "Either you have not moved money through this pool, or the service does not record this ledger against your own address: deposits here are custodial, so the wallet on a row may be the temporary deposit address the pool minted rather than the wallet you connected. Your transfers page reads the authed endpoint, which identifies you by signature and needs no address at all."
                : "Nobody has put collateral into this pool or taken any out. Refunded deposits would be listed here too."
            }
          />
        )}

        {rows.map((row) => {
          /* Both halves matter: a settled withdrawal is no longer cancellable
             and the service rejects it, and a deposit was never in a queue. The
             third is ownership — the control only appears on a row this wallet
             can actually act on, whatever scope is showing it. */
          const isCancellable =
            row.type === PoolTransactionType.WITHDRAW &&
            row.status === PoolTransactionStatus.PENDING &&
            owner !== undefined &&
            row.walletAddress.toLowerCase() === owner;

          return (
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

              <div className="flex justify-end">
                {isCancellable ? <CancelWithdrawAction withdrawId={row.transactionId} /> : null}
              </div>
            </DataRow>
          );
        })}
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
        {scope === "all" ? "Every LP’s deposits and withdrawals, not just yours. " : null}
        Wallets are on {depositChainLabel(chainId)}, the chain the token lives on — not the chain the perp settles on. A
        pending withdrawal can be cancelled from here only when its wallet is the one you have connected; the service’s
        own word for whose wallet that is on a custodial deposit is not pinned down, so the control is absent rather
        than wrong when the two do not match.
      </TableFoot>
    </>
  );
}
