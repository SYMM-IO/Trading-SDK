"use client";

import { ResultNote } from "@/components/result";
import { Button } from "@symmio/ui/components/button";
import { Spinner } from "@symmio/ui/components/spinner";
import type { ReactNode } from "react";
import { useListingAuth } from "./listing-auth-context";

interface Props {
  /** Test id of the note. */
  testId: string;
  /** Test id of the inline sign-in button. */
  buttonTestId: string;
  /** Why this card needs a session — "Sign in to read your rewards." */
  children: ReactNode;
}

/**
 * The signed-out state of an authed card: the reason it is idle plus an inline
 * sign-in. The session lives in the listing-service group above; this keeps a
 * way in beside every card that needs one without each card growing its own
 * sign-in block.
 */
export function SignInNote({ testId, buttonTestId, children }: Props) {
  const { signIn, isSigningIn } = useListingAuth();

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <ResultNote testId={testId}>{children}</ResultNote>
      <Button
        type="button"
        size="xs"
        variant="outline"
        disabled={isSigningIn}
        onClick={() => signIn()}
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
  );
}
