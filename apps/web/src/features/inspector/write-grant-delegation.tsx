"use client";

import { Field } from "@/components/field";
import { ResultError, ResultNote, ResultSuccess } from "@/components/result";
import { TxReceipt } from "@/components/tx-result";
import { instantLayerAbi } from "@symm-frontier/core";
import {
  normalizeSymmError,
  useGrantDelegation,
  useSymmioConfig,
  useWalletAccount,
  type SymmioRequestError,
} from "@symm-frontier/react";
import { Button } from "@symm-frontier/ui/components/button";
import { Input } from "@symm-frontier/ui/components/input";
import { Spinner } from "@symm-frontier/ui/components/spinner";
import { Switch } from "@symm-frontier/ui/components/switch";
import { formatRelativeTimestamp } from "@symm-frontier/utils";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import type { Address, Hex } from "viem";
import { isAddress } from "viem";
import { getInstantLayerDelegateeSuggestions, InstantLayerDelegateeSuggestions } from "./instant-layer-delegatees";
import { formatSelectorList, InstantLayerSelectorSuggestions } from "./instant-layer-selectors";
import { MethodCard } from "./method-card";
import { SimulateResult } from "./simulate-result";
import { SubAccountPicker } from "./subaccount-picker";

export function WriteGrantDelegation() {
  const { address, chainId, isConnected, isOnExpectedChain } = useWalletAccount();
  const config = useSymmioConfig();
  const { addresses, solver } = config.getChainConfig();
  const [account, setAccount] = useState<string>("");
  const [isPartyB, setIsPartyB] = useState<boolean>(false);
  const [delegatedSigner, setDelegatedSigner] = useState<string>("");
  const [selectorsInput, setSelectorsInput] = useState<string>("");
  const [expiryTimestamp, setExpiryTimestamp] = useState<string>("");

  const validAccount = isAddress(account) ? (account as Address) : undefined;
  const validDelegatedSigner = isAddress(delegatedSigner) ? (delegatedSigner as Address) : undefined;
  const selectors = parseSelectors(selectorsInput);
  const expiry = parseExpiryTimestamp(expiryTimestamp);
  const canSubmit = Boolean(
    isConnected && isOnExpectedChain && validAccount && validDelegatedSigner && selectors && expiry,
  );

  const mutation = useGrantDelegation();

  const simulate = useMutation<void, SymmioRequestError, WriteVariables>({
    mutationFn: async (variables) => {
      try {
        await config.getClient({ chainId }).simulateContract({
          address: addresses.instantLayerAddress,
          abi: instantLayerAbi,
          functionName: "grantDelegation",
          args: [
            {
              account: variables.account,
              delegatedSigner: variables.delegatedSigner,
              selectors: variables.selectors,
              expiryTimestamp: variables.expiryTimestamp,
            },
          ],
          account: address,
        });
      } catch (err) {
        throw normalizeSymmError(err);
      }
    },
  });

  function getVariables(): WriteVariables | undefined {
    if (!validAccount || !validDelegatedSigner || !selectors || !expiry) return undefined;
    return {
      account: { addr: validAccount, isPartyB },
      delegatedSigner: validDelegatedSigner,
      selectors,
      expiryTimestamp: expiry,
    };
  }

  return (
    <MethodCard
      testId="method-grantDelegation"
      name="grantDelegation"
      mutability="nonpayable"
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

      <Field label="delegatedSigner" htmlFor="input-grant-delegation-signer">
        <Input
          id="input-grant-delegation-signer"
          data-testid="input-grant-delegation-signer"
          value={delegatedSigner}
          onChange={(e) => setDelegatedSigner(e.target.value)}
          placeholder="0x…"
          className="font-mono"
          aria-invalid={delegatedSigner.length > 0 && !validDelegatedSigner}
        />
      </Field>
      <InstantLayerDelegateeSuggestions
        suggestions={getInstantLayerDelegateeSuggestions(solver)}
        selected={validDelegatedSigner}
        onPick={(nextDelegate) => setDelegatedSigner(nextDelegate)}
      />

      <Field
        label="selectors"
        htmlFor="input-grant-delegation-selectors"
        hint="Comma or space separated bytes4 selectors, for example 0x12345678, 0xabcdef12."
      >
        <Input
          id="input-grant-delegation-selectors"
          data-testid="input-grant-delegation-selectors"
          value={selectorsInput}
          onChange={(e) => setSelectorsInput(e.target.value)}
          placeholder="0x12345678, 0xabcdef12"
          className="font-mono"
          aria-invalid={selectorsInput.length > 0 && !selectors}
        />
      </Field>
      <InstantLayerSelectorSuggestions
        mode="multiple"
        selected={selectors ?? []}
        onPick={(nextSelector) => {
          const current = selectors ?? [];
          const next = current.includes(nextSelector)
            ? current.filter((selector) => selector !== nextSelector)
            : [...current, nextSelector];
          setSelectorsInput(formatSelectorList(next));
        }}
      />

      <Field
        label="expiryTimestamp"
        htmlFor="input-grant-delegation-expiry"
        hint={expiry ? `Unix timestamp in seconds. ${formatExpiryTimestamp(expiry)}.` : "Unix timestamp in seconds."}
      >
        <Input
          id="input-grant-delegation-expiry"
          data-testid="input-grant-delegation-expiry"
          value={expiryTimestamp}
          onChange={(e) => setExpiryTimestamp(e.target.value)}
          placeholder="1767225600"
          inputMode="numeric"
          className="font-mono"
          aria-invalid={expiryTimestamp.length > 0 && !expiry}
        />
      </Field>

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
            mutation.mutate(variables);
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

function parseSelectors(value: string): readonly Hex[] | undefined {
  const selectors = value
    .split(/[\s,]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (selectors.length === 0 || selectors.some((selector) => !/^0x[0-9a-fA-F]{8}$/.test(selector))) {
    return undefined;
  }

  return selectors as Hex[];
}

function parseExpiryTimestamp(value: string): bigint | undefined {
  const trimmed = value.trim();
  if (!/^[0-9]+$/.test(trimmed)) return undefined;
  const parsed = BigInt(trimmed);
  return parsed > 0n ? parsed : undefined;
}

function formatExpiryTimestamp(timestamp: bigint): string {
  return formatRelativeTimestamp(timestamp, {
    nowLabel: "expires now",
    formatFuture: (duration) => `expires in ${duration}`,
    formatPast: (duration) => `expired ${duration} ago`,
  });
}
