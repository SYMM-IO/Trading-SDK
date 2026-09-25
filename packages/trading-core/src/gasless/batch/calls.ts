import { encodeFunctionData, size, slice, type Abi, type AbiFunction, type Hex } from "viem";
import { SymmError } from "../../shared/errors/symm-error";
import type { GaslessWalletCall } from "../gasless-wallet-execute/calls";
import { getGaslessWalletExecuteSelectors } from "../gasless-wallet-execute/selectors";
import { GASLESS_RELAYABLE_FUNCTIONS } from "../relayable-writes";

/**
 * A relayable write named by its function, which the SDK encodes with viem's
 * `encodeFunctionData` — that throws on an arity or type mismatch, before any
 * signature prompt or network call.
 *
 * The target contract is **not** given: the SDK resolves it from the encoded
 * selector (the core diamond, the AccountLayer or the InstantLayer). The `abi`
 * is optional too — every relayable write is a known SYMMIO function, so
 * `{ functionName: "allocate", args: [amount] }` is enough. Pass an `abi` (the
 * SDK's own `symmioAbi`, `accountLayerAbi` or `instantLayerAbi`) when you
 * already hold it; the selector must still be a relayable write.
 *
 * `args` is deliberately `readonly unknown[]`, as for `GaslessWalletContractCall`.
 * When you want compile-time-checked arguments, encode with viem yourself and
 * pass the result as a {@link GaslessBatchRawCall}.
 */
export interface GaslessBatchContractCall {
  /** ABI containing `functionName`. Omit it to use the SDK's own ABI for the relayable write of that name. */
  abi?: Abi | readonly unknown[];
  /** The relayable write to run — `"allocate"`, `"initiateWithdraw"`, `"grantDelegation"`, … */
  functionName: string;
  /** Arguments for `functionName`, in order. Omit for a no-argument function. */
  args?: readonly unknown[];
}

/** A relayable write given as raw calldata; its selector decides the target contract. */
export interface GaslessBatchRawCall {
  /** Calldata of a relayable write. */
  data: Hex;
}

/**
 * A GaslessWallet `execute` entry: several calls the owner's deterministic
 * wallet makes, authorized by **one** gateway-domain signature.
 *
 * The calls run **as the wallet contract**, not as the SYMMIO account — use it to
 * move the wallet's own tokens (an ERC-20 `approve` followed by a bridge call,
 * say), exactly as with `gaslessWalletExecute`.
 */
export interface GaslessBatchWalletExecute {
  /** The calls the wallet makes, in order. Each is raw `data` or an `{ abi, functionName, args }` triple. */
  walletCalls: readonly GaslessWalletCall[];
  /**
   * Which of the owner's GaslessWallets makes them. Defaults to `0n`, the
   * original wallet. Each id is an independent wallet with its own address,
   * balance and nonce stream.
   */
  walletId?: bigint;
}

/**
 * One entry of a gasless batch: a relayable write — an ABI-level call
 * ({@link GaslessBatchContractCall}) or raw calldata ({@link GaslessBatchRawCall}) —
 * or a GaslessWallet `execute` ({@link GaslessBatchWalletExecute}). The forms mix
 * freely in one batch.
 *
 * @example
 * ```ts
 * import type { GaslessBatchCall } from "@symmio/trading-core";
 * import { erc20Abi } from "viem";
 *
 * const calls: GaslessBatchCall[] = [
 *   { functionName: "allocate", args: [amount] },
 *   { walletId: 1n, walletCalls: [{ target: usdc, abi: erc20Abi, functionName: "transfer", args: [to, value] }] },
 * ];
 * ```
 */
export type GaslessBatchCall = GaslessBatchContractCall | GaslessBatchRawCall | GaslessBatchWalletExecute;

/**
 * Whether a batch entry is a GaslessWallet `execute`.
 *
 * @internal
 */
export function isGaslessBatchWalletExecute(call: GaslessBatchCall): call is GaslessBatchWalletExecute {
  return "walletCalls" in call;
}

/**
 * The calldata a relayable-write entry runs with — raw `data`, or the named
 * call encoded against its own `abi` or, when it has none, the SDK's ABI for
 * the relayable write of that name.
 *
 * @throws {SymmError} `GASLESS_NOT_RELAYABLE` when a call without an `abi` names no relayable write.
 * @throws Viem's encoding error when the arguments do not encode.
 *
 * @internal
 */
export function gaslessBatchCallData(call: GaslessBatchContractCall | GaslessBatchRawCall): Hex {
  if ("data" in call) return call.data;
  const abi = call.abi ?? [relayableFunction(call.functionName)];
  return encodeFunctionData({ abi: abi as Abi, functionName: call.functionName, args: call.args });
}

function relayableFunction(functionName: string): AbiFunction {
  const item = GASLESS_RELAYABLE_FUNCTIONS.get(functionName);
  if (!item) {
    throw new SymmError(
      "validation",
      "GASLESS_NOT_RELAYABLE",
      `Gasless: no relayable write is named "${functionName}". A batch carries the writes in GASLESS_RELAYABLE_SELECTORS; run any other call from the GaslessWallet as a \`walletCalls\` entry.`,
    );
  }
  return item;
}

/**
 * The 4-byte selector of a calldata blob, lowercased. Calldata shorter than a
 * selector yields `0x00000000`, which no relayable write uses.
 *
 * @internal
 */
export function gaslessCallDataSelector(callData: Hex): Hex {
  return (size(callData) < 4 ? "0x00000000" : slice(callData, 0, 4)).toLowerCase() as Hex;
}

/**
 * The selectors a gasless batch runs — the delegation set a session key must
 * hold to relay it on the batch's account: each relayable write's selector, and
 * for every GaslessWallet entry the wallet-execution sentinel plus each inner
 * call's selector. Lowercased and de-duplicated in first-seen order, because
 * `grantDelegation` rejects a duplicate-bearing array.
 *
 * Selectors come from the **encoded** calldata, so an overloaded ABI resolves to
 * the function that will actually run.
 *
 * A batch that contains `grantDelegation` must be owner-signed whatever this
 * returns: the InstantLayer rejects a delegate-signed grant, so no delegation
 * makes it relayable by a session key.
 *
 * @param calls - The batch, in any order.
 * @returns The selector set, as `bytes4` hex.
 * @throws Viem's encoding error when an ABI-level call does not encode.
 *
 * @example
 * ```ts
 * await grantDelegation(config, {
 *   account: { addr: subAccount, isPartyB: false },
 *   delegatedSigner: sessionKey,
 *   selectors: getGaslessBatchSelectors(calls),
 *   expiryTimestamp,
 * });
 * ```
 */
export function getGaslessBatchSelectors(calls: readonly GaslessBatchCall[]): readonly Hex[] {
  const seen = new Set<Hex>();
  const unique: Hex[] = [];
  const add = (selector: Hex) => {
    const normalized = selector.toLowerCase() as Hex;
    if (seen.has(normalized)) return;
    seen.add(normalized);
    unique.push(normalized);
  };

  for (const call of calls) {
    if (isGaslessBatchWalletExecute(call)) {
      for (const selector of getGaslessWalletExecuteSelectors(call.walletCalls)) add(selector);
    } else {
      add(gaslessCallDataSelector(gaslessBatchCallData(call)));
    }
  }

  return unique;
}
