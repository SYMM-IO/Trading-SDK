import { maxUint256 } from "viem";
import { SymmError } from "../shared/errors/symm-error";

/** A canonical unsigned decimal: digits only — no sign, whitespace, exponent, fraction, or `0x` prefix. */
const DECIMAL_WALLET_ID = /^[0-9]+$/;

function invalidWalletId(value: unknown, label: string): SymmError {
  const shown = typeof value === "bigint" ? `${value}n` : (JSON.stringify(value) ?? String(value));
  return new SymmError(
    "validation",
    "GASLESS_WALLET_ID_INVALID",
    `Gasless: ${label} ${shown} is not a valid wallet id — expected a bigint (or a decimal string on the wire) from 0 through 2^256 - 1.`,
  );
}

/**
 * Validate a GaslessWallet id before it reaches an RPC call or a request body.
 *
 * Wallet ids are `uint256`: the GaslessLayer and the service accept `0` through
 * `2^256 - 1`. JavaScript `number`s are rejected outright rather than coerced,
 * because an id above `Number.MAX_SAFE_INTEGER` would silently lose precision.
 *
 * @param walletId - The candidate id.
 * @param label - How the id is named in the error message.
 * @returns The id, unchanged.
 * @throws {SymmError} `GASLESS_WALLET_ID_INVALID` for a non-bigint or an out-of-range value.
 *
 * @internal
 */
export function assertGaslessWalletId(walletId: bigint, label = "walletId"): bigint {
  if (typeof walletId !== "bigint" || walletId < 0n || walletId > maxUint256) throw invalidWalletId(walletId, label);
  return walletId;
}

/**
 * Encode a wallet id for a GasLessQ JSON body: a decimal string, never a
 * number, per the service's JSON rules.
 *
 * @param walletId - The id to encode.
 * @returns The id as a decimal string, e.g. `"2"`.
 * @throws {SymmError} `GASLESS_WALLET_ID_INVALID` for a non-bigint or an out-of-range value.
 *
 * @internal
 */
export function toGaslessWalletIdWire(walletId: bigint): string {
  return assertGaslessWalletId(walletId).toString();
}

/**
 * Strictly parse a wallet id the service returned (`wallet_id`,
 * `payload.wallet_ids[]`): a `bigint`, or a decimal string in range. Negative,
 * fractional, boolean, hex, numeric and overflowing values are rejected, mirroring
 * the service's own validation. A missing id is the caller's concern — historical
 * records omit it and mean wallet `0`.
 *
 * @param value - The raw value.
 * @param label - How the id is named in the error message.
 * @returns The id as a `bigint`.
 * @throws {SymmError} `GASLESS_WALLET_ID_INVALID` for anything else.
 *
 * @internal
 */
export function parseGaslessWalletId(value: unknown, label = "walletId"): bigint {
  if (typeof value === "bigint") return assertGaslessWalletId(value, label);
  if (typeof value !== "string" || !DECIMAL_WALLET_ID.test(value)) throw invalidWalletId(value, label);
  const walletId = BigInt(value);
  if (walletId > maxUint256) throw invalidWalletId(value, label);
  return walletId;
}
