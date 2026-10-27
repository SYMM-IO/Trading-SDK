import { getAddress, type Address, type Hex } from "viem";

/**
 * Decoders for raw subgraph scalars. The Graph returns `BigInt` / `Bytes` as
 * strings and may return `null` for optional fields; a decoder never turns a
 * missing value into zero unless its name says so, because "not indexed" and
 * "zero" mean different things to a consumer.
 */

/**
 * Parse a `BigInt` string, keeping a missing value missing.
 *
 * @param value - The raw scalar.
 * @returns The value as `bigint`, or `null` when it is `null` / empty.
 */
export function toBigIntOrNull(value: string | null | undefined): bigint | null {
  return value === null || value === undefined || value === "" ? null : BigInt(value);
}

/**
 * Parse a `BigInt` string, reading a missing value as `0n`. Only for fields the
 * schema declares non-null.
 *
 * @param value - The raw scalar.
 * @returns The value as `bigint`.
 */
export function toBigIntOrZero(value: string | null | undefined): bigint {
  return toBigIntOrNull(value) ?? 0n;
}

/**
 * Parse a seconds `BigInt` string (timestamps, epochs) into a `number`.
 *
 * @param value - The raw scalar.
 * @returns The value as `number`, or `null` when it is `null` / empty.
 */
export function toNumberOrNull(value: string | null | undefined): number | null {
  return value === null || value === undefined || value === "" ? null : Number(value);
}

/**
 * Checksum a `Bytes` address.
 *
 * @param value - The raw lowercase address.
 * @returns The checksummed address.
 */
export function toAddress(value: string): Address {
  return getAddress(value);
}

/**
 * Checksum a `Bytes` address, keeping a missing value missing.
 *
 * @param value - The raw lowercase address.
 * @returns The checksummed address, or `null`.
 */
export function toAddressOrNull(value: string | null | undefined): Address | null {
  return value ? getAddress(value) : null;
}

/**
 * Type a `Bytes` transaction hash.
 *
 * @param value - The raw hash.
 * @returns The hash as `Hex`.
 */
export function toHex(value: string): Hex {
  return value as Hex;
}
