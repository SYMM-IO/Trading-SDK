"use client";

import { Field } from "@/components/field";
import { ResultError, ResultNote } from "@/components/result";
import { Stat } from "@/components/stat";
import { useUserProfit } from "@symmio/trading-react";
import { Button } from "@symmio/ui/components/button";
import { Spinner } from "@symmio/ui/components/spinner";
import { useState } from "react";
import { MethodCard } from "../inspector/method-card";
import { useSolverKindActive } from "../solvers/solver-target";
import { formatListingAmount, formatListingUsd } from "./format-listing-value";
import { useListingAuth } from "./listing-auth-context";
import { PoolSelect } from "./pool-select";

/**
 * "Your pool balance" — the signed-in user's LP position in one pool: their LP
 * balance valued in USDC and tokens, claimable and claimed rewards, deposited
 * token amount, LP shares, and the LP shares queued for withdrawal.
 *
 * Authed, per-pool read. The bearer token comes from the shared
 * {@link useListingAuth} session (sign in **once**, reused across every Listing
 * card), and a market picker — the paged, server-searched {@link PoolSelect} —
 * names the pool. `useUserProfit` gates itself on **both**, so it stays idle until the
 * user has signed in *and* picked a pool. The picker itself only needs the
 * Enigma listing catalog, so it stays interactive before sign-in.
 *
 * Enigma-only: the listing backend lives on HyperEVM, so the card is gated on
 * Enigma being the active solver, mirroring the other Listing-session cards.
 */
export function UserProfitCard() {
  const enigmaActive = useSolverKindActive("enigma");
  const { accessToken, signIn, isSigningIn } = useListingAuth();

  const [selectedContractAddress, setSelectedContractAddress] = useState("");

  const profit = useUserProfit({
    accessToken: accessToken ?? "",
    tokenContractAddress: selectedContractAddress,
  });

  const signedIn = accessToken !== null;

  return (
    <MethodCard
      testId="method-getUserProfit"
      name="getUserProfit"
      mutability="view"
      description="Your pool balance — the signed-in user's LP position in one pool: balance in USDC and tokens, claimable and claimed rewards, deposit, LP shares, and pending withdrawal. Sign in once, pick a pool from the catalog. Enigma-only."
      wide
    >
      <Field label="pool" htmlFor="user-profit-market">
        <PoolSelect
          idPrefix="user-profit-market"
          value={selectedContractAddress}
          onValueChange={setSelectedContractAddress}
          enabled={enigmaActive}
        />
      </Field>

      {!enigmaActive ? (
        <ResultNote testId="user-profit-gate">
          Switch to Enigma (HyperEVM) to sign in and read your pool balance.
        </ResultNote>
      ) : !signedIn ? (
        <div className="flex flex-col gap-3">
          <Button
            type="button"
            size="sm"
            disabled={isSigningIn}
            onClick={() => signIn()}
            data-testid="user-profit-sign-in"
          >
            {isSigningIn ? (
              <>
                <Spinner className="size-4" /> Signing in…
              </>
            ) : (
              "Sign in first"
            )}
          </Button>
          <ResultNote testId="user-profit-idle">Sign in to read your LP position in a pool.</ResultNote>
        </div>
      ) : selectedContractAddress.length === 0 ? (
        <ResultNote testId="user-profit-no-address">Select a pool to read your position.</ResultNote>
      ) : profit.error ? (
        <ResultError kind={profit.error.kind} message={profit.error.message} testId="user-profit-error" />
      ) : profit.isPending || profit.data === undefined ? (
        <ResultNote testId="user-profit-loading" loading>
          Loading your pool balance…
        </ResultNote>
      ) : (
        <div className="flex flex-col gap-6" data-testid="user-profit">
          {/* Balance in USDC, claimable reward and pending withdrawal carry the weight:
              what the position is worth, what can be claimed now, and what is queued out. */}
          <div className="border-info/30 bg-info/5 grid grid-cols-1 gap-4 rounded-xl border p-4 sm:grid-cols-3">
            <Stat
              label="Balance (USDC)"
              value={formatListingUsd(profit.data.userBalanceInUsdc)}
              hint="LP balance valued in USDC."
            />
            <Stat
              label="Claimable reward"
              value={formatListingUsd(profit.data.claimableReward)}
              hint="Rewards you can claim now."
            />
            <Stat
              label="Pending withdrawal"
              value={formatListingAmount(profit.data.pendingWithdrawLpAmount)}
              hint="LP shares queued for withdrawal."
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col gap-1" data-testid="user-profit-balance-tokens">
              <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Balance (tokens)
              </span>
              <span className="text-foreground font-mono text-lg tabular-nums">
                {formatListingAmount(profit.data.userBalanceInTokens)}
              </span>
            </div>
            <div className="flex flex-col gap-1" data-testid="user-profit-claimed-reward">
              <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Claimed reward</span>
              <span className="text-foreground font-mono text-lg tabular-nums">
                {formatListingUsd(profit.data.claimedReward)}
              </span>
            </div>
            <div className="flex flex-col gap-1" data-testid="user-profit-deposited">
              <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Deposited</span>
              <span className="text-foreground font-mono text-lg tabular-nums">
                {formatListingAmount(profit.data.userDepositedTokenAmount)}
              </span>
            </div>
            <div className="flex flex-col gap-1" data-testid="user-profit-lp-shares">
              <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">LP shares</span>
              <span className="text-foreground font-mono text-lg tabular-nums">
                {formatListingAmount(profit.data.userLpAmount)}
              </span>
            </div>
          </div>
        </div>
      )}
    </MethodCard>
  );
}
