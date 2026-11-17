"use client";

import { ResultError, ResultNote } from "@/components/result";
import { FEE_PREVIEW_UPNL_SIG } from "@/features/gasless/fee-preview-placeholders";
import { useGaslessMarginFunding, useSupportsGaslessService } from "@symmio/trading-react";
import { Button } from "@symmio/ui/components/button";
import { useState } from "react";
import { formatUnits, type Address } from "viem";

interface Props {
  parentAccount: Address;
  virtualAccount: Address;
  direction: "add" | "remove";
  amount18: bigint;
  writePending?: boolean;
}

/** Explicit read-only demonstration; it never changes the amount or authorizes a write. */
export function MarginFundingPreview({
  parentAccount,
  virtualAccount,
  direction,
  amount18,
  writePending = false,
}: Props) {
  // A write remounts this view; cached or late query data must wait for a new explicit preview.
  const [requested, setRequested] = useState(false);
  const supported = useSupportsGaslessService();
  const funding = useGaslessMarginFunding({
    account: parentAccount,
    parentAccount,
    virtualAccount,
    direction,
    amount18,
    calls: [
      direction === "add"
        ? { functionName: "addMargin", args: [virtualAccount, amount18] }
        : { functionName: "removeMargin", args: [virtualAccount, amount18, FEE_PREVIEW_UPNL_SIG] },
    ],
    query: { enabled: false },
  });
  if (!supported) return null;
  return (
    <div className="space-y-2">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={writePending || funding.isFetching}
        onClick={() => {
          setRequested(true);
          void funding.refetch();
        }}
      >
        Preview gasless funding
      </Button>
      <ResultNote>
        Plain-call preview only; protected execution may differ. This does not send a transaction or change the amount.
      </ResultNote>
      {funding.isFetching ? <ResultNote loading>Reading fee funding…</ResultNote> : null}
      {requested && funding.isError ? (
        <ResultError kind={funding.error.kind} code={funding.error.code} message={funding.error.message} />
      ) : null}
      {requested && !writePending && !funding.isFetching && !funding.isError && funding.data ? (
        <div className="space-y-1" role="status">
          <ResultNote>
            {funding.data.hasSufficientBalance
              ? "Quoted fees are covered by projected balances (preview only)."
              : "Insufficient projected fee funding."}
          </ResultNote>
          {funding.data.payers.map((payer) => (
            <ResultNote key={payer.payer}>
              {payer.payer}: debit {formatUnits(payer.debit18, 18)}, projected balance{" "}
              {formatUnits(payer.projectedBalance18, 18)}, shortfall {formatUnits(payer.shortfall18, 18)} collateral.
            </ResultNote>
          ))}
          {funding.data.maxAddAmount18 !== null ? (
            <ResultNote>
              Fee-safe add bound: {formatUnits(funding.data.maxAddAmount18, 18)} collateral. Recheck after changing the
              amount.
            </ResultNote>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
