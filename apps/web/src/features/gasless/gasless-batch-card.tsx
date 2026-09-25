"use client";

import { Field } from "@/components/field";
import { ResultNote, ResultSuccess } from "@/components/result";
import type { GaslessBatchCall } from "@symmio/trading-core";
import { useRelayGaslessBatch, useSymmioChainId, useWalletAccount } from "@symmio/trading-react";
import { Button } from "@symmio/ui/components/button";
import { Input } from "@symmio/ui/components/input";
import { Spinner } from "@symmio/ui/components/spinner";
import { useRef, useState } from "react";
import type { Address } from "viem";
import { SubAccountPicker } from "../inspector/subaccount-picker";
import {
  GaslessBatchEntry,
  resolveBatchEntry,
  type BatchEntryDraft,
  type BatchEntryInput,
} from "./gasless-batch-entry";
import { GaslessCard } from "./gasless-card";
import { GaslessFailureNote } from "./gasless-failure-note";
import { GaslessFeePreview } from "./gasless-fee-preview";
import { storeGaslessRequest } from "./gasless-request-storage";
import { useSessionKeyWriteMode } from "./gasless-write-mode-store";

/** The card's key into the per-card session-key store. */
const METHOD = "relayGaslessBatch";

/** The name the example renames the account to, for the length of one batch. */
const EXAMPLE_TEMPORARY_SUFFIX = " (batch)";

interface Selection {
  subAccount?: Address;
  name?: string;
}

/** A plus — adds an entry to the batch. */
function PlusIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M8 3.5v9M3.5 8h9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

/**
 * Batch card: compose several gasless actions — relayable writes and
 * GaslessWallet calls, freely mixed — and relay them as **one** request, one
 * atomic transaction. Each entry shows its own share of the fee and the card
 * closes with the batch total, both from the same `previewFeeQuote`.
 *
 * Every call is still signed on its own: the protocol has no batch signature,
 * so the wallet prompts once per call and nothing is sent until all are signed.
 * A session key signs them without prompts, once it holds the batch's selectors.
 */
