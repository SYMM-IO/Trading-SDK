"use client";

import { ResultError, ResultNote } from "@/components/result";
import { Button } from "@symmio/ui/components/button";
import { Spinner } from "@symmio/ui/components/spinner";
import type { ReactNode } from "react";
import { useListingAuth, type ListingWalletState } from "./listing-auth-context";

interface Props {
  /** Test id of the note. */
  testId: string;
  /** Test id of the inline sign-in button. */
  buttonTestId: string;
  /** Why this card needs a session — "Sign in to read your rewards." */
  children: ReactNode;
}

/** What to show instead of a sign-in button when the wallet cannot sign. */
export const WALLET_PROMPTS: Record<Exclude<ListingWalletState, "ready">, string> = {
  disconnected: "Connect a wallet to sign in.",
  "unsupported-chain": "Your wallet is on an unsupported network. Switch it to Arbitrum to sign in.",
};

/**
 * The signed-out state of an authed card: the reason it is idle plus an inline
 * sign-in. The session lives in the listing-service group above; this keeps a
 * way in beside every card that needs one without each card growing its own
 * sign-in block.
 *
 * The sign-in mutation is shared by every card, so a failure is shown only by
 * the note whose button started it — never by a sibling card. With no wallet
 * able to sign, the note prompts for one instead of offering a sign-in that
 * cannot succeed.
 */
export function SignInNote({ testId, buttonTestId, children }: Props) {
  const { wallet, signIn, isSigningIn, error, signInSource } = useListingAuth();

  if (wallet !== "ready") {
    return <ResultNote testId={`${testId}-wallet`}>{WALLET_PROMPTS[wallet]}</ResultNote>;
  }

  const failedHere = error !== null && !isSigningIn && signInSource === testId;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <ResultNote testId={testId}>{children}</ResultNote>
        <Button
          type="button"
          size="xs"
          variant="outline"
          disabled={isSigningIn}
          onClick={() => signIn(testId)}
          data-testid={buttonTestId}
        >
          {isSigningIn ? (
            <>
              <Spinner className="size-3" /> Signing in…
            </>
          ) : (
            "Sign in"
          )}
        </Button>
      </div>
      {failedHere ? <ResultError kind={error.kind} message={error.message} testId={`${testId}-error`} /> : null}
    </div>
  );
}
