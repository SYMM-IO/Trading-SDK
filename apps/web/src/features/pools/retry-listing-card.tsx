"use client";

import { ResultError, ResultNote, ResultSuccess } from "@/components/result";
import { ListingDepositChainId, ListingMarketStatus } from "@symmio/trading-core";
import { useRetryListing, useRetryListingInfo } from "@symmio/trading-react";
import { Button } from "@symmio/ui/components/button";
import { Spinner } from "@symmio/ui/components/spinner";
import { MethodCard } from "../inspector/method-card";
import { useSolverKindActive } from "../solvers/solver-target";
import { useListingAuth } from "./listing-auth-context";
import { usePoolScope } from "./pool-scope";

/**
 * Retry listing — re-submit a **rejected** market's listing instead of refunding
 * it.
 *
 * Operates on the market picked in the section's shared picker
 * ({@link usePoolScope}); it is only meaningful when that market's `marketStatus`
 * is `REJECTED`. {@link useRetryListingInfo} reads the retry allowance (remaining
 * retries and cooldown) and gates the button; {@link useRetryListing} POSTs the
 * retry and invalidates the retry info and the user's pools view.
 *
 * The bearer token comes from the shared {@link useListingAuth} session, so the
 * user signs in **once**. Enigma-only, mirroring the other Listing-session cards.
 */
export function RetryListingCard() {
  const enigmaActive = useSolverKindActive("enigma");
  const { accessToken, signIn, isSigningIn } = useListingAuth();
  const { contractAddress: selectedContractAddress, market } = usePoolScope();

  const signedIn = accessToken !== null;
  const depositChain = market?.chainId;
  const isRejected = market?.marketStatus === ListingMarketStatus.REJECTED;
  const canRead = signedIn && selectedContractAddress.length > 0 && isRejected && depositChain !== undefined;

  const info = useRetryListingInfo({
    accessToken: accessToken ?? "",
    tokenContractAddress: selectedContractAddress,
    depositChain: depositChain ?? ListingDepositChainId.HYPER_EVM,
    query: { enabled: canRead },
  });

  const retry = useRetryListing();

  const remaining = info.data?.remainingRetries ?? 0;
  const cooldown = info.data?.remainingCooldownSeconds ?? null;
  const cooldownElapsed = cooldown === null || cooldown === 0;
  const formReady = canRead && remaining > 0 && cooldownElapsed;
  const disabled = !enigmaActive || isSigningIn || retry.isPending || (signedIn && !formReady);

  function onSubmit() {
    if (!signedIn) {
      signIn();
      return;
    }
    if (accessToken === null || depositChain === undefined) return;
    retry.mutate({ accessToken, tokenContractAddress: selectedContractAddress, depositChain });
  }

  const allowanceLabel = info.data
    ? `${remaining}/${info.data.retryLimit} retries left${cooldown && cooldown > 0 ? ` · cooldown ${cooldown}s` : ""}`
    : "—";

  return (
    <MethodCard
      testId="method-retryListing"
      name="retryListing"
      mutability="nonpayable"
      description="Retry listing — re-submit a rejected market instead of refunding it. Sign in once, pick a rejected pool above. Retries are capped and rate-limited. Enigma-only."
    >
      <div className="border-border/60 flex items-center justify-between gap-2 border-b pb-3">
        <span className="text-muted-foreground text-xs">Retry allowance</span>
        <span className="font-mono text-sm" data-testid="retry-allowance">
          {allowanceLabel}
        </span>
      </div>

      <Button type="button" size="sm" disabled={disabled} onClick={onSubmit} data-testid="retry-submit">
        {retry.isPending ? (
          <>
            <Spinner className="size-4" /> Retrying…
          </>
        ) : isSigningIn ? (
          <>
            <Spinner className="size-4" /> Signing in…
          </>
        ) : signedIn ? (
          "Retry listing"
        ) : (
          "Sign in first"
        )}
      </Button>

      {!enigmaActive ? (
        <ResultNote testId="retry-gate">Switch to Enigma (HyperEVM) to retry a rejected market.</ResultNote>
      ) : retry.error ? (
        <ResultError kind={retry.error.kind} message={retry.error.message} testId="retry-error" />
      ) : retry.isSuccess ? (
        <ResultSuccess testId="retry-success">
          <span className="text-foreground/80 text-xs">
            Retry submitted. {retry.data.remainingRetries} of {retry.data.retryLimit} retries left.
          </span>
        </ResultSuccess>
      ) : canRead && info.error ? (
        <ResultError kind={info.error.kind} message={info.error.message} testId="retry-info-error" />
      ) : signedIn && selectedContractAddress.length > 0 && !isRejected ? (
        <ResultNote testId="retry-not-rejected">Retry applies only to a rejected market. This one is not.</ResultNote>
      ) : (
        <ResultNote testId="retry-idle">
          {signedIn
            ? "Pick a rejected pool above to see its retry allowance."
            : "Sign in to retry a rejected market's listing."}
        </ResultNote>
      )}
    </MethodCard>
  );
}
