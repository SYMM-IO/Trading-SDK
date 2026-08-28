"use client";

import { Button } from "@/components/button";
import { Chips } from "@/components/chips";
import { Field } from "@/components/field";
import { MicroLabel } from "@/components/panel";
import { Skeleton } from "@/components/table";
import { Numeric } from "@/components/value";
import { parseAmount, toAmountInput } from "@/features/portfolio/amount";
import { useWriteToast } from "@/features/portfolio/use-write-toast";
import { shortenAddress } from "@/lib/format";
import { LISTING_VALUE_DECIMALS } from "@symmio/trading-core";
import { useWalletAccount, useWithdrawLp } from "@symmio/trading-react";
import { useState } from "react";
import { useListingSession } from "./listing-session";
import { listingAmount } from "./listing-values";
import { POOLS_CHAIN_ID } from "./pools-deployment";

export interface WithdrawLpFormProps {
  /** The pool's token contract address — the id the listing API withdraws against. */
  marketAddress: string;
  /**
   * The ceiling from `useUserProfit.availableLpAmount`: LP shares at 18 decimals.
   *
   * `undefined` means the position read has not answered — which is not the
   * same as a ceiling of zero, and must never be presented as one.
   */
  availableLpAmount: bigint | undefined;
  /** Whether that ceiling is still loading. A quick-pick against `0n` is a lie. */
  isPositionLoading: boolean;
  /** Refetch the position once the service accepts the request. */
  onWithdrawn: () => void;
}

const QUICK_PICKS = ["25%", "50%", "75%", "Max"] as const;

/**
 * Queue a withdrawal of LP shares from one pool.
 *
 * This is a REST call authorised by the listing session's bearer token, not a
 * wallet transaction — nothing is signed, nothing is broadcast, and the wallet
 * does not need to be on the pools chain. That is why there is no chain gate
 * here: the only rung in this surface that needs the wallet on the pools chain
 * is the SIWE sign-in, and it has been climbed by the time this form renders.
 *
 * What the button does is *queue*. The service acknowledges with an empty body
 * and moves the shares into the pool's pending-withdrawal queue; the transfer
 * itself settles off-chain on the backend's own schedule. So the honest
 * feedback is a warn-toned toast and a refetched position, not a receipt.
 */
