"use client";

import { Button } from "@/components/button";
import { Combobox, type ComboboxOption } from "@/components/combobox";
import { CopyAction, DetailRow, DetailSection } from "@/components/detail-list";
import { Field } from "@/components/field";
import { Modal } from "@/components/modal";
import { MicroLabel } from "@/components/panel";
import { EmptyState, Skeleton } from "@/components/table";
import { Numeric, ReceiptRow } from "@/components/value";
import { useFundingAccounts } from "@/features/accounts/account-provider";
import { parseAmount, toAmountInput } from "@/features/portfolio/amount";
import { useWriteToast } from "@/features/portfolio/use-write-toast";
import { shortenAddress } from "@/lib/format";
import { LISTING_VALUE_DECIMALS, type ListingDepositChainId } from "@symmio/trading-core";
import { useClaimProfit, useListingConfig } from "@symmio/trading-react";
import { useEffect, useMemo, useState } from "react";
import { WarnGlyph } from "./listing-chips";
import { useListingSession } from "./listing-session";
import { ListingSignIn } from "./listing-sign-in";
import { ABSENT, depositChainColor, depositChainLabel, listingReward, listingRewardAmount } from "./listing-values";
import { POOLS_CHAIN_ID, POOLS_DEPLOYMENT, usePoolsSupported } from "./pools-deployment";

export interface ClaimRewardsModalProps {
  open: boolean;
  onClose: () => void;
  /**
   * The pool being claimed from.
   *
   * Passed in rather than read here because every figure in it is already on
   * screen behind the button that opens this sheet — re-reading `useUserProfit`
   * inside the modal would fork the claimable balance the reader just looked at
   * from the one the submit sends.
   */
  pool: {
    /** The pool's token contract address — `0x…` on an EVM chain, base58 on Solana. */
    tokenContractAddress: string;
    /**
     * The chain the pool's **token** lives on, which routes the USDC payout.
     *
     * This is the pool's own `chainId` from the catalog row or the market
     * detail, never the chain the listing backend is addressed on — those are
     * different chains and only one of them is a valid `depositChain`.
     */
    depositChain: ListingDepositChainId;
    /** The pool's ticker, for naming which pool the sheet is claiming from. */
    tokenTicker?: string;
    /**
     * Claimable USDC at 18 decimals, from `useUserProfit`.
     *
     * `undefined` means the position read has not answered — which is not a
     * ceiling of zero and must never be presented as one.
     */
    claimableReward?: bigint;
  };
}

/**
 * Claim a pool's accrued LP rewards as USDC into a sub-account.
 *
 * This is a REST call authorised by the listing session's bearer token, not a
 * wallet transaction — nothing is signed and nothing is broadcast, so there is
 * no chain gate here. The only rung in the Pools surface that needs the wallet
 * on the pools chain is the SIWE sign-in, and it has been climbed by the time
 * this sheet can open.
 *
 * Unlike the withdrawal next to it, a claim is **synchronous**: a `200` means
 * the USDC has already moved, and the service answers with a receipt carrying
 * the amount, the claim id and — when it has one — the transfer hash. So the
 * sheet ends on that receipt rather than on a "queued" toast, and the position
 * behind it reloads off the mutation's own invalidation.
 *
 * ## Why the destination is a picker and not the trade account
 *
 * The reward lands in a SYMMIO sub-account, and Prism already resolves every
 * one the wallet owns through `useFundingAccounts` — which fans out with scope
 * `"all"`, so lowcap sub-accounts are loaded even while the palette is on
 * Majors and this sheet costs no extra request. What it deliberately does *not*
 * do is call `select()`: that mutates the app's shared trading-account
 * selection, so picking where a claim should land would silently retarget the
 * account the reader's next trade opens against. The choice is held locally
 * instead, and it is forgotten when the sheet closes.
 */