export function GaslessBatchCard() {
  const { isConnected } = useWalletAccount();
  const chainId = useSymmioChainId();
  const sessionKey = useSessionKeyWriteMode(METHOD);

  const [selection, setSelection] = useState<Selection>({});
  const [entries, setEntries] = useState<BatchEntryDraft[]>([]);
  const [operationType, setOperationType] = useState("");
  const nextKey = useRef(0);
  const account = selection.subAccount;

  /** Persist at acceptance so a reload mid-wait can still resume the workflow. */
  const relay = useRelayGaslessBatch({
    onAccepted: (accepted) => {
      storeGaslessRequest(chainId, {
        requestId: accepted.requestId,
        service: "operations",
        protocolInstance: accepted.protocolInstance ?? "",
        operationType: accepted.operationType ?? METHOD,
        owner: accepted.owner,
        walletIds: accepted.walletIds.map((id) => id.toString()),
        idempotencyKey: accepted.idempotencyKey,
        at: Date.now(),
      });
    },
  });

  const resolved = entries.map(resolveBatchEntry);
  const resolvedCalls = resolved.flatMap((entry) => ("call" in entry ? [entry.call] : []));
  /** The batch exists only once every entry resolves — a partial one would price and relay the wrong thing. */
  const calls: readonly GaslessBatchCall[] | undefined =
    resolved.length > 0 && resolvedCalls.length === resolved.length ? resolvedCalls : undefined;
  const labels = resolved.map((entry) => ("call" in entry ? entry.label : ""));
  const batch = account && calls ? { account, calls } : undefined;

  /** Only route `from` to the key when it is loaded and this card's key toggle is on. */
  const signingKey = sessionKey.enabled ? sessionKey.sessionKeyAddress : undefined;

  function withKey(entry: BatchEntryInput): BatchEntryDraft {
    return { ...entry, key: nextKey.current++ };
  }

  function addEntry(entry: BatchEntryInput) {
    setEntries((current) => [...current, withKey(entry)]);
    relay.reset();
  }

  /** Rename the account and restore it — a net no-op that still relays two operations. */
  function loadExample() {
    if (!account) return;
    const name = selection.name && selection.name.length > 0 ? selection.name : "Main";
    setEntries([
      withKey({
        type: "write",
        functionName: "editAccountName",
        argsText: JSON.stringify([account, `${name}${EXAMPLE_TEMPORARY_SUFFIX}`], null, 2),
      }),
      withKey({ type: "write", functionName: "editAccountName", argsText: JSON.stringify([account, name], null, 2) }),
    ]);
    relay.reset();
  }

  return (
    <GaslessCard
      testId="gasless-batch"
      method={METHOD}
      description="Relay several gasless actions as one request: one atomic transaction, one fee charge per payer, and an allowance approved early in the batch already covers the calls after it."
      wide
      sessionKeyMethod={METHOD}
    >
      {!isConnected ? (
        <ResultNote testId="gasless-batch-disconnected">Connect a wallet to build a batch.</ResultNote>
      ) : (
        <>
          <SubAccountPicker
            idPrefix="input-gasless-batch-account"
            selected={selection}
            onSelect={(next) => {
              setSelection(next);
              relay.reset();
            }}
            accountLabel="account (sub-account)"
            accountEmptyHint="Every call runs under this sub-account, consumes its nonces, and is billed to it."
            selectedHintLabel="Batch account"
          />

          {entries.length === 0 ? (
            <ResultNote testId="gasless-batch-empty">
              Add a relayable write or a wallet call — or load the example, which renames the account and restores it.
            </ResultNote>
          ) : (
            <div className="space-y-3" data-testid="gasless-batch-entries">
              {entries.map((entry, index) => (
                <GaslessBatchEntry
                  key={entry.key}
                  index={index}
                  entry={entry}
                  resolved={resolved[index]!}
                  account={account}
                  batch={batch}
                  onChange={(next) => {
                    setEntries((current) => current.map((row) => (row.key === next.key ? next : row)));
                    relay.reset();
                  }}
                  onRemove={() => {
                    setEntries((current) => current.filter((row) => row.key !== entry.key));
                    relay.reset();
                  }}
                />
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => addEntry({ type: "write", functionName: "", argsText: "[]" })}
              data-testid="button-gasless-batch-add-write"
            >
              <PlusIcon />
              Add relayable write
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => addEntry({ type: "wallet", walletIdText: "0", target: "", data: "" })}
              data-testid="button-gasless-batch-add-wallet"
            >
              <PlusIcon />
              Add wallet call
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={!account}
              onClick={loadExample}
              data-testid="button-gasless-batch-example"
            >
              Load example
            </Button>
            {entries.length > 0 ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEntries([]);
                  relay.reset();
                }}
                className="text-destructive hover:bg-destructive/10 hover:text-destructive ml-auto"
                data-testid="button-gasless-batch-clear"
              >
                Clear all
              </Button>
            ) : null}
          </div>

          <Field
            label="Operation type"
            htmlFor="gasless-batch-operation-type"
            hint="Optional label stored with the request. Left blank, the calls' own names are joined with “+”."
          >
            <Input
              id="gasless-batch-operation-type"
              value={operationType}
              onChange={(event) => setOperationType(event.target.value)}
              placeholder="editAccountName+editAccountName"
              className="font-mono"
              data-testid="input-gasless-batch-operation-type"
            />
          </Field>

          {calls ? (
            <ResultNote testId="gasless-batch-signing-note">
              {signingKey
                ? `The session key signs all ${plural(calls.length, "call")} — no prompts.`
                : `Your wallet asks for ${plural(calls.length, "signature")}, one per call: the protocol has no batch signature. Nothing is sent until every call is signed.`}
            </ResultNote>
          ) : null}

          <Button
            type="button"
            size="sm"
            disabled={!batch || relay.isPending}
            onClick={() => {
              if (!batch) return;
              relay.mutate({
                account: batch.account,
                calls: batch.calls,
                ...(signingKey ? { from: signingKey } : {}),
                ...(operationType.trim().length > 0 ? { operationType: operationType.trim() } : {}),
              });
            }}
            data-testid="button-gasless-batch-relay"
          >
            {relay.isPending ? (
              <>
                <Spinner className="size-4" /> {relay.relay.phase === "idle" ? "Signing…" : relay.relay.phase}
              </>
            ) : (
              `Relay ${plural(calls?.length ?? 0, "call")} as one request`
            )}
          </Button>

          {relay.error ? (
            <GaslessFailureNote error={relay.error} testId="gasless-batch-error" />
          ) : relay.isSuccess ? (
            <ResultSuccess testId="gasless-batch-result">
              Relayed {plural(relay.data.accepted.walletIds.length, "call")} as request{" "}
              <span className="font-mono text-xs">{relay.data.accepted.requestId}</span>
              {relay.data.confirmed?.txHash ? (
                <>
                  {" "}
                  in <span className="font-mono text-xs break-all">{relay.data.confirmed.txHash}</span>
                </>
              ) : null}
              . One transaction carried every call; the hook waited for it to land.
            </ResultSuccess>
          ) : null}

          <GaslessFeePreview
            account={account}
            calls={calls}
            labels={labels}
            idleHint={entries.length === 0 ? "add a call to estimate" : "complete every entry to estimate"}
            testId="gasless-batch-fee"
          />
        </>
      )}
    </GaslessCard>
  );
}
