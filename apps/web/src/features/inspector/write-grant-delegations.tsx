"use client";

import { AddressTag } from "@/components/address-tag";
import { ResultError, ResultNote, ResultSuccess, ResultWarning } from "@/components/result";
import { TxReceipt } from "@/components/tx-result";
import { useGaslessWriteOption } from "@/features/gasless/gasless-write-mode-store";
import { useSupportsGrantDelegations } from "@/lib/use-supports-grant-delegations";
import {
  useGrantDelegations,
  useSimulateGrantDelegations,
  useSymmioConfig,
  useWalletAccount,
} from "@symmio/trading-react";
import { Button } from "@symmio/ui/components/button";
import { Spinner } from "@symmio/ui/components/spinner";
import { useRef, useState } from "react";
import { isAddress } from "viem";
import { useSessionKey } from "../session-keys/use-session-key";
import { getInstantLayerDelegateeSuggestions } from "./instant-layer-delegatees";
import {
  EMPTY_GRANT_DELEGATE,
  GrantDelegateFields,
  parseGrantDelegate,
  type GrantDelegate,
  type GrantDelegateDraft,
} from "./instant-layer-grant-fields";
import { MethodCard } from "./method-card";
import { SimulateResult } from "./simulate-result";
import { SubAccountPicker } from "./subaccount-picker";

/** The write this card sends — its key into the relay and session-key stores. */
const METHOD = "grantDelegations";

/** One delegate's fields, with the stable key its row renders under. */
interface DelegateRow extends GrantDelegateDraft {
  key: number;
}

/**
 * Card for `InstantLayer.grantDelegations`: several delegates of one account,
 * each with its own selectors and expiry, granted in a single call — one wallet
 * transaction, or one owner signature when relayed.
 *
 * The contract applies every entry to the one account and accepts only a PartyA
 * account, so unlike the single grant there is no `isPartyB` switch. The SDK
 * refuses an empty list or a PartyB account before any prompt.
 */