export function ClaimRewardsModal({ open, onClose, pool }: ClaimRewardsModalProps) {
  const supported = usePoolsSupported();
  const session = useListingSession();
  const runWrite = useWriteToast();
  const claim = useClaimProfit({});
  const { byFamily, isLoading: isAccountsLoading } = useFundingAccounts();

  /* How many claims this pool allows per rolling day, so the footer can name the
     number the service will actually enforce instead of alluding to one. It is a
     service-wide policy read off the chain-level config, not a property of the
     pool passed in — which is why it needs a read at all. Gated on `open` as
     well as `supported`: the portfolio table mounts this sheet only for the pool
     it is claiming from, but gating on `open` keeps a sheet that was opened and
     closed from re-reading a policy that changes on no schedule. */
  const listingConfig = useListingConfig({ chainId: POOLS_CHAIN_ID, query: { enabled: supported && open } });
  const claimsPerDay = listingConfig.data?.rateLimits.profitClaimsPerDay;

  /* Lowcaps only. A pool settles on the lowcaps deployment, and a claim paid to
     a sub-account on the majors chain would name an address the listing service
     has no route to. */
  const accounts = byFamily.lowcaps;

  const [destinationOverride, setDestinationOverride] = useState<string | null>(null);
  const [inputOverride, setInputOverride] = useState<string | null>(null);

  /* Both fields hold `null` for "still following its source" rather than an
     empty string for "not filled in". Seeding either from a real string would
     need an effect, and that effect overwrites what the reader typed the moment
     its source resolves — the account list after hydration, the claimable
     balance after the position read lands. */
  const destination = destinationOverride ?? accounts[0]?.address ?? "";

  const claimable = pool.claimableReward;

  /* The service takes the amount at 18 decimals with no rescaling, and
     `claimableReward` is already on that scale — so the field's own decimals
     are the wire's, and the parsed bigint is submitted exactly as typed. */
  const input = inputOverride ?? (claimable === undefined ? "" : toAmountInput(claimable, LISTING_VALUE_DECIMALS));
  const amount = parseAmount(input, LISTING_VALUE_DECIMALS);
  const overCeiling = amount !== undefined && claimable !== undefined && amount > claimable;

  const receipt = claim.data;

  /* Re-opening starts a new claim. Without this the previous receipt stays on
     screen while a second pool's claimable balance is typed underneath it — one
     transfer hash, two pools, and no way to tell which it settled. */
  const { reset } = claim;
  useEffect(() => {
    if (!open) return;
    setDestinationOverride(null);
    setInputOverride(null);
    reset();
  }, [open, reset]);

  const accountOptions = useMemo<ComboboxOption<string>[]>(
    () =>
      accounts.map((account) => ({
        value: account.address,
        label: account.name,
        hint: shortenAddress(account.address),
        /* The address is searchable but not the row's name: a reader pasting one
           in to confirm the destination is checking, not browsing. */
        keywords: account.address,
      })),
    [accounts],
  );

  const destinationAccount = accounts.find((account) => account.address === destination);
  const hasAccounts = accounts.length > 0;

  const canSubmit =
    supported &&
    session.isSignedIn &&
    hasAccounts &&
    destination.length > 0 &&
    amount !== undefined &&
    amount > 0n &&
    claimable !== undefined &&
    !overCeiling &&
    !claim.isPending;

  const onSubmit = () => {
    if (!canSubmit || amount === undefined) return;
    void runWrite(
      {
        pending: "Claiming rewards…",
        success: "Rewards claimed",
        body: "The USDC is in the sub-account. Your claimable balance drops and claimed rises.",
        failure: "Rewards not claimed",
      },
      async () => {
        await claim.mutateAsync({
          accessToken: session.accessToken,
          tokenContractAddress: pool.tokenContractAddress,
          /* The pool's own chain, handed down from the row that opened this
             sheet. It is what routes the payout, and it is not the chain the
             listing backend is addressed on — passing `chainId` here instead
             pays out on the wrong network. */
          depositChain: pool.depositChain,
          accountAddress: destination,
          amount,
          /* Named explicitly: the mutation would otherwise default to the
             connected chain, and the listing backend only exists on this one. */
          chainId: POOLS_CHAIN_ID,
        });
        /* Nothing is refetched here. `useClaimProfit` invalidates `getUserProfit`
           and `getClaimHistory` itself, so the position behind this sheet and
           the claim history below it reload without being told. */
      },
    );
  };

  const footnote =
    claimable === undefined
      ? "Your position for this pool has not loaded, so there is no ceiling to check an amount against and the claim stays closed until it does."
      : claimable === 0n
        ? "This pool owes you nothing yet. Rewards accrue against the LP shares you hold, so the figure moves as the pool trades."
        : overCeiling
          ? "More than this pool owes you. The service rejects an over-claim outright rather than paying out what it can."
          : "Paid as USDC into the sub-account above. The claim settles while you wait — the service answers with a receipt, not a queue position.";

  return (
    <Modal
      open={open}
      onClose={onClose}
      width="wide"
      eyebrow={pool.tokenTicker ? `${pool.tokenTicker} pool` : "Listing service"}
      title="Claim rewards"
      footer={
        !supported ? null : receipt ? (
          <Button variant="secondary" size="lg" className="w-full" onClick={onClose}>
            Close
          </Button>
        ) : !session.isSignedIn ? (
          <>
            <div className="flex justify-center">
              <ListingSignIn label="Sign in to claim" />
            </div>
            <p className="text-center text-2xs text-fg-3">
              The listing service is custodial REST, not a contract — it pays out over a signed session, never off a
              transaction.
            </p>
          </>
        ) : (
          <>
            <Button
              variant="primary"
              size="lg"
              className="w-full"
              loading={claim.isPending}
              disabled={!canSubmit}
              onClick={onSubmit}
            >
              Claim rewards
            </Button>
            {/* The cap belongs to the listing service and is counted per pool,
                not per chain and not per wallet. The number is only written once
                the config read answers — a sentence that stays grammatical
                without it is better than a placeholder that renders as a
                literal "undefined" in the one place the reader is deciding
                whether to spend an allowance. */}
            <p className="text-center text-2xs text-fg-3">
              {claimsPerDay === undefined ? (
                <>
                  This spends one of the claims this pool allows per rolling 24 hours. The service enforces the cap and
                  answers <span className="tnum">429</span> past it.
                </>
              ) : (
                <>
                  This spends one of the <span className="tnum">{claimsPerDay}</span> claims this pool allows per
                  rolling 24 hours. The service enforces the cap and answers <span className="tnum">429</span> past it.
                </>
              )}
            </p>
          </>
        )
      }
    >
      {!supported ? (
        <EmptyState
          title={`No listing service on ${POOLS_DEPLOYMENT.chainName}`}
          body="Rewards are paid by a chain-level backend, and this chain carries no listing block in the SDK's registry. There is nothing to claim from."
        />
      ) : !session.isSignedIn ? (
        <p className="text-md text-fg-2">
          A claim moves your money, so the service answers only for the wallet that signed. One signature opens the
          session that reads your claimable balance and pays it out.
        </p>
      ) : receipt ? (
        <ClaimReceipt
          amountClaimed={receipt.amountClaimed}
          claimRequestId={receipt.claimRequestId}
          transactionHash={receipt.transactionHash}
          destination={destination}
          destinationName={destinationAccount?.name}
        />
      ) : isAccountsLoading && !hasAccounts ? (
        <Skeleton className="h-[76px] w-full" />
      ) : !hasAccounts ? (
        <EmptyState
          title="No sub-account to pay into"
          body={`A claim credits a SYMMIO sub-account, and this wallet owns none on ${POOLS_DEPLOYMENT.chainName}. Open one from the portfolio screen, then come back — the rewards keep accruing in the meantime.`}
        />
      ) : (
        <>
          <div className="rounded-md border border-line bg-bg-2 px-3 py-1.5">
            <ReceiptRow
              label="Claimable"
              emphasis
              value={
                <span className="flex items-baseline gap-1.5">
                  <Numeric size="md" tone={claimable !== undefined && claimable > 0n ? "long" : "muted"}>
                    {listingReward(claimable)}
                  </Numeric>
                  <span className="text-2xs text-fg-3">USDC</span>
                </span>
              }
            />
          </div>

          {claim.error ? (
            <div className="flex items-start gap-2.5 rounded-md border border-[var(--short-500)]/35 bg-short-bg px-3 py-2.5">
              <WarnGlyph className="mt-0.5 size-3.5 shrink-0 text-short" />
              <p className="min-w-0 text-sm leading-relaxed text-fg-2">{claim.error.message}</p>
            </div>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <MicroLabel>Pay into</MicroLabel>
            <Combobox
              label="Destination sub-account"
              className="w-full"
              value={destination}
              onChange={setDestinationOverride}
              options={accountOptions}
              searchable={accountOptions.length > 6}
              placeholder="Choose a sub-account"
              disabled={claim.isPending}
              emptyText="No sub-accounts on this deployment"
            />
            <span className="px-1 text-2xs text-fg-3">
              Your own sub-accounts on {POOLS_DEPLOYMENT.chainName}. Choosing one here pays this claim into it and
              nothing else — it does not change which account the trade ticket opens against.
            </span>
          </div>

          <Field
            label="Amount"
            inputMode="decimal"
            placeholder="0.00"
            value={input}
            invalid={overCeiling}
            disabled={claim.isPending}
            onChange={(event) => setInputOverride(event.target.value)}
            adornment={<span className="font-mono text-sm text-fg-2">USDC</span>}
            hint={
              claimable === undefined ? (
                <span className="text-warn">CLAIMABLE UNKNOWN</span>
              ) : (
                <>
                  CLAIMABLE{" "}
                  <Numeric size="sm" tone="muted">
                    {listingRewardAmount(claimable)}
                  </Numeric>
                </>
              )
            }
            footnote={footnote}
          />

          <DetailSection title="Payout route">
            <DetailRow
              label="Pool token chain"
              tip={{
                title: "Deposit chain",
                body: "The chain this pool's token lives on. It routes the payout, and it is not the chain the perp settles on — those are two different networks and only this one is a valid claim destination.",
              }}
              value={
                <span className="flex items-center gap-1.5 text-sm text-fg-1">
                  <span
                    aria-hidden
                    className="size-[6px] shrink-0 rounded-full"
                    style={{ background: depositChainColor(pool.depositChain) }}
                  />
                  {depositChainLabel(pool.depositChain)}
                </span>
              }
            />
            <DetailRow
              label="Sub-account"
              value={
                <span className="tnum text-sm text-fg-1">
                  {destination ? shortenAddress(destination, 6, 6) : ABSENT}
                </span>
              }
              sub={destinationAccount?.name}
              action={destination ? <CopyAction value={destination} label="Sub-account address" /> : undefined}
            />
          </DetailSection>
        </>
      )}
    </Modal>
  );
}

interface ClaimReceiptProps {
  /** What the service says it moved, 18-dec USD. Comparable to `claimableReward`. */
  amountClaimed: bigint;
  claimRequestId: string;
  /** `null` while the service has no on-chain hash for the transfer yet. */
  transactionHash: string | null;
  destination: string;
  destinationName?: string;
}

/**
 * What the service actually paid.
 *
 * The amount is read back off the receipt rather than echoed from the form: the
 * service is the authority on what left the pool, and a claim that was trimmed
 * server-side would otherwise be reported at the figure that was asked for.
 *
 * A missing transfer hash is a normal answer, not a failure — the USDC has
 * moved either way, and the row says which of the two states it is in rather
 * than printing a dash that reads as "nothing happened".
 */
function ClaimReceipt({
  amountClaimed,
  claimRequestId,
  transactionHash,
  destination,
  destinationName,
}: ClaimReceiptProps) {
  return (
    <>
      <div className="flex flex-col gap-1 rounded-md border border-line bg-bg-2 px-3 py-3">
        <MicroLabel>Claimed</MicroLabel>
        <span className="flex items-baseline gap-1.5">
          <Numeric size="2xl" tone="long">
            {listingReward(amountClaimed)}
          </Numeric>
          <span className="text-2xs text-fg-3">USDC</span>
        </span>
        <p className="text-2xs text-fg-3">
          Already moved. The claim is synchronous, so this is a settlement rather than a request.
        </p>
      </div>

      <DetailSection title="Receipt" note="From the listing service">
        <DetailRow
          label="Paid into"
          value={<span className="tnum text-sm text-fg-1">{shortenAddress(destination, 6, 6)}</span>}
          sub={destinationName}
          action={<CopyAction value={destination} label="Sub-account address" />}
        />
        <DetailRow
          label="Claim id"
          value={<span className="tnum truncate text-sm text-fg-1">{shortenAddress(claimRequestId, 8, 6)}</span>}
          action={<CopyAction value={claimRequestId} label="Claim id" />}
        />
        <DetailRow
          label="Transfer"
          sub={transactionHash ? undefined : "the service has not recorded one"}
          value={
            transactionHash ? (
              <span className="tnum text-sm text-fg-1">{shortenAddress(transactionHash, 8, 6)}</span>
            ) : (
              <span className="text-sm text-fg-3">{ABSENT}</span>
            )
          }
          action={transactionHash ? <CopyAction value={transactionHash} label="Transaction hash" /> : undefined}
        />
      </DetailSection>
    </>
  );
}
