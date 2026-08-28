"use client";

import { ResultError, ResultNote } from "@/components/result";
import { ListingDepositChainId } from "@symmio/trading-core";
import { useDepositAddress } from "@symmio/trading-react";
import { Badge } from "@symmio/ui/components/badge";
import { CopyButton } from "@symmio/ui/components/copy-button";
import { MethodCard } from "../inspector/method-card";
import { useSolverKindActive } from "../solvers/solver-target";
import { LISTING_STATUS_DISPLAY, truncateContractAddress } from "./format-listing-value";
import { useListingAuth } from "./listing-auth-context";
import { usePoolScope } from "./pool-scope";
import { SignInNote } from "./sign-in-note";

/**
 * "Deposit address" — get (or create) the signed-in user's deposit wallet for
 * one market, the address to send funds to in order to seed it.
 *
 * The market comes from the section's shared picker ({@link usePoolScope});
 * its `{ contractAddress, chainId }` pair is what `useDepositAddress` reads the
 * wallet for. Both the bearer token (from the shared {@link useListingAuth}
 * session) and a selected market gate the read, so it stays idle until the user
 * has signed in *and* picked a market.
 *
 * Enigma-only: the listing backend lives on HyperEVM, so the card is gated on
 * Enigma being the active solver, mirroring the other Listing-session cards.
 */
export function DepositAddressCard() {
  const enigmaActive = useSolverKindActive("enigma");
  const { accessToken } = useListingAuth();
  const { contractAddress, market: selectedMarket } = usePoolScope();

  // Idle until signed in AND a market is selected — the empty defaults keep the
  // hook mounted but inert (`enabled: false`) before either lands.
  const deposit = useDepositAddress({
    accessToken: accessToken ?? "",
    tokenContractAddress: contractAddress,
    depositChain: selectedMarket?.chainId ?? ListingDepositChainId.HYPER_EVM,
  });

  const signedIn = accessToken !== null;
  const statusDisplay = deposit.data ? LISTING_STATUS_DISPLAY[deposit.data.marketStatus] : undefined;

  return (
    <MethodCard
      testId="method-getDepositAddress"
      name="getDepositAddress"
      mutability="view"
      description="Deposit address — get (or create) the signed-in user's deposit wallet for one market. Sign in once, pick a market, then send funds to the address to deposit into it. Enigma-only."
    >
      {!enigmaActive ? (
        <ResultNote testId="deposit-address-gate">
          Switch to Enigma (HyperEVM) to sign in and read a market&rsquo;s deposit address.
        </ResultNote>
      ) : (
        <div className="flex flex-col gap-4">
          {!signedIn ? (
            <SignInNote testId="deposit-address-idle" buttonTestId="deposit-address-sign-in">
              Sign in to read a market&rsquo;s deposit address.
            </SignInNote>
          ) : selectedMarket === null ? (
            <ResultNote testId="deposit-address-idle-market">Pick a pool above to get its deposit address.</ResultNote>
          ) : deposit.error ? (
            <ResultError kind={deposit.error.kind} message={deposit.error.message} testId="deposit-address-error" />
          ) : deposit.isPending || deposit.data === undefined ? (
            <ResultNote testId="deposit-address-loading" loading>
              Loading the deposit address…
            </ResultNote>
          ) : (
            <div
              className="border-info/30 bg-info/5 flex flex-col gap-2 rounded-xl border p-4"
              data-testid="deposit-address"
            >
              <span className="flex items-center gap-2">
                <span className="text-foreground/60 text-xs tracking-wide uppercase">
                  {truncateContractAddress(deposit.data.tokenContractAddress)}
                </span>
                <Badge variant={statusDisplay?.variant ?? "outline"} className="ml-auto">
                  {statusDisplay?.label ?? deposit.data.marketStatus}
                </Badge>
              </span>
              <span className="text-foreground/70 text-xs">Send funds to this address to deposit into the market:</span>
              <div className="flex items-center gap-1.5">
                <span
                  className="text-foreground max-w-[80%] truncate font-mono text-xs"
                  data-testid="deposit-address-value"
                >
                  {deposit.data.depositAddress ?? "—"}
                </span>
                {deposit.data.depositAddress ? (
                  <CopyButton value={deposit.data.depositAddress} label="Copy deposit address" className="size-5" />
                ) : null}
              </div>
            </div>
          )}
        </div>
      )}
    </MethodCard>
  );
}
