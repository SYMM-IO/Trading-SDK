"use client";

import { Field } from "@/components/field";
import { ResultError, ResultNote } from "@/components/result";
import { useSolverBalanceInfo, useSymmioConfig } from "@symmio/trading-react";
import { Button } from "@symmio/ui/components/button";
import { Combobox, type ComboboxItem } from "@symmio/ui/components/combobox";
import { JsonView } from "@symmio/ui/components/json-view";
import { Spinner } from "@symmio/ui/components/spinner";
import { shortenAddress } from "@symmio/utils";
import { useState } from "react";
import type { Address } from "viem";
import { isAddress } from "viem";
import { MethodCard } from "../inspector/method-card";
import { SubAccountPicker } from "../inspector/subaccount-picker";
import { SolverTargetSelect, useSolverKindActive, useSolverTargetState } from "./solver-target";

/**
 * Rasa-only card: solver-side balance info for one account (`/get_balance_info`).
 * The account field suggests the connected wallet's subaccounts; the
 * MultiAccount field defaults to the target chain's AccountLayer and suggests
 * the chain's known addresses (AccountLayer, affiliate).
 */
export function RasaBalanceInfoCard() {
  const { target, setTarget } = useSolverTargetState({ requireKind: "rasa" });
  const active = useSolverKindActive("rasa");
  const config = useSymmioConfig();
  const [account, setAccount] = useState("");
  const [multiAccount, setMultiAccount] = useState("");

  const validAccount = isAddress(account) ? (account as Address) : undefined;
  const validMultiAccount = isAddress(multiAccount) ? (multiAccount as Address) : undefined;

  const addresses = config.getChainConfig(target.chainId).addresses;
  // The Rasa stage server only accepts MultiAccount addresses from its own
  // allowlist; suggest the known-good one until the chain's AccountLayer is
  // added to it.
  const RASA_MULTI_ACCOUNT = "0x95605c64356572eb5C076Cb9c027c88b527A2059";
  const multiAccountItems: ComboboxItem[] = [
    {
      id: RASA_MULTI_ACCOUNT,
      title: "Rasa MultiAccount",
      description: "MultiAccount deployment accepted by the Rasa stage server.",
      meta: shortenAddress(RASA_MULTI_ACCOUNT),
      selected: validMultiAccount?.toLowerCase() === RASA_MULTI_ACCOUNT.toLowerCase(),
    },
  ];

  const query = useSolverBalanceInfo({
    chainId: target.chainId,
    solverId: target.solverId,
    address: validAccount ?? "0x0000000000000000000000000000000000000000",
    // Empty field → undefined → the action defaults to the chain's AccountLayer.
    multiAccountAddress: validMultiAccount,
    query: { enabled: false },
  });

  return (
    <MethodCard
      testId="method-rasa-balanceInfo"
      name="getSolverBalanceInfo"
      mutability="view"
      description="Solver-side balance info (allocated balance / uPnL snapshots) for one account. Rasa-only endpoint."
      wide
    >
      <SolverTargetSelect value={target} onChange={setTarget} requireKind="rasa" testId="select-rasa-balance-solver" />

      <SubAccountPicker
        idPrefix="rasa-balance-account"
        selected={{ subAccount: validAccount }}
        onSelect={(selection) => setAccount(selection.subAccount ?? "")}
        accountLabel="account (address)"
        accountEmptyHint="Pick one of the connected wallet's subaccounts or enter any account address."
        selectedHintLabel="Account"
      />

      <Field
        label="multiAccount (address)"
        htmlFor="rasa-balance-multi-field"
        hint="Optional — defaults to the chain's AccountLayer when empty."
      >
        <Combobox
          idPrefix="rasa-balance-multi"
          value={multiAccount}
          onValueChange={setMultiAccount}
          onSelect={(item) => setMultiAccount(item.id)}
          items={multiAccountItems}
          placeholder={addresses.accountLayerAddress}
          mono
          invalid={multiAccount.length > 0 && !validMultiAccount}
          triggerLabel="Browse known addresses"
        />
      </Field>

      <Button
        type="button"
        size="sm"
        disabled={!active || !validAccount || (multiAccount.length > 0 && !validMultiAccount) || query.isFetching}
        onClick={() => void query.refetch()}
        data-testid="button-read-rasa-balance-info"
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
        <ResultError testId="result-rasa-balanceInfo-error" kind={query.error.kind} message={query.error.message} />
      ) : query.data !== undefined ? (
        <JsonView data={query.data} data-testid="result-rasa-balanceInfo" />
      ) : (
        <ResultNote testId="result-rasa-balanceInfo-idle">
          Pick an account (and optionally a MultiAccount) and read.
        </ResultNote>
      )}
    </MethodCard>
  );
}
