"use client";

import { Field } from "@/components/field";
import { ResultWarning } from "@/components/result";
import { Input } from "@symmio/ui/components/input";
import type { ReactNode } from "react";

/** A wallet id is a `uint256`, so the field takes decimal digits and nothing else. */
const WALLET_ID_TEXT = /^\d+$/;

/**
 * Whether a typed wallet id is a plain decimal `uint256` literal.
 *
 * @param text - The field's raw text.
 * @returns `true` when it parses as a wallet id.
 */
export function isGaslessWalletIdText(text: string): boolean {
  return WALLET_ID_TEXT.test(text.trim());
}

/**
 * Parse a typed wallet id.
 *
 * @param text - The field's raw text.
 * @returns The id, or `null` when the text is not a decimal `uint256`.
 */
export function parseGaslessWalletIdText(text: string): bigint | null {
  if (!isGaslessWalletIdText(text)) return null;
  try {
    return BigInt(text.trim());
  } catch {
    return null;
  }
}

interface Props {
  /** `id` of the input, so the label points at it. */
  id: string;
  /** The raw text, owned by the caller (normally the assignment store). */
  value: string;
  onChange: (next: string) => void;
  /** Label content. Defaults to `walletId`. */
  label?: ReactNode;
  /** Extra helper text shown under the default explanation. */
  hint?: ReactNode;
  testId?: string;
}

/**
 * The `walletId` input every gasless flow on this page is keyed by.
 *
 * A GaslessWallet is `(owner, walletId)`: each id is its own CREATE2 address
 * with its own balance and its own nonce stream, and wallet `0` is the original
 * wallet every SDK call defaults to. The field keeps the raw text so an edit
 * round-trips, and reports an unparseable id instead of silently falling back
 * to `0` — sending a deposit to the wrong wallet is not recoverable from the UI.
 */
export function WalletIdField({ id, value, onChange, label = "walletId", hint, testId }: Props) {
  const invalid = !isGaslessWalletIdText(value);

  return (
    <Field
      label={label}
      htmlFor={id}
      hint={
        invalid ? (
          <span className="text-destructive">
            A wallet id is a decimal <code>uint256</code> — digits only, no <code>0x</code> and no separators.
          </span>
        ) : (
          <>
            Each id is an independent wallet with its own address, balance and nonce stream; <code>0</code> is the
            original wallet. {hint}
          </>
        )
      }
    >
      <Input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        inputMode="numeric"
        placeholder="0"
        className="font-mono"
        aria-invalid={invalid}
        data-testid={testId}
      />
    </Field>
  );
}

/**
 * The warning both cards show when the deposit and execute flows point at the
 * same wallet: a settlement sweeps the wallet's **entire** balance, so anything
 * parked there for a wallet call is swept into the sub-account with the deposit.
 */
export function WalletIdCollisionNote({ walletId, testId }: { walletId: string; testId?: string }) {
  return (
    <ResultWarning testId={testId}>
      The deposit and wallet-execute cards both point at wallet <code>{walletId}</code>. A settlement sweeps the
      wallet’s entire balance, so collateral parked there for a wallet call is swept into the sub-account too — give the
      two flows different ids to keep them apart.
    </ResultWarning>
  );
}
