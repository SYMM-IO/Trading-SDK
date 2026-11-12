"use client";

import { ResultError, ResultNote, ResultSuccess } from "@/components/result";
import { TxReceipt } from "@/components/tx-result";
import { useGaslessWriteOption } from "@/features/gasless/gasless-write-mode-store";
import {
  useGrantDelegation,
  useSimulateGrantDelegation,
  useSymmioConfig,
  useWalletAccount,
} from "@symmio/trading-react";
import { Button } from "@symmio/ui/components/button";
import { Spinner } from "@symmio/ui/components/spinner";
import { Switch } from "@symmio/ui/components/switch";
import { useState } from "react";
import type { Address, Hex } from "viem";
import { isAddress } from "viem";
import { useSessionKey } from "../session-keys/use-session-key";
import { getInstantLayerDelegateeSuggestions } from "./instant-layer-delegatees";
import {
  EMPTY_GRANT_DELEGATE,
  GrantDelegateFields,
  parseGrantDelegate,
  type GrantDelegateDraft,
} from "./instant-layer-grant-fields";
import { MethodCard } from "./method-card";
import { SimulateResult } from "./simulate-result";
import { SubAccountPicker } from "./subaccount-picker";

export function WriteGrantDelegation() {
  const { isConnected, isOnExpectedChain } = useWalletAccount();
  const config = useSymmioConfig();
  const solver = config.getSolver();
  const { sessionKeyAddress } = useSessionKey();
  const [account, setAccount] = useState<string>("");
  const [isPartyB, setIsPartyB] = useState<boolean>(false);
  const [delegate, setDelegate] = useState<GrantDelegateDraft>(EMPTY_GRANT_DELEGATE);

  const validAccount = isAddress(account) ? (account as Address) : undefined;
  const parsedDelegate = parseGrantDelegate(delegate);
  const canSubmit = Boolean(isConnected && isOnExpectedChain && validAccount && parsedDelegate);

  const mutation = useGrantDelegation();

  /**
   * A PartyB grant is never relayable: the signed-operation encoder has no
   * PartyB form, so the SDK skips the relay seam entirely for one (and throws
   * `GASLESS_PARTYB_UNSUPPORTED` on an explicit opt-in). Blocking the toggle
   * keeps the header from claiming a relay that would silently be a wallet
   * send. See `grantDelegation` in trading-core.
   */
  const gaslessBlockedReason = isPartyB ? "the relayer has no PartyB form for a delegation grant" : undefined;
  const write = useGaslessWriteOption("grantDelegation", { blockedReason: gaslessBlockedReason });

  const simulate = useSimulateGrantDelegation();

  /** The grant's `DelegationInfo`, exactly as the write signs it. */
  const grantVariables = getVariables();
  const grantArgs = grantVariables ? [grantVariables] : undefined;

  function getVariables(): WriteVariables | undefined {
    if (!validAccount || !parsedDelegate) return undefined;
    return { account: { addr: validAccount, isPartyB }, ...parsedDelegate };
  }

  return (
    <MethodCard
      testId="method-grantDelegation"
      name="grantDelegation"
      mutability="nonpayable"
      gaslessRelayable
      gaslessBlockedReason={gaslessBlockedReason}
      gaslessFee={{ account: validAccount, args: grantArgs }}
      description="Grant one delegated signer access to selected Instant Layer function selectors."
    >
      <SubAccountPicker
        idPrefix="grant-delegation-account"
        selected={{ subAccount: validAccount }}
        onSelect={(selection) => setAccount(selection.subAccount ?? "")}
        accountLabel="account (address)"
        accountEmptyHint="Select a subaccount from the list or enter any account address manually."
        selectedHintLabel="Account"
      />

      <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5">
        <div>
          <div className="text-sm font-medium">isPartyB</div>
          <div className="text-muted-foreground text-xs">
            Use off for user accounts, subaccounts, and virtual accounts.
          </div>
        </div>
        <Switch checked={isPartyB} onCheckedChange={setIsPartyB} data-testid="switch-grant-delegation-ispartyb" />
      </div>

      <GrantDelegateFields
        idPrefix="grant-delegation"
        value={delegate}
        onChange={setDelegate}
        suggestions={getInstantLayerDelegateeSuggestions(solver, sessionKeyAddress ?? undefined)}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!canSubmit || simulate.isPending}
          onClick={() => {
            const variables = getVariables();
            if (!variables) return;
            simulate.mutate(variables);
          }}
          data-testid="button-simulate-grant-delegation"
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
            const variables = getVariables();
            if (!variables) return;
            mutation.mutate({ ...variables, ...write });
          }}
          data-testid="button-send-grant-delegation"
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
        testId="result-simulate-grantDelegation"
      />

      <WritePanel mutation={mutation} />
    </MethodCard>
  );
}

interface WriteVariables {
  account: { addr: Address; isPartyB: boolean };
  delegatedSigner: Address;
  selectors: readonly Hex[];
  expiryTimestamp: bigint;
}

function WritePanel({ mutation }: { mutation: ReturnType<typeof useGrantDelegation> }) {
  if (mutation.isPending) {
    return (
      <ResultNote testId="result-grantDelegation-pending" loading>
        Submitting transaction… waiting for wallet, then receipt.
      </ResultNote>
    );
  }
  if (mutation.error) {
    return (
      <ResultError testId="result-grantDelegation-error" kind={mutation.error.kind} message={mutation.error.message} />
    );
  }
  if (mutation.isSuccess) {
    return (
      <ResultSuccess testId="result-grantDelegation-success">
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
  return <ResultNote testId="result-grantDelegation-idle">Fill the fields above and submit.</ResultNote>;
}
