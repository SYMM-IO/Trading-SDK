"use client";

import { Field } from "@/components/field";
import { parseAmount } from "@/features/integration/parse-amount";
import { useSymmioConfig, useWalletAccount } from "@symmio/trading-react";
import { Button } from "@symmio/ui/components/button";
import { Input } from "@symmio/ui/components/input";
import { useState } from "react";
import { isAddress, type Address } from "viem";
import { SubAccountField } from "./subaccount-field";

/** A fully parsed withdrawal intent: which subaccount sends how much to whom. */
export interface WithdrawIntent {
  user: Address;
  amount: bigint;
  receiver: Address;
}

/** Field state for {@link WithdrawIntentFields}, plus the parsed intent once every field is valid. */
export interface WithdrawIntentForm {
  account: string;
  amount: string;
  receiver: string;
  setAccount: (value: string) => void;
  setAmount: (value: string) => void;
  setReceiver: (value: string) => void;
  /** Collateral decimals the amount is parsed with. */
  decimals: number;
  /** Set once the subaccount, amount, and receiver all parse. */
  intent?: WithdrawIntent;
}

/** Own the subaccount / amount / receiver inputs shared by the Express Withdraw cards. */
export function useWithdrawIntentForm(): WithdrawIntentForm {
  const { addresses } = useSymmioConfig().getChainConfig();
  const [account, setAccount] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [receiver, setReceiver] = useState<string>("");

  const decimals = addresses.collateralDecimals;
  const parsedAmount = parseAmount(amount, decimals);
  const intent =
    isAddress(account) && isAddress(receiver) && parsedAmount !== undefined
      ? { user: account as Address, amount: parsedAmount, receiver: receiver as Address }
      : undefined;

  return { account, amount, receiver, setAccount, setAmount, setReceiver, decimals, intent };
}

interface Props {
  /** Namespaces the field ids and `data-testid`s. */
  idPrefix: string;
  form: WithdrawIntentForm;
  /** Called after any field changes — e.g. to reset a mutation showing a stale result. */
  onEdit?: () => void;
}

/** Subaccount, amount, and receiver inputs for a withdrawal intent. */
export function WithdrawIntentFields({ idPrefix, form, onEdit }: Props) {
  const { address } = useWalletAccount();

  function edit(setter: (value: string) => void, value: string) {
    setter(value);
    onEdit?.();
  }

  return (
    <>
      <SubAccountField
        idPrefix={`${idPrefix}-user`}
        label="user (subaccount address)"
        value={form.account}
        onValueChange={(next) => edit(form.setAccount, next)}
        invalid={form.account.length > 0 && !isAddress(form.account)}
      />

      <Field label={`amount (${form.decimals}-decimal collateral units)`} htmlFor={`${idPrefix}-amount`}>
        <Input
          id={`${idPrefix}-amount`}
          data-testid={`${idPrefix}-amount`}
          value={form.amount}
          onChange={(e) => edit(form.setAmount, e.target.value)}
          placeholder="100.0"
          inputMode="decimal"
          aria-invalid={form.amount.length > 0 && parseAmount(form.amount, form.decimals) === undefined}
        />
      </Field>

      <Field
        label="receiver (same-chain address)"
        htmlFor={`${idPrefix}-receiver`}
        action={
          address ? (
            <Button type="button" size="xs" variant="ghost" onClick={() => edit(form.setReceiver, address)}>
              Use wallet
            </Button>
          ) : undefined
        }
      >
        <Input
          id={`${idPrefix}-receiver`}
          data-testid={`${idPrefix}-receiver`}
          value={form.receiver}
          onChange={(e) => edit(form.setReceiver, e.target.value)}
          placeholder="0x…"
          className="font-mono"
          aria-invalid={form.receiver.length > 0 && !isAddress(form.receiver)}
        />
      </Field>
    </>
  );
}
