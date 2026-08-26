"use client";

import { Field } from "@/components/field";
import { ResultError, ResultNote, ResultSuccess } from "@/components/result";
import { ListingDepositChainId } from "@symmio/trading-core";
import { useAddMarket } from "@symmio/trading-react";
import { Button } from "@symmio/ui/components/button";
import { CopyButton } from "@symmio/ui/components/copy-button";
import { Input } from "@symmio/ui/components/input";
import { Spinner } from "@symmio/ui/components/spinner";
import { useState } from "react";
import { MethodCard } from "../inspector/method-card";
import { useSolverKindActive } from "../solvers/solver-target";
import { useListingAuth } from "./listing-auth-context";

/** Deposit chains the listing backend accepts, in the order the picker shows them. */
const DEPOSIT_CHAIN_OPTIONS: { id: ListingDepositChainId; label: string }[] = [
  { id: ListingDepositChainId.HYPER_EVM, label: "HyperEVM" },
  { id: ListingDepositChainId.BASE, label: "Base" },
  { id: ListingDepositChainId.BSC, label: "BSC" },
  { id: ListingDepositChainId.ARBITRUM_ONE, label: "Arbitrum One" },
  { id: ListingDepositChainId.SONIC, label: "Sonic" },
  { id: ListingDepositChainId.SOLANA, label: "Solana" },
];

/**
 * Create pool — list a new token with the listing backend.
 *
 * One form submits the token address and its pool economics (buy-back ratio,
 * max leverage) through `useAddMarket`; on success the service returns the
 * created pool and the custodial **deposit wallet** to seed it.
 *
 * The bearer token comes from the shared {@link useListingAuth} session, so the
 * user signs in **once** (here or on the sign-in card) and this card reuses it.
 * Until signed in the submit button reads "Sign in first" and runs the SIWE
 * exchange instead.
 *
 * Enigma-only: the listing backend lives on HyperEVM, so the button is gated on
 * Enigma being the active solver, mirroring the other Listing-session cards.
 */
export function CreatePoolCard() {
  const enigmaActive = useSolverKindActive("enigma");
  const { accessToken, signIn, isSigningIn } = useListingAuth();
  const create = useAddMarket();

  const [tokenContractAddress, setTokenContractAddress] = useState("");
  const [buyBackRatio, setBuyBackRatio] = useState("5");
  const [maxLeverage, setMaxLeverage] = useState("20");
  const [depositChain, setDepositChain] = useState<ListingDepositChainId>(ListingDepositChainId.HYPER_EVM);

  const buyBack = Number(buyBackRatio);
  const leverage = Number(maxLeverage);
  const validInputs =
    tokenContractAddress.trim().length > 0 &&
    buyBackRatio.trim().length > 0 &&
    Number.isFinite(buyBack) &&
    maxLeverage.trim().length > 0 &&
    Number.isFinite(leverage);

  const signedIn = accessToken !== null;
  const disabled = !enigmaActive || isSigningIn || create.isPending || (signedIn && !validInputs);

  function onSubmit() {
    if (!signedIn) {
      signIn();
      return;
    }
    create.mutate({
      accessToken,
      tokenContractAddress: tokenContractAddress.trim(),
      buyBackRatio: buyBack,
      maxLeverage: leverage,
      depositChain,
      // The endpoint's optional extras are defaulted here in the web layer, not
      // the SDK: an integrating app supplies its own defaults for these.
      isTax: false,
      userWhitelistTax: false,
      additionalChains: [],
      cexList: [],
    });
  }

  return (
    <MethodCard
      testId="method-addMarket"
      name="addMarket"
      mutability="nonpayable"
      description="Create pool — list a new token with the listing backend. Sign in once, submit the token and its pool economics, then seed the returned deposit wallet. Enigma-only."
      wide
    >
      <Field label="tokenContractAddress" htmlFor="create-pool-token-address">
        <Input
          id="create-pool-token-address"
          data-testid="create-pool-token-address"
          value={tokenContractAddress}
          onChange={(e) => setTokenContractAddress(e.target.value)}
          placeholder="0x…"
          className="font-mono"
          disabled={create.isPending}
        />
      </Field>

      <Field label="depositChain" htmlFor="create-pool-deposit-chain">
        <select
          id="create-pool-deposit-chain"
          data-testid="create-pool-deposit-chain"
          value={depositChain}
          onChange={(e) => setDepositChain(Number(e.target.value) as ListingDepositChainId)}
          disabled={create.isPending}
          className="border-border bg-input/40 h-9 w-full rounded-md border px-3 text-sm"
        >
          {DEPOSIT_CHAIN_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label} ({option.id})
            </option>
          ))}
        </select>
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="buyBackRatio (0–100)" htmlFor="create-pool-buyback">
          <Input
            id="create-pool-buyback"
            data-testid="create-pool-buyback"
            type="number"
            inputMode="decimal"
            min={0}
            max={100}
            value={buyBackRatio}
            onChange={(e) => setBuyBackRatio(e.target.value)}
            placeholder="5"
            className="font-mono"
            disabled={create.isPending}
            aria-invalid={buyBackRatio.trim().length > 0 && !Number.isFinite(buyBack)}
          />
        </Field>
        <Field label="maxLeverage" htmlFor="create-pool-leverage">
          <Input
            id="create-pool-leverage"
            data-testid="create-pool-leverage"
            type="number"
            inputMode="numeric"
            min={1}
            max={100}
            value={maxLeverage}
            onChange={(e) => setMaxLeverage(e.target.value)}
            placeholder="20"
            className="font-mono"
            disabled={create.isPending}
            aria-invalid={maxLeverage.trim().length > 0 && !Number.isFinite(leverage)}
          />
        </Field>
      </div>

      <Button type="button" size="sm" disabled={disabled} onClick={onSubmit} data-testid="create-pool-submit">
        {create.isPending ? (
          <>
            <Spinner className="size-4" /> Creating pool…
          </>
        ) : isSigningIn ? (
          <>
            <Spinner className="size-4" /> Signing in…
          </>
        ) : signedIn ? (
          "Create pool"
        ) : (
          "Sign in first"
        )}
      </Button>

      <ResultNote testId="create-pool-note">
        Max leverage is fixed at 20 for now. The tax, whitelist, extra-chain and CEX options are sent as defaults (
        <code>false</code> / <code>[]</code>).
      </ResultNote>

      {!enigmaActive ? (
        <ResultNote testId="create-pool-gate">Switch to Enigma (HyperEVM) to create a pool.</ResultNote>
      ) : create.error ? (
        <ResultError kind={create.error.kind} message={create.error.message} testId="create-pool-error" />
      ) : create.data ? (
        <ResultSuccess testId="create-pool-success">
          <span className="text-foreground/60 text-xs tracking-wide uppercase">
            {create.data.tokenTicker} · {create.data.tokenName} · {create.data.marketStatus}
          </span>
          <span className="text-foreground/70 text-xs">Send the listing deposit to seed the pool:</span>
          <div className="flex items-center gap-1.5">
            <span className="text-foreground max-w-[80%] truncate font-mono text-xs" data-testid="create-pool-wallet">
              {create.data.walletPublicKey ?? "—"}
            </span>
            {create.data.walletPublicKey ? (
              <CopyButton value={create.data.walletPublicKey} label="Copy deposit wallet" className="size-5" />
            ) : null}
          </div>
        </ResultSuccess>
      ) : (
        <ResultNote testId="create-pool-idle">
          {signedIn
            ? "Submit a token and its pool economics to open a listing application."
            : "Sign in to create a pool."}
        </ResultNote>
      )}
    </MethodCard>
  );
}
