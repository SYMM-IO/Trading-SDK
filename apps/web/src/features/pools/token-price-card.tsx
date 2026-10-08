"use client";

import { Field } from "@/components/field";
import { ResultError, ResultNote } from "@/components/result";
import { Stat } from "@/components/stat";
import { TokenPriceChain } from "@symmio/trading-core";
import { useTokenPrice } from "@symmio/trading-react";
import { Button } from "@symmio/ui/components/button";
import { Input } from "@symmio/ui/components/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@symmio/ui/components/select";
import { Spinner } from "@symmio/ui/components/spinner";
import { useState } from "react";
import { MethodCard } from "../inspector/method-card";
import { useSolverKindActive } from "../solvers/solver-target";
import { TOKEN_PRICE_CHAIN_LABELS } from "./format-listing-value";
import { useListingAuth } from "./listing-auth-context";
import { SignInNote } from "./sign-in-note";
import { useDebouncedValue } from "./use-debounced-value";

const CHAIN_OPTIONS = Object.values(TokenPriceChain).map((chain) => ({
  value: chain,
  label: TOKEN_PRICE_CHAIN_LABELS[chain],
}));

/** Lowcap prices run many decimals deep; significant digits keep both `1234.5` and `0.00001234` readable. */
const PRICE_FORMAT = new Intl.NumberFormat("en-US", { maximumSignificantDigits: 6 });

const TIME_FORMAT = new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

/**
 * "Token price" — the Price Service's pre-listing USD estimate for a token,
 * by chain name and address, before (or regardless of whether) it is listed.
 *
 * An **authed** read (`useTokenPrice`): the bearer token comes from the shared
 * {@link useListingAuth} session, the chain is a `TokenPriceChain` **name**
 * (not a deposit chain id — `ROBINHOOD` and `ARC` have no numeric twin), and
 * the address is typed in. The token and a non-empty address both gate the
 * read, so the card stays idle until the user has signed in *and* entered an
 * address; the address is debounced so a half-typed value does not spend the
 * endpoint's rate limit.
 *
 * The figure is an estimate the backend caches for about five minutes, and the
 * SDK's query options default `staleTime` / `gcTime` to the same window. The
 * card shows when the figure was fetched so the cache is observable: re-reading
 * the same inputs inside the window keeps the timestamp, and "Refresh" forces a
 * network read (which the endpoint's limit — ten a minute per wallet — may
 * answer with a `429`).
 *
 * Enigma-only: the listing backend lives on Arbitrum, so the card is gated on
 * Enigma being the active solver, mirroring the other Listing-session cards.
 */
export function TokenPriceCard() {
  const enigmaActive = useSolverKindActive("enigma");
  const { accessToken } = useListingAuth();

  const [chain, setChain] = useState<TokenPriceChain>(TokenPriceChain.ARC);
  const [tokenAddress, setTokenAddress] = useState("");

  const address = useDebouncedValue(tokenAddress.trim(), 400);

  // Idle until signed in AND an address is entered — the empty defaults keep the
  // hook mounted but inert (`enabled: false`) before either lands.
  const estimate = useTokenPrice({
    accessToken: accessToken ?? "",
    chain,
    tokenAddress: address,
    query: { enabled: enigmaActive },
  });

  const signedIn = accessToken !== null;
  const rateLimited = estimate.error?.kind === "api" && estimate.error.status === 429;
  const retryAfterSeconds =
    rateLimited && estimate.error?.retryAfterMs != null ? Math.ceil(estimate.error.retryAfterMs / 1000) : null;

  return (
    <MethodCard
      testId="method-getTokenPrice"
      name="getTokenPrice"
      mutability="view"
      description="Token price — the Price Service's pre-listing USD estimate for a token, by chain name and address. Sign in once, pick the chain, paste the address. An estimate cached ~5 minutes, rate-limited; not a trade price. Enigma-only."
    >
      {!enigmaActive ? (
        <ResultNote testId="token-price-gate">
          Switch to Enigma (Arbitrum) to sign in and estimate a token price.
        </ResultNote>
      ) : (
        <div className="flex flex-col gap-4">
          {!signedIn ? (
            <SignInNote testId="token-price-idle" buttonTestId="token-price-sign-in">
              Sign in to estimate a token&rsquo;s price.
            </SignInNote>
          ) : (
            <>
              <Field label="chain" htmlFor="token-price-chain" hint="A chain name, not a deposit chain id.">
                <Select value={chain} onValueChange={(next) => setChain(next as TokenPriceChain)}>
                  <SelectTrigger id="token-price-chain" aria-label="Token chain" data-testid="token-price-chain">
                    <SelectValue placeholder="Select a chain" />
                  </SelectTrigger>
                  <SelectContent>
                    {CHAIN_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="tokenAddress" htmlFor="token-price-token">
                <Input
                  id="token-price-token"
                  data-testid="token-price-token"
                  value={tokenAddress}
                  onChange={(e) => setTokenAddress(e.target.value)}
                  placeholder={chain === TokenPriceChain.SOLANA ? "base58 address" : "0x…"}
                  className="font-mono"
                />
              </Field>

              {address.length > 0 ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="w-fit"
                  disabled={estimate.isFetching}
                  onClick={() => void estimate.refetch()}
                  data-testid="token-price-refresh"
                >
                  {estimate.isFetching ? (
                    <>
                      <Spinner className="size-4" /> Refreshing…
                    </>
                  ) : (
                    "Refresh"
                  )}
                </Button>
              ) : null}

              {address.length === 0 ? (
                <ResultNote testId="token-price-idle-address">Enter a token address to estimate its price.</ResultNote>
              ) : estimate.error ? (
                <ResultError
                  kind={estimate.error.kind}
                  message={
                    rateLimited
                      ? `Rate-limited — the endpoint allows ten reads a minute per wallet.${retryAfterSeconds === null ? "" : ` Retry in ${retryAfterSeconds}s.`}`
                      : estimate.error.message
                  }
                  testId="token-price-error"
                />
              ) : estimate.isPending || estimate.data === undefined ? (
                <ResultNote testId="token-price-loading" loading>
                  Estimating the price…
                </ResultNote>
              ) : (
                <div
                  className="border-info/30 bg-info/5 flex flex-col gap-4 rounded-xl border p-4"
                  data-testid="token-price"
                >
                  <Stat
                    label="Estimated price"
                    value={`~$${PRICE_FORMAT.format(estimate.data.price)}`}
                    hint="USD per token · an estimate, not a trade price."
                    testId="token-price-value"
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <Stat
                      size="sm"
                      label="Raw"
                      value={<span className="text-sm">{String(estimate.data.price)}</span>}
                      hint="The float the service returned."
                      testId="token-price-raw"
                    />
                    <Stat
                      size="sm"
                      label="Fetched"
                      value={<span className="text-sm">{TIME_FORMAT.format(estimate.dataUpdatedAt)}</span>}
                      hint={estimate.isFetching ? "Refreshing…" : "Served from cache for 5 min after this."}
                      testId="token-price-fetched-at"
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </MethodCard>
  );
}
