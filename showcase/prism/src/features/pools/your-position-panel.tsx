"use client";

import { Button } from "@/components/button";
import { CopyAction, DetailRow, DetailSection } from "@/components/detail-list";
import { Panel, PanelHeader } from "@/components/panel";
import { Pill } from "@/components/pill";
import { EmptyState } from "@/components/table";
import { Numeric } from "@/components/value";
import { shortenAddress } from "@/lib/format";
import type { ListingDepositChainId } from "@symmio/trading-core";
import { useDepositAddress, useUserProfit } from "@symmio/trading-react";
import Link from "next/link";
import { useState } from "react";
import { ClaimRewardsModal } from "./claim-rewards-modal";
import { ListingStatusPill, WarnGlyph } from "./listing-chips";
import { useListingSession } from "./listing-session";
import { ListingSignInPrompt } from "./listing-sign-in";
import {
  ABSENT,
  depositChainColor,
  depositChainLabel,
  listingAmount,
  listingReward,
  listingUsd,
} from "./listing-values";
import { POOLS_CHAIN_ID, POOLS_DEPLOYMENT, usePoolsSupported } from "./pools-deployment";
import { WithdrawLpForm } from "./withdraw-lp-form";

export interface YourPositionPanelProps {
  /** The pool's token contract address — `0x…` on an EVM chain, base58 on Solana. */
  address: string;
  /** The pool's deposit chain, which is where its token lives, not where the perp settles. */
  chainId: ListingDepositChainId;
  /** The pool's ticker, used as the unit on token-denominated rows. */
  ticker?: string;
}

/**
 * The LP's own side of one pool: what they hold, where to send more, how to leave.
 *
 * Everything here is authed. The catalog, the charts and the trade tables on
 * this page are public reads addressed by the pool's token address; these three
 * blocks are the same listing backend answering only for the wallet that signed
 * in, which is why the whole panel collapses to a sign-in prompt rather than to
 * an empty table.
 */
