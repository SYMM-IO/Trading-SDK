"use client";

import { ResultError, ResultNote, ResultSuccess } from "@/components/result";
import { Button } from "@symmio/ui/components/button";
import { CopyButton } from "@symmio/ui/components/copy-button";
import { Spinner } from "@symmio/ui/components/spinner";
import { MethodCard } from "../inspector/method-card";
import { useSolverKindActive } from "../solvers/solver-target";
import { useListingAuth } from "./listing-auth-context";

/**
 * SIWE login to the listing backend, the prerequisite for authenticated Pools
 * requests. One button runs the whole EIP-4361 flow — fetch challenge, sign with
 * the wallet, exchange for a bearer token — and displays the returned access
 * code.
 *
 * Laid out as one row — session state on the left, the actions on the right —
 * because it heads the listing section: every authed card below reuses this
 * token, so it reads as the section's status bar rather than as one more card.
 *
 * Enigma-only: the listing service lives on HyperEVM, so the card gates its
 * button on Enigma being the active chain and the SDK rejects the call on any
 * other solver.
 */
export function ListingAuthCard() {
  const enigmaActive = useSolverKindActive("enigma");
  const { token, signIn, signOut, isSigningIn, error } = useListingAuth();

  return (
    <MethodCard
      testId="method-authenticateListing"
      name="authenticateListing"
      mutability="nonpayable"
      description="SIWE (EIP-4361) login to the listing backend — sign in once to get the bearer token every authed card below reuses. Enigma-only."
      wide
    >
      <div className="@container">
        <div className="flex flex-col gap-3 @2xl:flex-row @2xl:items-center @2xl:justify-between">
          <div className="min-w-0 flex-1">
            {!enigmaActive ? (
              <ResultNote testId="listing-auth-gate">
                Switch to Enigma (HyperEVM) to sign in to the listing backend.
              </ResultNote>
            ) : error ? (
              <ResultError kind={error.kind} message={error.message} testId="listing-auth-error" />
            ) : token ? (
              <ResultSuccess testId="listing-auth-token">
                <span className="text-foreground/60 text-xs tracking-wide uppercase">
                  access code · {token.tokenType}
                </span>
                <div className="flex items-center gap-1.5">
                  <span
                    className="text-foreground max-w-[80%] truncate font-mono text-xs"
                    data-testid="listing-auth-access-token"
                  >
                    {token.accessToken}
                  </span>
                  <CopyButton value={token.accessToken} label="Copy access code" className="size-5" />
                </div>
              </ResultSuccess>
            ) : (
              <ResultNote testId="listing-auth-idle">
                Signed out. Sign in to mint a bearer token for the authed reads and writes below.
              </ResultNote>
            )}
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant={token ? "outline" : "default"}
              disabled={!enigmaActive || isSigningIn}
              onClick={() => signIn()}
              data-testid="listing-auth-sign-in"
            >
              {isSigningIn ? (
                <>
                  <Spinner className="size-4" /> Signing in...
                </>
              ) : token ? (
                "Sign in again"
              ) : (
                "Sign in to Listing"
              )}
            </Button>
            {token ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => signOut()}
                data-testid="listing-auth-sign-out"
              >
                Sign out
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </MethodCard>
  );
}
