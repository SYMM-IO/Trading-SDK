"use client";

import { Field } from "@/components/field";
import { ResultError, ResultNote } from "@/components/result";
import { ListingDepositChainId, type ListingMarket } from "@symmio/trading-core";
import { useDepositAddress } from "@symmio/trading-react";
import { Badge } from "@symmio/ui/components/badge";
import { Button } from "@symmio/ui/components/button";
import { CopyButton } from "@symmio/ui/components/copy-button";
import { Spinner } from "@symmio/ui/components/spinner";
import { useState } from "react";
import { MethodCard } from "../inspector/method-card";
import { useSolverKindActive } from "../solvers/solver-target";
import { LISTING_STATUS_DISPLAY, truncateContractAddress } from "./format-listing-value";
import { useListingAuth } from "./listing-auth-context";
import { PoolSelect } from "./pool-select";

/**
 * "Deposit address" — get (or create) the signed-in user's deposit wallet for
 * one market: **pick** a market from the catalog, then **show** the deposit
 * address to seed it.
 *
 * A market picker — the paged, server-searched {@link PoolSelect} — names the market;
 * picking a row sets the `{ contractAddress, chainId }` pair `useDepositAddress`
 * reads the wallet for. Both the bearer token (from the shared
 * {@link useListingAuth} session) and a selected market gate the read, so it
 * stays idle until the user has signed in *and* picked a market. The picker
 * itself only needs the Enigma listing catalog, so it stays interactive before
 * sign-in.
 *
 * Enigma-only: the listing backend lives on HyperEVM, so the card is gated on
 * Enigma being the active solver, mirroring the other Listing-session cards.
 */
export function DepositAddressCard() {
  const enigmaActive = useSolverKindActive("enigma");
  const { accessToken, signIn, isSigningIn } = useListingAuth();

  const [selectedContractAddress, setSelectedContractAddress] = useState("");
  const [selectedMarket, setSelectedMarket] = useState<ListingMarket | null>(null);

  // Idle until signed in AND a market is selected — the empty defaults keep the
  // hook mounted but inert (`enabled: false`) before either lands.
  const deposit = useDepositAddress({
    accessToken: accessToken ?? "",
    tokenContractAddress: selectedContractAddress,
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
      wide
    >
      {!enigmaActive ? (
        <ResultNote testId="deposit-address-gate">
          Switch to Enigma (HyperEVM) to sign in and read a market&rsquo;s deposit address.
        </ResultNote>
      ) : (
        <div className="flex flex-col gap-4">
          {/* The picker is usable before sign-in: pick a market first, then sign
              in. It only needs the Enigma listing catalog, so it gates on
              `!enigmaActive` alone — never on sign-in. */}
          <Field label="pool" htmlFor="deposit-address-market">
            <PoolSelect
              idPrefix="deposit-address-market"
              value={selectedContractAddress}
              onValueChange={setSelectedContractAddress}
              onSelectedMarketChange={setSelectedMarket}
              enabled={enigmaActive}
            />
          </Field>

          {!signedIn ? (
            <div className="flex flex-col gap-3">
              <Button
                type="button"
                size="sm"
                disabled={isSigningIn}
                onClick={() => signIn()}
                data-testid="deposit-address-sign-in"
              >
                {isSigningIn ? (
                  <>
                    <Spinner className="size-4" /> Signing in…
                  </>
                ) : (
                  "Sign in first"
                )}
              </Button>
              <ResultNote testId="deposit-address-idle">Sign in to read a market&rsquo;s deposit address.</ResultNote>
            </div>
          ) : selectedMarket === null ? (
            <ResultNote testId="deposit-address-idle-market">Select a pool to get its deposit address.</ResultNote>
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