export function YourPositionPanel({ address, chainId, ticker }: YourPositionPanelProps) {
  const supported = usePoolsSupported();
  const session = useListingSession();

  const enabled = supported && session.isSignedIn;

  /* Every field comes back as an 18-decimal bigint with an absent figure
     normalized to `0n` — the opposite of the catalog, where `null` means "not
     reported" and has to render as a dash. A zero in this panel is a real
     answer: this wallet holds none of it. */
  const profit = useUserProfit({
    accessToken: session.accessToken,
    tokenContractAddress: address,
    chainId: POOLS_CHAIN_ID,
    query: { enabled },
  });

  /* Get-or-create, not a read: the first call provisions a custodial wallet for
     this wallet and this pool. Browsing a pool page must not do that, so unlike
     every other read here it waits to be asked — `requestedFor` is the pool the
     reader actually pressed the button on, which also re-arms the gate when the
     rail moves to a different pool. */
  const [requestedFor, setRequestedFor] = useState<string | null>(null);
  const depositRequested = requestedFor === address;

  const [claimOpen, setClaimOpen] = useState(false);

  const deposit = useDepositAddress({
    accessToken: session.accessToken,
    tokenContractAddress: address,
    depositChain: chainId,
    chainId: POOLS_CHAIN_ID,
    query: { enabled: enabled && depositRequested },
  });

  if (!supported) {
    return (
      <Panel>
        <PanelHeader title="Your position" />
        <EmptyState
          title="No listing backend on this chain"
          body={`${POOLS_DEPLOYMENT.chainName} carries no listing block in the SDK's chain registry, so there is no LP position to read.`}
        />
      </Panel>
    );
  }

  if (!session.isSignedIn) {
    return (
      <Panel>
        <PanelHeader title="Your position" />
        <ListingSignInPrompt>
          Your balance in this pool, its deposit address and the withdrawal form all sit behind one signature — the
          listing backend answers “yours” only for the wallet that asked.
        </ListingSignInPrompt>
      </Panel>
    );
  }

  const position = profit.data;
  const isLoading = profit.isPending;
  const depositAddress = deposit.data?.depositAddress ?? null;
  const marketStatus = deposit.data?.marketStatus;
  const unit = ticker ?? "tokens";

  return (
    <Panel>
      <PanelHeader
        title="Your position"
        actions={
          <Button variant="ghost" size="sm" onClick={session.signOut}>
            Sign out
          </Button>
        }
      />

      <div className="flex flex-col gap-4 p-4">
        <DetailSection title="Balance" note={ticker}>
          <DetailRow
            label="Value"
            value={
              <Numeric size="md" tone="strong">
                {listingUsd(position?.userBalanceInUsdc, { exact: true })}
              </Numeric>
            }
            sub={withUnit(position?.userBalanceInTokens, unit)}
            isLoading={isLoading}
          />
          <DetailRow
            label="Deposited"
            value={<Numeric size="sm">{withUnit(position?.userDepositedTokenAmount, unit)}</Numeric>}
            isLoading={isLoading}
          />
          <DetailRow
            label="LP shares"
            value={<Numeric size="sm">{withUnit(position?.userLpAmount, "LP")}</Numeric>}
            isLoading={isLoading}
          />
          <DetailRow
            label="Queued for withdrawal"
            tip={{
              title: "Pending withdrawal",
              body: "Shares you have already asked to withdraw. They still belong to you and still show in the LP total, but they are spoken for until the backend settles the request. Queueing is not final: while a request is still pending it can be cancelled from your transfers ledger, which puts its shares straight back into the available balance. Once the backend has settled it there is nothing left to cancel.",
            }}
            value={
              <Numeric size="sm" tone={position && position.pendingWithdrawLpAmount > 0n ? "warn" : "muted"}>
                {withUnit(position?.pendingWithdrawLpAmount, "LP")}
              </Numeric>
            }
            /* A signpost, not the control itself. Cancelling takes a
               `withdrawId` — the `transactionId` of a row whose type is
               `WITHDRAW` and whose status is still `PENDING` — and this panel
               has no such id to hand it: `useUserProfit` reports one aggregate
               LP figure, however many separate queued requests summed to it.
               The transfers ledger is where those rows exist, so
               `CancelWithdrawAction` lives there and this row points at it.

               Rendered only against a non-zero queue, unlike the Claim button
               below which stays dead at zero. Claiming is something this panel
               does, so its control is part of the panel's shape whatever the
               balance; this is a link out to another surface, and a link to a
               ledger with nothing of yours in it is noise. */
            action={
              position && position.pendingWithdrawLpAmount > 0n ? (
                <Link
                  href="/pools/portfolio/transfers"
                  className="inline-flex h-7 cursor-pointer items-center justify-center rounded-sm border border-line bg-bg-2 px-2.5 text-sm font-semibold whitespace-nowrap text-fg-0 transition-all duration-[var(--dur-fast)] ease-[var(--ease-out)] hover:border-line-strong hover:bg-bg-3"
                >
                  Manage
                </Link>
              ) : undefined
            }
            isLoading={isLoading}
          />
          <DetailRow
            label="Available to withdraw"
            tip={{
              title: "Available LP",
              body: "LP shares minus the shares already queued, floored at zero. The SDK derives this — the service does not return it — and it is the ceiling the form below may request; the service rejects anything above it.",
            }}
            value={<Numeric size="sm">{withUnit(position?.availableLpAmount, "LP")}</Numeric>}
            isLoading={isLoading}
          />
          {/* `listingReward`, not `listingUsd`: rewards are routinely sub-cent,
              and two decimals renders a real claimable as `$0.00` — which reads
              as "nothing to claim" beside a button whose mutation would then
              send the full 18-decimal amount. */}
          <DetailRow
            label="Claimable rewards"
            value={
              <Numeric size="sm" tone={position && position.claimableReward > 0n ? "long" : "muted"}>
                {listingReward(position?.claimableReward)}
              </Numeric>
            }
            /* Dead at zero rather than hidden: the row is part of the panel's
               shape whatever the balance is, and a control that appears only
               once a figure moves is one a reader never learns is there. */
            action={
              <Button
                variant="secondary"
                size="sm"
                disabled={!position || position.claimableReward === 0n}
                onClick={() => setClaimOpen(true)}
              >
                Claim
              </Button>
            }
            isLoading={isLoading}
          />
          {/* `listingReward` here too, and for the same reason: `claimedReward`
              is the running total of the field above it, in the same
              18-decimal reward denomination — not a general money figure that
              happens to sit nearby. Two decimals would print a real lifetime
              claim as `$0.00` directly under a claimable of `$0.0042`, which
              reads as the Claim button having done nothing. */}
          <DetailRow
            label="Claimed to date"
            value={
              <Numeric size="sm" tone="muted">
                {listingReward(position?.claimedReward)}
              </Numeric>
            }
            isLoading={isLoading}
          />
        </DetailSection>

        {profit.error ? <p className="px-1 text-2xs text-short">{profit.error.message}</p> : null}

        {/* Zeros are data here, not an empty table — so the "what would fill
            this" line goes under them rather than replacing them. */}
        {position && position.userLpAmount === 0n ? (
          <p className="px-1 text-2xs text-fg-3">
            No LP shares yet. Send the pool’s token to the deposit address below and the backend credits them.
          </p>
        ) : null}

        <DetailSection
          title="Deposit address"
          note={
            <Pill dot color={depositChainColor(chainId)}>
              {depositChainLabel(chainId)}
            </Pill>
          }
        >
          {/* Before it is asked for there is nothing to lay out as a row: a
              label with a button in its value column squeezes both. The ask and
              the reason it is an ask get the full width instead. */}
          {!depositRequested ? (
            <div className="flex flex-col items-start gap-1.5 py-1">
              <Button variant="secondary" size="sm" onClick={() => setRequestedFor(address)}>
                Get deposit address
              </Button>
              <p className="text-2xs text-fg-3">
                Asking provisions a custodial wallet for this pool, so it waits for you rather than firing on a page
                view.
              </p>
            </div>
          ) : (
            <>
              <DetailRow
                label="Send to"
                value={
                  depositAddress ? (
                    <span className="tnum font-mono text-sm text-fg-0">{shortenAddress(depositAddress, 8, 6)}</span>
                  ) : deposit.error ? (
                    <span className="text-sm text-warn">Could not be read</span>
                  ) : (
                    <span className="text-sm text-fg-3">Not provisioned</span>
                  )
                }
                action={depositAddress ? <CopyAction value={depositAddress} label="Deposit address" /> : undefined}
                isLoading={deposit.isPending}
              />
              <DetailRow
                label="Pool status"
                value={
                  marketStatus ? (
                    <ListingStatusPill status={marketStatus} dot />
                  ) : (
                    <span className="text-sm text-fg-3">{ABSENT}</span>
                  )
                }
                isLoading={deposit.isPending}
              />
            </>
          )}
        </DetailSection>

        {deposit.error ? <p className="px-1 text-2xs text-short">{deposit.error.message}</p> : null}

        {/* Only alongside an address the service actually returned. Instructions
            for sending funds must never appear next to an address that failed
            to load — the reader would follow them with whatever is on screen. */}
        {depositAddress ? (
          <div className="flex items-start gap-2.5 rounded-md border border-[var(--warn-500)]/35 bg-warn-bg px-3 py-2.5">
            <WarnGlyph />
            <p className="text-2xs leading-relaxed text-fg-1">
              This address takes <span className="text-fg-0">{unit === "tokens" ? "this pool's token" : unit}</span> on{" "}
              <span className="text-fg-0">{depositChainLabel(chainId)}</span> and nothing else. There is no memo and no
              amount field — the address is the whole instruction. A different token, or the right token on a different
              chain, lands in a custodial wallet this app cannot address, and nothing here recovers it.
            </p>
          </div>
        ) : null}

        <WithdrawLpForm
          marketAddress={address}
          /* Never `?? 0n`: a failed position read would then tell an LP their
             available balance is zero, which is a different claim from "not
             known" and the one that stops them withdrawing. */
          availableLpAmount={position?.availableLpAmount}
          isPositionLoading={isLoading}
        />
      </div>

      {/* Portalled out of this panel by `Modal`, so it can live at the end of
          the rail rather than beside the row that opens it. The claimable
          balance is handed down rather than re-read: the sheet must submit the
          same figure the reader just saw here, not a second answer to the same
          question. */}
      <ClaimRewardsModal
        open={claimOpen}
        onClose={() => setClaimOpen(false)}
        pool={{
          tokenContractAddress: address,
          depositChain: chainId,
          tokenTicker: ticker,
          claimableReward: position?.claimableReward,
        }}
      />
    </Panel>
  );
}

/**
 * A listing count with the unit it counts.
 *
 * A bare `1.2K` in this panel is ambiguous between LP shares and pool tokens,
 * and those are different numbers with different ceilings — only one of them is
 * what the withdrawal form takes.
 */
function withUnit(value: bigint | undefined, unit: string): string {
  const body = listingAmount(value);
  return body === ABSENT ? body : `${body} ${unit}`;
}
