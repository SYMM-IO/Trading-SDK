import { encodeFunctionData, size, slice, type Abi, type Address, type Hex } from "viem";

/** One inner call of a gasless-wallet `execute` batch, given as raw calldata. */
export interface GaslessWalletRawCall {
  /** Contract the wallet calls. */
  target: Address;
  /**
   * Native value forwarded with the call. Defaults to `0n`. The wallet holds no
   * native balance unless someone funded it directly, so a non-zero value
   * reverts the whole batch in practice.
   */
  value?: bigint;
  /** Calldata for the target. */
  data: Hex;
}

/**
 * One inner call expressed against an ABI, which the SDK encodes with viem's
 * `encodeFunctionData` — that throws on an arity or type mismatch, before any
 * signature prompt or network call.
 *
 * `args` is deliberately `readonly unknown[]`: nothing else in this SDK uses
 * viem's contract-function generics, and a mapped-tuple surface would be out of
 * keeping. When you want compile-time-checked arguments, encode with viem
 * yourself and pass the result as a {@link GaslessWalletRawCall} — both forms
 * mix freely in one batch.
 */
export interface GaslessWalletContractCall {
  /** Contract the wallet calls. */
  target: Address;
  /** Native value forwarded with the call. Defaults to `0n`. */
  value?: bigint;
  /** ABI containing `functionName`. */
  abi: Abi | readonly unknown[];
  /** Function to call on `target`. */
  functionName: string;
  /** Arguments for `functionName`, in order. Omit for a no-argument function. */
  args?: readonly unknown[];
}

/**
 * One inner call of a gasless-wallet `execute` batch — either raw calldata
 * ({@link GaslessWalletRawCall}) or an ABI-level call the SDK encodes
 * ({@link GaslessWalletContractCall}).
 */
export type GaslessWalletCall = GaslessWalletRawCall | GaslessWalletContractCall;

/**
 * The calldata one inner call runs with — raw `data`, or the ABI call encoded.
 *
 * @internal
 */
export function gaslessWalletCallData(call: GaslessWalletCall): Hex {
  if ("data" in call) return call.data;
  return encodeFunctionData({ abi: call.abi as Abi, functionName: call.functionName, args: call.args });
}

/**
 * The 4-byte selector the GaslessLayer reads off one inner call when it prices
 * the operation and checks a delegate's authority.
 *
 * Derived from the encoded calldata rather than from `functionName`, so an
 * overloaded ABI resolves to the same selector the wallet will actually run.
 * Calldata shorter than a selector yields `0x00000000` — what the contract's
 * own `_selectorFromMemory` returns for it.
 *
 * @internal
 */
export function gaslessWalletCallSelector(call: GaslessWalletCall): Hex {
  const data = gaslessWalletCallData(call);
  return size(data) < 4 ? "0x00000000" : slice(data, 0, 4);
}

/**
 * Normalize either call form to the `(address,uint256,bytes)` tuple the
 * wallet's `execute` takes.
 *
 * @internal
 */
export function toWalletCallTuple(call: GaslessWalletCall): { target: Address; value: bigint; data: Hex } {
  return { target: call.target, value: call.value ?? 0n, data: gaslessWalletCallData(call) };
}
