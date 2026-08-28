"use client";

import { Button } from "@/components/button";
import { Pill } from "@/components/pill";
import { ConnectButton } from "@/features/wallet/connect-button";
import { useChainGate } from "@/features/wallet/use-chain-gate";
import { cn } from "@/lib/cn";
import { shortenAddress } from "@/lib/format";
import { useWalletAccount } from "@symmio/trading-react";
import { useListingSession } from "./listing-session";
import { POOLS_DEPLOYMENT } from "./pools-deployment";

export interface ListingSignInProps {
  /** `bar` sits in a panel header; `inline` sits inside an empty state. */
  variant?: "bar" | "inline";
  /** Label for the sign-in button when signed out. */
  label?: string;
}

/**
 * The one control that opens a listing session.
 *
 * Three rungs, in the order they have to be satisfied: connect a wallet, put it
 * on the pools chain, then sign. The middle rung is real and easy to miss —
 * every other pools read works from any chain because the SDK addresses them by
 * `chainId`, but SIWE is signed **by the wallet**, and wagmi refuses to hand
 * over a client for a chain the wallet is not on. So this is the one place in
 * the Pools surface that asks for a network switch, and it says so rather than
 * failing at the signature.
 */
export function ListingSignIn({ variant = "bar", label = "Sign in to the listing service" }: ListingSignInProps) {
  const { address, isConnected } = useWalletAccount();
  const session = useListingSession();
  const gate = useChainGate(POOLS_DEPLOYMENT);

  /* Both variants use the same control size; what differs is how much room the
     surrounding layout has, which is why the inline form stacks its failure
     message under the button instead of beside it. */
  const stackError = variant === "inline";

  if (!isConnected) {
    return <ConnectButton />;
  }

  if (session.isSignedIn) {
    return (
      <div className="flex items-center gap-2">
        <Pill dot color="var(--state-opened)">
          Signed in
        </Pill>
        {/* Outside the chip: a chip's label is uppercased by the design system,
            and an address in caps stops looking like the address it is. */}
        <span className="tnum text-2xs text-fg-3">{shortenAddress(address, 4, 4)}</span>
        <Button variant="ghost" size="sm" onClick={session.signOut}>
          Sign out
        </Button>
      </div>
    );
  }

  if (gate.needsSwitch) {
    return (
      <Button variant="secondary" size="sm" loading={gate.isSwitching} onClick={() => void gate.switchToDeployment()}>
        {gate.isSwitching ? null : (
          <span
            aria-hidden
            className="size-[6px] shrink-0 rounded-full"
            style={{ background: `var(${POOLS_DEPLOYMENT.chainColorVar})` }}
          />
        )}
        Switch to {POOLS_DEPLOYMENT.chainName} to sign in
      </Button>
    );
  }

  return (
    <div className={cn("flex gap-2", stackError ? "flex-col items-center" : "items-center")}>
      {/* A rejected signature or a backend that refused the login is the most
          likely outcome after a click here, and the session exposes the reason.
          Saying nothing left the button simply stopping — which reads as the
          app being broken rather than the request being declined. */}
      {session.error ? (
        <span
          className={cn(
            "text-2xs text-short",
            stackError ? "order-2 max-w-[52ch] text-center" : "max-w-[28ch] truncate",
          )}
          title={session.error.message}
        >
          {session.error.message}
        </span>
      ) : null}
      <Button variant="primary" size="sm" loading={session.isSigningIn} onClick={session.signIn}>
        {label}
      </Button>
    </div>
  );
}

/**
 * Why a panel is empty when nobody has signed in.
 *
 * Shown in place of a table or a form rather than beside it: an authed pools
 * read has no partial state, so a signed-out panel is not "loading" and must
 * not look like it.
 */
export function ListingSignInPrompt({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
      <p className="max-w-[60ch] text-md text-fg-2">{children}</p>
      <ListingSignIn variant="inline" />
      <p className="max-w-[60ch] text-2xs text-fg-3">
        One signature, held in this browser. The listing backend is custodial REST — it cannot read a signature off a
        transaction the way a contract can, so it asks for one directly.
      </p>
    </div>
  );
}