export function WriteGrantDelegations() {
  const { isConnected, isOnExpectedChain } = useWalletAccount();
  const config = useSymmioConfig();
  const solver = config.getSolver();
  const instantLayerAddress = config.getChainConfig().addresses.instantLayerAddress;
  const supported = useSupportsGrantDelegations();
  const { sessionKeyAddress } = useSessionKey();
  const [account, setAccount] = useState<string>("");
  const [rows, setRows] = useState<DelegateRow[]>([{ ...EMPTY_GRANT_DELEGATE, key: 0 }]);
  const nextKey = useRef(1);

  const validAccount = isAddress(account) ? account : undefined;
  const parsed = rows.map(parseGrantDelegate);
  const delegations = parsed.every((delegate): delegate is GrantDelegate => delegate !== undefined)
    ? parsed
    : undefined;
  const canSubmit = Boolean(isConnected && isOnExpectedChain && validAccount && delegations);

  const mutation = useGrantDelegations();
  const simulate = useSimulateGrantDelegations();
  const write = useGaslessWriteOption(METHOD);
  const suggestions = getInstantLayerDelegateeSuggestions(solver, sessionKeyAddress ?? undefined);

  const variables =
    validAccount && delegations ? { account: { addr: validAccount, isPartyB: false }, delegations } : undefined;
  /** The grant's `DelegationInfo[]`, exactly as the write signs it — every entry pinned to the one account. */
  const grantArgs = variables
    ? [variables.delegations.map((delegate) => ({ account: variables.account, ...delegate }))]
    : undefined;

  function updateRow(key: number, next: GrantDelegateDraft) {
    setRows((current) => current.map((row) => (row.key === key ? { ...next, key } : row)));
  }

  function addRow() {
    const key = nextKey.current++;
    setRows((current) => [...current, { ...EMPTY_GRANT_DELEGATE, key }]);
  }

  function removeRow(key: number) {
    setRows((current) => current.filter((row) => row.key !== key));
  }

  return (
    <MethodCard
      testId="method-grantDelegations"
      name="grantDelegations"
      mutability="nonpayable"
      gaslessRelayable
      gaslessFee={{ account: validAccount, args: grantArgs }}
      description="Grant several delegated signers of one account in a single call — one wallet transaction, or one owner signature when relayed."
    >
      {supported ? null : (
        <ResultWarning testId="grant-delegations-unsupported">
          This chain’s InstantLayer <AddressTag address={instantLayerAddress} /> is not known to have{" "}
          <span className="font-mono">grantDelegations</span>, which perps-core added on 2026-09-04. An older
          InstantLayer reverts the call with no reason — simulate first, or grant each delegate with{" "}
          <span className="font-mono">grantDelegation</span>.
        </ResultWarning>
      )}

      <SubAccountPicker
        idPrefix="grant-delegations-account"
        selected={{ subAccount: validAccount }}
        onSelect={(selection) => setAccount(selection.subAccount ?? "")}
        accountLabel="account (address)"
        accountEmptyHint="Select a subaccount from the list or enter any PartyA account address manually."
        selectedHintLabel="Account"
      />

      <div className="space-y-3" data-testid="grant-delegations-rows">
        {rows.map((row, index) => (
          <div
            key={row.key}
            className="border-border/70 bg-muted/20 space-y-3 rounded-xl border p-3"
            data-testid={`grant-delegations-row-${index}`}
          >
            <div className="flex min-h-6 items-center gap-2">
              <span className="text-muted-foreground font-mono text-xs">delegations[{index}]</span>
              {rows.length > 1 ? (
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  onClick={() => removeRow(row.key)}
                  aria-label={`Remove delegate #${index + 1}`}
                  className="text-muted-foreground hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive ml-auto"
                  data-testid={`grant-delegations-row-${index}-remove`}
                >
                  <RemoveIcon />
                  Remove
                </Button>
              ) : null}
            </div>
            <GrantDelegateFields
              idPrefix={`grant-delegations-${row.key}`}
              value={row}
              onChange={(next) => updateRow(row.key, next)}
              suggestions={suggestions}
            />
          </div>
        ))}

        <Button type="button" size="sm" variant="outline" onClick={addRow} data-testid="button-grant-delegations-add">
          <PlusIcon />
          Add delegate
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!canSubmit || simulate.isPending}
          onClick={() => {
            if (!variables) return;
            simulate.mutate(variables);
          }}
          data-testid="button-simulate-grant-delegations"
        >
          {simulate.isPending ? (
            <>
              <Spinner className="size-4" /> Simulating…
            </>
          ) : (
            "Simulate"
          )}
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={!canSubmit || mutation.isPending}
          onClick={() => {
            if (!variables) return;
            mutation.mutate({ ...variables, ...write });
          }}
          data-testid="button-send-grant-delegations"
        >
          {mutation.isPending ? (
            <>
              <Spinner className="size-4" /> Sending…
            </>
          ) : (
            "Send transaction"
          )}
        </Button>
      </div>

      <SimulateResult
        isPending={simulate.isPending}
        isSuccess={simulate.isSuccess}
        error={simulate.error}
        testId="result-simulate-grantDelegations"
      />

      <WritePanel mutation={mutation} />
    </MethodCard>
  );
}

function WritePanel({ mutation }: { mutation: ReturnType<typeof useGrantDelegations> }) {
  if (mutation.isPending) {
    return (
      <ResultNote testId="result-grantDelegations-pending" loading>
        Submitting transaction… waiting for wallet, then receipt.
      </ResultNote>
    );
  }
  if (mutation.error) {
    return (
      <ResultError testId="result-grantDelegations-error" kind={mutation.error.kind} message={mutation.error.message} />
    );
  }
  if (mutation.isSuccess) {
    return (
      <ResultSuccess testId="result-grantDelegations-success">
        <span className="text-foreground">Submitted.</span>
        <TxReceipt
          hash={mutation.data.hash}
          receipt={
            mutation.data.receipt
              ? { blockNumber: mutation.data.receipt.blockNumber, status: String(mutation.data.receipt.status) }
              : undefined
          }
        />
      </ResultSuccess>
    );
  }
  return <ResultNote testId="result-grantDelegations-idle">Fill every delegate above and submit.</ResultNote>;
}

/** A plus — adds a delegate row. */
function PlusIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M8 3.5v9M3.5 8h9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/** A cross — removes the delegate row it sits on. */
function RemoveIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="m4.5 4.5 7 7M11.5 4.5l-7 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
