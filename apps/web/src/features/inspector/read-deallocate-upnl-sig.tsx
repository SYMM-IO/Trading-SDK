"use client";

import { DataList, DataRow } from "@/components/data-list";
import { ResultError, ResultNote } from "@/components/result";
import { useDeallocateUpnlSig } from "@theoldvarorg/react";
import { Button } from "@theoldvarorg/ui/components/button";
import { Spinner } from "@theoldvarorg/ui/components/spinner";
import { useState } from "react";
import { isAddress, type Address } from "viem";

import { MethodCard } from "./method-card";
import { VirtualAccountField } from "./virtual-account-field";

export function ReadDeallocateUpnlSig() {
  const [virtualAccount, setVirtualAccount] = useState<string>("");
  const validVa = isAddress(virtualAccount) ? (virtualAccount as Address) : undefined;

  const mutation = useDeallocateUpnlSig();

  return (
    <MethodCard
      testId="method-getDeallocateUpnlSig"
      name="getDeallocateUpnlSig"
      mutability="view"
      description="Fetch the Muon uPnl_A attestation removeMargin requires, assembled into a contract-ready SingleUpnlSig. Off-chain Muon oracle read — no ABI."
      wide
    >
      <VirtualAccountField
        idPrefix="deallocate-upnl-sig-va"
        label="virtualAccount (VA address)"
        hint="The Muon partyA the uPnL attestation is for. The signature is short-lived — fetch it immediately before a removeMargin."
        value={virtualAccount}
        onValueChange={(next) => {
          setVirtualAccount(next);
          mutation.reset();
        }}
        invalid={virtualAccount.length > 0 && !validVa}
      />

      <Button
        type="button"
        size="sm"
        disabled={!validVa || mutation.isPending}
        onClick={() => {
          if (!validVa) return;
          mutation.mutate({ virtualAccount: validVa });
        }}
        data-testid="button-fetch-deallocate-upnl-sig"
      >
        {mutation.isPending ? (
          <>
            <Spinner className="size-4" /> Fetching…
          </>
        ) : (
          "Fetch uPnL signature"
        )}
      </Button>

      <ResultPanel testId="result-getDeallocateUpnlSig" mutation={mutation} />
    </MethodCard>
  );
}

function ResultPanel({ testId, mutation }: { testId: string; mutation: ReturnType<typeof useDeallocateUpnlSig> }) {
  if (mutation.error) {
    return <ResultError testId={`${testId}-error`} kind={mutation.error.kind} message={mutation.error.message} />;
  }
  if (!mutation.data) {
    return <ResultNote testId={`${testId}-idle`}>Enter a virtual account and fetch its uPnL signature.</ResultNote>;
  }

  const sig = mutation.data;
  return (
    <DataList data-testid={`${testId}-data`}>
      <DataRow label="reqId" value={sig.reqId} mono copyValue={sig.reqId} className="items-start" />
      <DataRow label="timestamp" value={sig.timestamp.toString()} mono copyValue={sig.timestamp.toString()} />
      <DataRow label="upnl (int256)" value={sig.upnl.toString()} mono copyValue={sig.upnl.toString()} />
      <DataRow
        label="gatewaySignature"
        value={sig.gatewaySignature}
        mono
        copyValue={sig.gatewaySignature}
        className="items-start"
      />
      <DataRow
        label="sigs.signature"
        value={sig.sigs.signature.toString()}
        mono
        copyValue={sig.sigs.signature.toString()}
        className="items-start"
      />
      <DataRow label="sigs.owner" value={sig.sigs.owner} mono copyValue={sig.sigs.owner} />
      <DataRow label="sigs.nonce" value={sig.sigs.nonce} mono copyValue={sig.sigs.nonce} />
    </DataList>
  );
}
