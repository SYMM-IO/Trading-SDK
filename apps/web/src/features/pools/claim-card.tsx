"use client";

import { ResultError, ResultNote, ResultSuccess } from "@/components/result";
import { useClaimProfit, useUserProfit } from "@symmio/trading-react";
import { Button } from "@symmio/ui/components/button";
import { Spinner } from "@symmio/ui/components/spinner";
import { useState } from "react";
import { isAddress } from "viem";
import { MethodCard } from "../inspector/method-card";
import { SubAccountField } from "../inspector/subaccount-field";
import { useSolverKindActive } from "../solvers/solver-target";
import { formatListingRewardAmount } from "./format-listing-value";
import { useListingAuth } from "./listing-auth-context";
import { usePoolScope } from "./pool-scope";

/**
 * Claim — move the signed-in user's accrued LP rewards from one pool to a
 * sub-account as USDC.
 *
 * The pool comes from the section's shared picker ({@link usePoolScope}), which
 * also carries the pool's `chainId` (its deposit chain). {@link useUserProfit}
 * reads the user's `claimableReward` — the whole claimable balance is claimed in
 * one shot, matching the listing service. The destination sub-account is chosen
 * through {@link SubAccountField} (the connected wallet's sub-accounts, by name),
 * so the user picks *which account* receives the USDC.
 *
 * The bearer token comes from the shared {@link useListingAuth} session, so the
 * user signs in **once** and this card reuses it. Enigma-only: the listing
 * backend lives on HyperEVM, so the card is gated on Enigma being the active
 * solver, mirroring the other Listing-session cards.
 */
export function ClaimCard() {
  const enigmaActive = useSolverKindActive("enigma");
  const { accessToken, signIn, isSigningIn } = useListingAuth();
  const { contractAddress: selectedContractAddress, market } = usePoolScope();

  const [accountAddress, setAccountAddress] = useState("");

  const profit = useUserProfit({
    accessToken: accessToken ?? "",
    tokenContractAddress: selectedContractAddress,
  });

  const claim = useClaimProfit();

  const signedIn = accessToken !== null;
  const depositChain = market?.chainId;
  const claimableReward = profit.data?.claimableReward ?? 0n;
  const claimableLabel = formatListingRewardAmount(claimableReward);

  const accountValid = isAddress(accountAddress);
  const formReady =
    selectedContractAddress.length > 0 && depositChain !== undefined && claimableReward > 0n && accountValid;
  const disabled = !enigmaActive || isSigningIn || claim.isPending || (signedIn && !formReady);

  function onSubmit() {
    if (!signedIn) {
      signIn();
      return;
    }
    if (accessToken === null || depositChain === undefined || !accountValid) return;
    claim.mutate(
      {
        accessToken,
        tokenContractAddress: selectedContractAddress,
        depositChain,
        accountAddress,
        amount: claimableReward,
      },
      {
        onSuccess: () => {
          void profit.refetch();
        },
      },
    );
  }

  const claimableHint = !signedIn
    ? "Sign in and pick a pool to see your claimable rewards."
    : selectedContractAddress.length === 0
      ? "Pick a pool above to see your claimable rewards."
      : profit.isPending
        ? "Loading your claimable rewards…"
        : `Claimable: ${claimableLabel} USDC`;

  return (
    <MethodCard
      testId="method-claimProfit"
      name="claimProfit"
      mutability="nonpayable"
      description="Claim — move your accrued LP rewards from one pool to a sub-account as USDC. Sign in once, pick a pool, choose which sub-account receives the USDC, and claim your full claimable balance. Enigma-only."
    >
      <div className="border-border/60 flex items-center justify-between gap-2 border-b pb-3">
        <span className="text-muted-foreground text-xs">Claimable rewards</span>
        <span className="font-mono text-sm" data-testid="claim-claimable">
          {claimableLabel} USDC
        </span>
      </div>

      <SubAccountField
        idPrefix="claim"
        label="account_address (receives USDC)"
        value={accountAddress}
        onValueChange={setAccountAddress}
        hint={claimableHint}
        invalid={accountAddress.length > 0 && !accountValid}
      />

      <Button type="button" size="sm" disabled={disabled} onClick={onSubmit} data-testid="claim-submit">
        {claim.isPending ? (
          <>
            <Spinner className="size-4" /> Claiming…
          </>
        ) : isSigningIn ? (
          <>
            <Spinner className="size-4" /> Signing in…
          </>
        ) : signedIn ? (
          "Claim"
        ) : (
          "Sign in first"
        )}
      </Button>

      {!enigmaActive ? (
        <ResultNote testId="claim-gate">Switch to Enigma (HyperEVM) to claim pool rewards.</ResultNote>
      ) : claim.error ? (
        <ResultError kind={claim.error.kind} message={claim.error.message} testId="claim-error" />
      ) : claim.isSuccess ? (
        <ResultSuccess testId="claim-success">
          <span className="text-foreground/80 text-xs">
            Claimed {formatListingRewardAmount(claim.data.amountClaimed)} USDC to the sub-account. Your claimable
            balance drops and claimed rises.
          </span>
        </ResultSuccess>
      ) : signedIn && selectedContractAddress.length > 0 && profit.error ? (
        <ResultError kind={profit.error.kind} message={profit.error.message} testId="claim-profit-error" />
      ) : (
        <ResultNote testId="claim-idle">
          {signedIn
            ? "Pick a pool above, choose which sub-account receives the USDC, and claim your full claimable balance."
            : "Sign in to claim pool rewards."}
        </ResultNote>
      )}
    </MethodCard>
  );
}
