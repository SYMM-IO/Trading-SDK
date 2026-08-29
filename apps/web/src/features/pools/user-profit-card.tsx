"use client";

import { ResultError, ResultNote } from "@/components/result";
import { Stat } from "@/components/stat";
import { useUserProfit } from "@symmio/trading-react";
import { MethodCard } from "../inspector/method-card";
import { useSolverKindActive } from "../solvers/solver-target";
import { formatListingAmount, formatListingRewardUsd, formatListingUsd } from "./format-listing-value";
import { useListingAuth } from "./listing-auth-context";
import { usePoolScope } from "./pool-scope";
import { SignInNote } from "./sign-in-note";

/**
 * "Your pool balance" — the signed-in user's LP position in one pool: their LP
 * balance valued in USDC and tokens, claimable and claimed rewards, deposited
 * token amount, LP shares, and the LP shares queued for withdrawal.
 *
 * Authed, per-pool read. The bearer token comes from the shared
 * {@link useListingAuth} session (sign in **once**, reused across every Listing
 * card), and the pool from the section's shared picker ({@link usePoolScope}).
 * `useUserProfit` gates itself on **both**, so it stays idle until the user has
 * signed in *and* picked a pool.
 *
 * Enigma-only: the listing backend lives on HyperEVM, so the card is gated on
 * Enigma being the active solver, mirroring the other Listing-session cards.
 */
export function UserProfitCard() {
  const enigmaActive = useSolverKindActive("enigma");
  const { accessToken } = useListingAuth();
  const { contractAddress } = usePoolScope();

  const profit = useUserProfit({
    accessToken: accessToken ?? "",
    tokenContractAddress: contractAddress,
  });
  console.log("data-Profit", profit.data);
  const signedIn = accessToken !== null;

  return (
    <MethodCard
      testId="method-getUserProfit"
      name="getUserProfit"
      mutability="view"
      description="Your pool balance — the signed-in user's LP position in one pool: balance in USDC and tokens, claimable and claimed rewards, deposit, LP shares, and pending withdrawal. Sign in once, pick a pool above. Enigma-only."
      wide
    >
      {!enigmaActive ? (
        <ResultNote testId="user-profit-gate">
          Switch to Enigma (HyperEVM) to sign in and read your pool balance.
        </ResultNote>
      ) : !signedIn ? (
        <SignInNote testId="user-profit-idle" buttonTestId="user-profit-sign-in">
          Sign in to read your LP position in a pool.
        </SignInNote>
      ) : contractAddress.length === 0 ? (
        <ResultNote testId="user-profit-no-address">Pick a pool above to read your position.</ResultNote>
      ) : profit.error ? (
        <ResultError kind={profit.error.kind} message={profit.error.message} testId="user-profit-error" />
      ) : profit.isPending || profit.data === undefined ? (
        <ResultNote testId="user-profit-loading" loading>
          Loading your pool balance…
        </ResultNote>
      ) : (
        <div className="flex flex-col gap-5" data-testid="user-profit">
          {/* Balance in USDC, claimable reward and pending withdrawal carry the weight:
              what the position is worth, what can be claimed now, and what is queued out. */}
          <div className="border-info/30 bg-info/5 grid grid-cols-1 gap-4 rounded-xl border p-4 @xl:grid-cols-3">
            <Stat
              label="Balance (USDC)"
              value={formatListingUsd(profit.data.userBalanceInUsdc)}
              hint="LP balance valued in USDC."
            />
            <Stat
              label="Claimable reward"
              value={formatListingRewardUsd(profit.data.claimableReward)}
              hint="Rewards you can claim now."
            />
            <Stat
              label="Pending withdrawal"
              value={formatListingAmount(profit.data.pendingWithdrawLpAmount)}
              hint="LP shares queued for withdrawal."
            />
          </div>

          <div className="grid grid-cols-2 gap-4 @2xl:grid-cols-4">
            <Stat
              size="sm"
              label="Balance (tokens)"
              value={formatListingAmount(profit.data.userBalanceInTokens)}
              testId="user-profit-balance-tokens"
            />
            <Stat
              size="sm"
              label="Claimed reward"
              value={formatListingUsd(profit.data.claimedReward)}
              testId="user-profit-claimed-reward"
            />
            <Stat
              size="sm"
              label="Deposited"
              value={formatListingAmount(profit.data.userDepositedTokenAmount)}
              testId="user-profit-deposited"
            />
            <Stat
              size="sm"
              label="LP shares"
              value={formatListingAmount(profit.data.userLpAmount)}
              testId="user-profit-lp-shares"
            />
          </div>
        </div>
      )}
    </MethodCard>
  );
}
