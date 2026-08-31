"use client";

import { Field } from "@/components/field";
import { ResultError, ResultNote, ResultSuccess } from "@/components/result";
import { ListingMarketStatus } from "@symmio/trading-core";
import { useRefundMarket } from "@symmio/trading-react";
import { Button } from "@symmio/ui/components/button";
import { Input } from "@symmio/ui/components/input";
import { Spinner } from "@symmio/ui/components/spinner";
import { useState } from "react";
import { isAddress } from "viem";
import { useAccount } from "wagmi";
import { MethodCard } from "../inspector/method-card";
import { useSolverKindActive } from "../solvers/solver-target";
import { useListingAuth } from "./listing-auth-context";
import { usePoolScope } from "./pool-scope";

/**
 * Refund — reclaim a deposit on a **rejected** market.
 *
 * Operates on the market picked in the section's shared picker
 * ({@link usePoolScope}); it is only enabled when that market's `marketStatus` is
 * `REJECTED`. The deposit chain comes from the picked market; the recipient
 * defaults to the connected wallet and is editable. {@link useRefundMarket} POSTs
 * the refund and, on success, invalidates the user's transaction and pools views.
 *
 * The bearer token comes from the shared {@link useListingAuth} session, so the
 * user signs in **once**. Enigma-only, mirroring the other Listing-session cards.
 */
export function RefundCard() {
  const enigmaActive = useSolverKindActive("enigma");
  const { accessToken, signIn, isSigningIn } = useListingAuth();
  const { address: connectedAddress } = useAccount();
  const { contractAddress: selectedContractAddress, market } = usePoolScope();

  const [recipientInput, setRecipientInput] = useState("");

  const refund = useRefundMarket();

  const signedIn = accessToken !== null;
  const depositChain = market?.chainId;
  const isRejected = market?.marketStatus === ListingMarketStatus.REJECTED;

  const recipient = recipientInput.trim() === "" ? (connectedAddress ?? "") : recipientInput.trim();
  const recipientValid = isAddress(recipient);
  const formReady = selectedContractAddress.length > 0 && isRejected && depositChain !== undefined && recipientValid;
  const disabled = !enigmaActive || isSigningIn || refund.isPending || (signedIn && !formReady);

  function onSubmit() {
    if (!signedIn) {
      signIn();
      return;
    }
    if (accessToken === null || depositChain === undefined || !recipientValid) return;
    refund.mutate({
      accessToken,
      marketAddress: selectedContractAddress,
      depositChain,
      recipientAddress: recipient,
    });
  }

  const recipientHint = !signedIn
    ? "Sign in and pick a rejected pool to refund its deposit."
    : selectedContractAddress.length === 0
      ? "Pick a pool above."
      : !isRejected
        ? "Refund applies only to a rejected market. This one is not rejected."
        : "Where the refunded deposit is sent. Defaults to your connected wallet.";

  return (
    <MethodCard
      testId="method-refundMarket"
      name="refundMarket"
      mutability="nonpayable"
      description="Refund — reclaim your deposit on a rejected market. Sign in once, pick a rejected pool above, choose where to send the refund. Enigma-only."
    >
      <Field label="recipient_address (send to)" htmlFor="refund-recipient" hint={recipientHint}>
        <Input
          id="refund-recipient"
          data-testid="refund-recipient"
          value={recipientInput}
          onChange={(e) => setRecipientInput(e.target.value)}
          placeholder={connectedAddress ?? "0x…"}
          className="font-mono"
          disabled={refund.isPending}
          aria-invalid={recipientInput.trim() !== "" && !recipientValid}
        />
      </Field>

      <Button type="button" size="sm" disabled={disabled} onClick={onSubmit} data-testid="refund-submit">
        {refund.isPending ? (
          <>
            <Spinner className="size-4" /> Refunding…
          </>
        ) : isSigningIn ? (
          <>
            <Spinner className="size-4" /> Signing in…
          </>
        ) : signedIn ? (
          "Refund"
        ) : (
          "Sign in first"
        )}
      </Button>

      {!enigmaActive ? (
        <ResultNote testId="refund-gate">Switch to Enigma (HyperEVM) to refund a rejected market.</ResultNote>
      ) : refund.error ? (
        <ResultError kind={refund.error.kind} message={refund.error.message} testId="refund-error" />
      ) : refund.isSuccess ? (
        <ResultSuccess testId="refund-success">
          <span className="text-foreground/80 text-xs">
            Refund submitted. Tx: <span className="font-mono">{refund.data.transactionHash}</span>
          </span>
        </ResultSuccess>
      ) : (
        <ResultNote testId="refund-idle">
          {signedIn
            ? "Pick a rejected pool above and choose where to send the refunded deposit."
            : "Sign in to refund a rejected market's deposit."}
        </ResultNote>
      )}
    </MethodCard>
  );
}