export function WithdrawLpForm({
  marketAddress,
  availableLpAmount,
  isPositionLoading,
  onWithdrawn,
}: WithdrawLpFormProps) {
  const { accessToken } = useListingSession();
  const { address } = useWalletAccount();
  const runWrite = useWriteToast();
  const withdraw = useWithdrawLp({});

  const [input, setInput] = useState("");
  const [destinationOverride, setDestinationOverride] = useState<string | null>(null);

  /* `null` means "still following the wallet" rather than "empty". Seeding a
     plain string from `address` would need an effect, and that effect either
     overwrites what the reader typed when the wallet resolves after hydration,
     or needs a touched flag to know not to. */
  const destination = destinationOverride ?? address ?? "";

  /* The ceiling is deliberately `undefined` while the position loads and when
     it failed: 25% of a placeholder `0n` types a `0` into the field, which
     reads as "you have nothing to withdraw" rather than "this is not known". */
  const ceiling = isPositionLoading ? undefined : availableLpAmount;
  const ceilingUnknown = !isPositionLoading && availableLpAmount === undefined;

  /* LP shares are 18-decimal on this backend whatever the pool's own token
     decimals are — `tokenDecimal` describes the deposit, not the share. */
  const amount = parseAmount(input, LISTING_VALUE_DECIMALS);
  const overCeiling = amount !== undefined && ceiling !== undefined && amount > ceiling;
  const isValid =
    amount !== undefined &&
    amount > 0n &&
    ceiling !== undefined &&
    !overCeiling &&
    destination.trim().length > 0 &&
    accessToken.length > 0;

  const onQuickPick = (pick: string) => {
    if (ceiling === undefined) return;
    const fraction = pick === "Max" ? 100n : BigInt(pick.replace("%", ""));
    setInput(toAmountInput((ceiling * fraction) / 100n, LISTING_VALUE_DECIMALS));
  };

  const onSubmit = () => {
    if (amount === undefined) return;
    void runWrite(
      {
        pending: "Queueing withdrawal…",
        success: "Withdrawal queued",
        body: "The shares sit in pending withdrawal until the backend settles them.",
        tone: "warn",
        failure: "Withdrawal not queued",
      },
      async () => {
        await withdraw.mutateAsync({
          accessToken,
          marketAddress,
          withdrawAddress: destination.trim(),
          amount,
          /* Named explicitly: the mutation would otherwise default to the
             connected chain, and the listing backend only exists on this one. */
          chainId: POOLS_CHAIN_ID,
        });
        setInput("");
        /* The mutation invalidates nothing — no query key, no cache touch — so
           the position the caller renders above stays stale until it refetches
           and shows the shares moving into the pending column. */
        onWithdrawn();
      },
    );
  };

  return (
    <section className="flex flex-col gap-2.5">
      {/* DetailSection puts its children in a `<dl>`, which a form is not, so
          the title rule is reproduced here to keep the three blocks aligned. */}
      <div className="flex items-center gap-2.5">
        <MicroLabel>Withdraw</MicroLabel>
        <span aria-hidden className="h-px min-w-4 flex-1 bg-line-subtle" />
      </div>

      <Field
        label="LP shares"
        inputMode="decimal"
        placeholder="0.00"
        value={input}
        invalid={overCeiling}
        onChange={(event) => setInput(event.target.value)}
        adornment={<span className="font-mono text-sm text-fg-2">LP</span>}
        hint={
          ceilingUnknown ? (
            <span className="text-warn">AVAILABLE UNKNOWN</span>
          ) : ceiling === undefined ? (
            <Skeleton className="h-3 w-16" />
          ) : (
            <>
              AVAILABLE{" "}
              <Numeric size="sm" tone="muted">
                {listingAmount(ceiling)}
              </Numeric>
            </>
          )
        }
        footnote={
          ceilingUnknown
            ? "Your position did not load, so this form has no ceiling to check an amount against and stays closed until it does."
            : overCeiling
              ? "More than this pool has free — shares already queued are spoken for, and the service rejects the rest."
              : "Queued, not transferred. The backend settles it off-chain; until it does the shares show up under pending withdrawal instead of leaving the pool."
        }
      />

      {/* Inert rather than hidden while the ceiling is unknown: the control is
          part of the form's shape, and a row of buttons that quietly do nothing
          reads as a broken app. */}
      <div
        aria-disabled={ceiling === undefined}
        className={ceiling === undefined ? "pointer-events-none opacity-40" : undefined}
      >
        <Chips options={QUICK_PICKS} onChange={onQuickPick} />
      </div>

      {/* The input clips a full address at this width, so the hint restates the
          head and tail — the two ends anyone actually checks after a paste. */}
      <Field
        label="Destination"
        /* An address is not an amount: the field's default 18px scale clips a
           42-character string inside this rail. */
        inputClassName="text-sm font-normal"
        placeholder="0x…"
        value={destination}
        onChange={(event) => setDestinationOverride(event.target.value)}
        hint={destination ? <span className="tnum">{shortenAddress(destination, 6, 6)}</span> : "not set"}
        footnote="Defaults to the connected wallet. The service does not validate the format against the pool's chain — a Solana pool pays out to a base58 address — so nothing here is rejected for looking wrong."
      />

      <Button
        variant="primary"
        size="lg"
        className="w-full"
        loading={withdraw.isPending}
        disabled={!isValid}
        onClick={onSubmit}
      >
        Queue withdrawal
      </Button>
    </section>
  );
}
