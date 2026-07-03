"use client";

import { Field } from "@/components/field";
import { ResultError, ResultNote, ResultSuccess } from "@/components/result";
import { TxReceipt } from "@/components/tx-result";
import {
  useGrantDelegation,
  useSimulateGrantDelegation,
  useSymmioConfig,
  useWalletAccount,
} from "@symmio/trading-react";
import { Button } from "@symmio/ui/components/button";
import { Combobox } from "@symmio/ui/components/combobox";
import { DateTimePicker } from "@symmio/ui/components/date-time-picker";
import { Spinner } from "@symmio/ui/components/spinner";
import { Switch } from "@symmio/ui/components/switch";
import { formatRelativeTimestamp } from "@symmio/utils";
import { useState } from "react";
import type { Address, Hex } from "viem";
import { isAddress } from "viem";
import { useSessionKey } from "../session-keys/use-session-key";
import { getInstantLayerDelegateeSuggestions, toDelegateeComboboxItems } from "./instant-layer-delegatees";
import { SelectorIcon, WalletIcon } from "./instant-layer-icons";
import { formatSelectorList, parseSelectorTokens, toSelectorComboboxItems } from "./instant-layer-selectors";
import { MethodCard } from "./method-card";
import { SimulateResult } from "./simulate-result";
import { SubAccountPicker } from "./subaccount-picker";

export function WriteGrantDelegation() {
  const { isConnected, isOnExpectedChain } = useWalletAccount();
  const config = useSymmioConfig();
  const { solver } = config.getChainConfig();
  const { sessionKeyAddress } = useSessionKey();
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

  const simulate = useSimulateGrantDelegation();

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

      <Field label="delegatedSigner" htmlFor="grant-delegation-signer-field">
        <Combobox
          idPrefix="grant-delegation-signer"
          value={delegatedSigner}
          onValueChange={setDelegatedSigner}
          onSelect={(item) => setDelegatedSigner(item.id)}
          items={toDelegateeComboboxItems(
            getInstantLayerDelegateeSuggestions(solver, sessionKeyAddress ?? undefined),
            validDelegatedSigner,
          )}
          placeholder="0x…"
          mono
          invalid={delegatedSigner.length > 0 && !validDelegatedSigner}
          triggerIcon={<WalletIcon />}
          triggerLabel="Browse delegatees"
        />
      </Field>

      <Field
        label="selectors"
        htmlFor="grant-delegation-selectors-field"
        hint="Comma or space separated bytes4 selectors, for example 0x12345678, 0xabcdef12."
      >
        <Combobox
          idPrefix="grant-delegation-selectors"
          mode="multiple"
          value={selectorsInput}
          onValueChange={setSelectorsInput}
          onSelect={(item) => {
            const picked = item.id.toLowerCase();
            const tokens = parseSelectorTokens(selectorsInput);
            const next = tokens.some((token) => token.toLowerCase() === picked)
              ? tokens.filter((token) => token.toLowerCase() !== picked)
              : [...tokens, item.id];
            setSelectorsInput(formatSelectorList(next));
          }}
          items={toSelectorComboboxItems(parseSelectorTokens(selectorsInput))}
          placeholder="0x12345678, 0xabcdef12"
          mono
          invalid={selectorsInput.length > 0 && !selectors}
          triggerIcon={<SelectorIcon />}
          triggerLabel="Browse selectors"
        />
      </Field>

      <Field
        label="expiryTimestamp"
        htmlFor="grant-delegation-expiry-field"
        hint={expiry ? `Unix timestamp in seconds. ${formatExpiryTimestamp(expiry)}.` : "Unix timestamp in seconds."}
      >
        <DateTimePicker
          idPrefix="grant-delegation-expiry"
          value={expiryTimestamp}
          onValueChange={setExpiryTimestamp}
          date={expiry ? new Date(Number(expiry) * 1000) : undefined}
          onDateChange={(next) => setExpiryTimestamp(Math.floor(next.getTime() / 1000).toString())}
          placeholder="1767225600"
          inputMode="numeric"
          mono
          invalid={expiryTimestamp.length > 0 && !expiry}
          fromDate={startOfToday()}
          footer={<ExpiryPresets onPick={(seconds) => setExpiryTimestamp(seconds.toString())} />}
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

const EXPIRY_PRESETS = [
  { label: "1 day", days: 1 },
  { label: "1 week", days: 7 },
  { label: "1 month", days: 30 },
  { label: "3 months", days: 90 },
] as const;

const SECONDS_PER_DAY = 86_400;

/** Quick-set chips that fill the expiry with "now + N days", in unix seconds. */
function ExpiryPresets({ onPick }: { onPick: (seconds: number) => void }) {
  return (
    <div className="space-y-2">
      <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Quick set</span>
      <div className="flex flex-wrap gap-1.5">
        {EXPIRY_PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            data-testid={`button-expiry-preset-${preset.days}`}
            onClick={() => onPick(Math.floor(Date.now() / 1000) + preset.days * SECONDS_PER_DAY)}
            className="border-border bg-background hover:bg-muted/60 focus-visible:ring-ring/40 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors outline-none focus-visible:ring-2"
          >
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function parseSelectors(value: string): readonly Hex[] | undefined {
  const tokens = parseSelectorTokens(value);
  if (tokens.length === 0 || tokens.some((token) => !/^0x[0-9a-fA-F]{8}$/.test(token))) {
    return undefined;
  }
  return tokens as Hex[];
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
