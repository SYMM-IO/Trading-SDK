"use client";

import { ResultError, ResultNote } from "@/components/result";
import { usePartyAUpnl } from "@symmio/trading-react";
import { Button } from "@symmio/ui/components/button";
import { Spinner } from "@symmio/ui/components/spinner";
import { useState } from "react";
import type { Address } from "viem";
import { isAddress } from "viem";
import { MethodCard } from "../inspector/method-card";
import { SubAccountPicker } from "../inspector/subaccount-picker";
import { SolverTargetSelect, useSolverKindActive, useSolverTargetState } from "./solver-target";

/**
 * Rasa-only card: partyA unrealized PnL (`/partyA_upnl/{address}`). The partyA
 * field suggests the connected wallet's subaccounts.
 */
export function RasaPartyAUpnlCard() {
  const { target, setTarget } = useSolverTargetState({ requireKind: "rasa" });
  const active = useSolverKindActive("rasa");
  const [address, setAddress] = useState("");
  const validAddress = isAddress(address) ? (address as Address) : undefined;

  const query = usePartyAUpnl({
    chainId: target.chainId,
    solverId: target.solverId,
    address: validAddress ?? "0x0000000000000000000000000000000000000000",
    query: { enabled: false },
  });

  return (
    <MethodCard
      testId="method-rasa-partyAUpnl"
      name="getPartyAUpnl"
      mutability="view"
      description="PartyA unrealized PnL as a decimal string. Rasa-only endpoint."
    >
      <SolverTargetSelect value={target} onChange={setTarget} requireKind="rasa" testId="select-rasa-upnl-solver" />
      <SubAccountPicker
        idPrefix="rasa-upnl-account"
        selected={{ subAccount: validAddress }}
        onSelect={(selection) => setAddress(selection.subAccount ?? "")}
        accountLabel="partyA (address)"
        accountEmptyHint="Pick one of the connected wallet's subaccounts or enter any partyA address."
        selectedHintLabel="PartyA"
      />
      <Button
        type="button"
        size="sm"
        disabled={!active || !validAddress || query.isFetching}
        onClick={() => void query.refetch()}
        data-testid="button-read-rasa-upnl"
      >
        {query.isFetching ? (
          <>
            <Spinner className="size-4" /> Reading...
          </>
        ) : (
          "Read"
        )}
      </Button>
      {query.error ? (
        <ResultError testId="result-rasa-partyAUpnl-error" kind={query.error.kind} message={query.error.message} />
      ) : query.data !== undefined ? (
        <div className="font-mono text-sm" data-testid="result-rasa-partyAUpnl">
          uPnL: {query.data}
        </div>
      ) : (
        <ResultNote testId="result-rasa-partyAUpnl-idle">Pick a partyA address and read.</ResultNote>
      )}
    </MethodCard>
  );
}
