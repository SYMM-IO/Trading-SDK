"use client";

import { formatUsd, WEI_DECIMALS } from "@/lib/format";
import {
  GaslessFeeSource,
  type GaslessBatchCall,
  type GaslessFeePayment,
  type GaslessFeeQuote,
} from "@symmio/trading-core";
import { useGaslessBatchFeeQuote } from "@symmio/trading-react";
import { shortenAddress } from "@symmio/utils";
import { isAddressEqual, type Address } from "viem";
import { GaslessFeeLine, type GaslessFeeLineState } from "./gasless-fee-line";

/** Quotes change with the fee schedule and the daily free quota — neither moves by the second. */
const FEE_QUOTE_STALE_MS = 15_000;

interface Props {
  /** The sub-account the relayed calls run under and are billed to. */
  account?: Address;
  /** The calls the card's action relays, in order. */
  calls?: readonly GaslessBatchCall[];
  /** Shown in place of the figure while `account` or `calls` is missing. */
  idleHint?: string;
  /** One label per call for the hover breakdown; defaults to "Operation n". */
  labels?: readonly string[];
  testId: string;
}

/**
 * The gasless fee line for a card, priced on-chain by the GaslessLayer's
 * `previewFeeQuote` through `useGaslessBatchFeeQuote`. Pure preview: it signs
 * nothing, and the figure can still change before the relay executes.
 */
export function GaslessFeePreview({
  account,
  calls,
  idleHint = "complete the inputs to estimate",
  labels,
  testId,
}: Props) {
  if (!account || !calls || calls.length === 0) {
    return <GaslessFeeLine testId={testId} state={{ status: "idle", hint: idleHint }} />;
  }
  return <QuotedFeeLine account={account} calls={calls} labels={labels} testId={testId} />;
}

function QuotedFeeLine({
  account,
  calls,
  labels,
  testId,
}: {
  account: Address;
  calls: readonly GaslessBatchCall[];
  labels?: readonly string[];
  testId: string;
}) {
  /**
   * The hook debounces a changing batch itself, so typing costs one read per
   * pause. Keeping the previous figure while the next one loads stops the line
   * flashing back to "estimating…" each time the inputs settle.
   */
  const quote = useGaslessBatchFeeQuote({
    account,
    calls,
    query: { staleTime: FEE_QUOTE_STALE_MS, retry: 1, placeholderData: (previous) => previous },
  });

  let state: GaslessFeeLineState;
  if (quote.data) state = readyState(quote.data, labels, quote.isPlaceholderData);
  else if (quote.error) state = errorState(quote.error);
  else state = { status: "loading" };

  return <GaslessFeeLine testId={testId} state={state} />;
}

/** The fee one payment row adds up to — everything but native-gas collateral, which is a debit, not a fee. */
function paymentFee18(payment: GaslessFeePayment): bigint {
  return payment.operationalFee18 + payment.walletCreationFee18 + payment.depositFee18 + payment.nativeTopUpFee18;
}

function readyState(
  quote: GaslessFeeQuote,
  labels: readonly string[] | undefined,
  updating: boolean,
): GaslessFeeLineState {
  return {
    status: "ready",
    updating,
    fee: quote.totalFee18,
    decimals: WEI_DECIMALS,
    note: feeNote(quote),
    breakdown: <FeeBreakdown quote={quote} labels={labels} />,
  };
}

/** Who pays, in a few words: the free quota when it covers everything, else the one payer or a count. */
function feeNote(quote: GaslessFeeQuote): string | undefined {
  if (quote.totalFee18 === 0n && quote.freeOpsApplied > 0n) return "free under the daily quota";
  const payers = quote.payments.reduce<Address[]>(
    (unique, payment) =>
      unique.some((payer) => isAddressEqual(payer, payment.payer)) ? unique : [...unique, payment.payer],
    [],
  );
  if (payers.length === 1) return `billed to ${shortenAddress(payers[0]!)}`;
  return payers.length > 1 ? `billed to ${payers.length} accounts` : undefined;
}

function FeeBreakdown({ quote, labels }: { quote: GaslessFeeQuote; labels?: readonly string[] }) {
  return (
    <div className="grid gap-1.5 text-xs">
      {quote.payments.map((payment, index) => (
        <div key={index} className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground truncate">{labels?.[index] ?? `Operation ${index + 1}`}</span>
          <span className="font-mono">{formatUsd(paymentFee18(payment), WEI_DECIMALS)} USDC</span>
        </div>
      ))}
      <div className="border-border/60 mt-1 grid gap-1 border-t pt-1.5">
        <BreakdownRow label="Free operations applied" value={quote.freeOpsApplied.toString()} />
        <BreakdownRow
          label="Paid from"
          value={
            quote.payments.every((payment) => payment.source === GaslessFeeSource.WALLET_COLLATERAL)
              ? "GaslessWallet collateral"
              : "SYMMIO account balance"
          }
        />
      </div>
      <p className="text-muted-foreground mt-1 leading-5">
        A preview: the relayer’s own simulation is authoritative, and a change in allowance or balance before execution
        can move the fee or its payer.
      </p>
    </div>
  );
}

function BreakdownRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}

/** A refused quote is a fact about the relay; any other failure is only a fact about the estimate. */
function errorState(error: { code?: string; message: string }): GaslessFeeLineState {
  switch (error.code) {
    case "GASLESS_FREE_QUOTA_EXHAUSTED":
      return { status: "refused", summary: "daily free quota spent", detail: error.message };
    case "GASLESS_FEE_QUOTE_REVERTED":
      return { status: "refused", summary: "the relay would revert", detail: error.message };
    default:
      return { status: "unavailable", detail: error.message };
  }
}
