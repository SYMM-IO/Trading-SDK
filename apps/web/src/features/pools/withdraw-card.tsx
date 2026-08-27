"use client";

import { Field } from "@/components/field";
import { ResultError, ResultNote, ResultSuccess } from "@/components/result";
import { LISTING_VALUE_DECIMALS } from "@symmio/trading-core";
import { useUserProfit, useWithdrawLp } from "@symmio/trading-react";
import { Button } from "@symmio/ui/components/button";
import { Input } from "@symmio/ui/components/input";
import { Spinner } from "@symmio/ui/components/spinner";
import { formatUnits, parseUnits } from "@symmio/utils/decimal";
import { useState } from "react";
import { useAccount } from "wagmi";
import { MethodCard } from "../inspector/method-card";
import { useSolverKindActive } from "../solvers/solver-target";
import { useListingAuth } from "./listing-auth-context";
import { PoolSelect } from "./pool-select";

/**
 * Parse a human LP amount ("1.5") into a raw 18-decimal `bigint`, or `null` when
 * it is not a positive number. Mirrors the SDK's `LISTING_VALUE_DECIMALS` scale so
 * the parsed value compares directly against `availableLpAmount`.
 */
function parseLpAmount(value: string): bigint | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  try {
    return BigInt(parseUnits(trimmed, LISTING_VALUE_DECIMALS).toFixed(0));
  } catch {
    return null;
  }
}

/**
 * Withdraw — queue a withdrawal of the signed-in user's LP shares from one pool.
 *
 * Mirrors the other Listing-session cards: a {@link PoolSelect} picker names the
 * pool, and {@link useUserProfit} reads the
 * user's position in it — the SDK's derived `availableLpAmount`
 * (`userLpAmount − pendingWithdrawLpAmount`) is the ceiling the amount input is
 * capped at. The destination defaults to the connected wallet and is editable.
 * `useWithdrawLp` POSTs the request; on success the amount clears and the position
 * refetches so the new pending balance shows.
 *
 * The bearer token comes from the shared {@link useListingAuth} session, so the
 * user signs in **once** and this card reuses it. Enigma-only: the listing backend
 * lives on HyperEVM, so the card is gated on Enigma being the active solver,
 * mirroring the other Listing-session cards.
 */
export function WithdrawCard() {
  const enigmaActive = useSolverKindActive("enigma");
  const { accessToken, signIn, isSigningIn } = useListingAuth();
  const { address: connectedAddress } = useAccount();

  const [selectedContractAddress, setSelectedContractAddress] = useState("");
  const [amountInput, setAmountInput] = useState("");
  const [withdrawAddress, setWithdrawAddress] = useState("");

  const profit = useUserProfit({
    accessToken: accessToken ?? "",
    tokenContractAddress: selectedContractAddress,
  });

  const withdraw = useWithdrawLp();

  const signedIn = accessToken !== null;
  const availableLpAmount = profit.data?.availableLpAmount ?? 0n;
  const availableLabel = formatUnits(availableLpAmount, LISTING_VALUE_DECIMALS).toString();

  const amount = parseLpAmount(amountInput);
  const amountValid = amount !== null && amount > 0n && amount <= availableLpAmount;
  const destination = withdrawAddress.trim() === "" ? (connectedAddress ?? "") : withdrawAddress.trim();

  const formReady = selectedContractAddress.length > 0 && amountValid && destination.length > 0;
  const disabled = !enigmaActive || isSigningIn || withdraw.isPending || (signedIn && !formReady);

  function onSubmit() {
    if (!signedIn) {
      signIn();
      return;
    }
    if (accessToken === null || amount === null) return;
    withdraw.mutate(
      {
        accessToken,
        marketAddress: selectedContractAddress,
        withdrawAddress: destination,
        amount,
      },
      {
        onSuccess: () => {
          setAmountInput("");
          void profit.refetch();
        },
      },
    );
  }

  const amountHint = !signedIn
    ? "Sign in and pick a pool to see your available LP."
    : selectedContractAddress.length === 0
      ? "Pick a pool to see your available LP."
      : profit.isPending
        ? "Loading your available LP…"
        : amountInput.trim() !== "" && !amountValid
          ? `Enter an amount greater than 0 and at most ${availableLabel} LP.`
          : `Available: ${availableLabel} LP`;

  return (
    <MethodCard
      testId="method-withdrawLp"
      name="withdrawLp"
      mutability="nonpayable"
      description="Withdraw — queue a withdrawal of your LP shares from one pool. Sign in once, pick a pool, enter an amount up to your available LP, and choose where to send it. Enigma-only."
      wide
    >
      <Field label="pool" htmlFor="withdraw-market">
        <PoolSelect
          idPrefix="withdraw-market"
          value={selectedContractAddress}
          onValueChange={setSelectedContractAddress}
          enabled={enigmaActive}
        />
      </Field>

      <Field label="amount (LP)" htmlFor="withdraw-amount" hint={amountHint}>
        <div className="flex items-center gap-2">
          <Input
            id="withdraw-amount"
            data-testid="withdraw-amount"
            inputMode="decimal"
            value={amountInput}
            onChange={(e) => setAmountInput(e.target.value)}
            placeholder="0.0"
            className="font-mono"
            disabled={withdraw.isPending}
            aria-invalid={amountInput.trim() !== "" && !amountValid}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={availableLpAmount === 0n || withdraw.isPending}
            onClick={() => setAmountInput(availableLabel)}
            data-testid="withdraw-max"
          >
            Max
          </Button>
        </div>
      </Field>

      <Field
        label="withdraw_address (send to)"
        htmlFor="withdraw-address"
        hint="Where the withdrawn liquidity is sent. Defaults to your connected wallet."
      >
        <Input
          id="withdraw-address"
          data-testid="withdraw-address"
          value={withdrawAddress}
          onChange={(e) => setWithdrawAddress(e.target.value)}
          placeholder={connectedAddress ?? "0x…"}
          className="font-mono"
          disabled={withdraw.isPending}
        />
      </Field>

      <Button type="button" size="sm" disabled={disabled} onClick={onSubmit} data-testid="withdraw-submit">
        {withdraw.isPending ? (
          <>
            <Spinner className="size-4" /> Withdrawing…
          </>
        ) : isSigningIn ? (
          <>
            <Spinner className="size-4" /> Signing in…
          </>
        ) : signedIn ? (
          "Withdraw"
        ) : (
          "Sign in first"
        )}
      </Button>

      {!enigmaActive ? (
        <ResultNote testId="withdraw-gate">Switch to Enigma (HyperEVM) to withdraw from a pool.</ResultNote>
      ) : withdraw.error ? (
        <ResultError kind={withdraw.error.kind} message={withdraw.error.message} testId="withdraw-error" />
      ) : withdraw.isSuccess ? (
        <ResultSuccess testId="withdraw-success">
          <span className="text-foreground/80 text-xs">
            Withdrawal request submitted. Your available LP drops and the amount now shows as pending withdrawal.
          </span>
        </ResultSuccess>
      ) : signedIn && selectedContractAddress.length > 0 && profit.error ? (
        <ResultError kind={profit.error.kind} message={profit.error.message} testId="withdraw-profit-error" />
      ) : (
        <ResultNote testId="withdraw-idle">
          {signedIn
            ? "Pick a pool, enter an amount up to your available LP, and choose where to send it."
            : "Sign in to withdraw LP from a pool."}
        </ResultNote>
      )}
    </MethodCard>
  );
}
