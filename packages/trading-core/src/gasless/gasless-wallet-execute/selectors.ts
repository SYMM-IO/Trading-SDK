import type { Hex } from "viem";
import { GASLESS_WALLET_EXECUTION_SENTINEL_SELECTOR } from "../gateway/gasless-layer-abi";
import { gaslessWalletCallSelector, type GaslessWalletCall } from "./calls";

/**
 * The exact selector set a session key must hold to run `calls` from the
 * gasless wallet: the wallet-execution sentinel plus every inner call's
 * selector, lowercased and de-duplicated.
 *
 * The GaslessLayer checks **each inner selector individually** on top of the
 * sentinel — granting only the sentinel, or only the `execute` wrapper, is not
 * enough. Build the batch first, then grant exactly what it needs.
 *
 * The delegation must be granted on a **sub-account**, not on the owner EOA:
 * `grantDelegation` is `onlyAccountOwner`, and the AccountLayer knows no owner
 * for a bare EOA, so an EOA delegator can never be authorized. Pass that same
 * sub-account as `gaslessWalletExecute`'s `signerAccount`.
 *
 * Values are `bytes4` hex. `grantDelegation` rejects a duplicate-bearing array,
 * which is why this de-duplicates.
 *
 * @param calls - The batch the session key must be able to run.
 * @returns The selector set to grant, sentinel first.
 *
 * @example
 * ```ts
 * const calls = [{ target: usdc, abi: erc20Abi, functionName: "transfer", args: [to, amount] }];
 *
 * await grantDelegation(config, {
 *   account: { addr: subAccount, isPartyB: false },
 *   delegatedSigner: sessionKey,
 *   selectors: getGaslessWalletExecuteSelectors(calls),
 *   expiryTimestamp,
 * });
 *
 * await gaslessWalletExecute(config, { calls, signerAccount: subAccount, from: sessionKey });
 * ```
 */
export function getGaslessWalletExecuteSelectors(calls: readonly GaslessWalletCall[]): readonly Hex[] {
  const seen = new Set<Hex>();
  const unique: Hex[] = [];

  for (const selector of [
    GASLESS_WALLET_EXECUTION_SENTINEL_SELECTOR as Hex,
    ...calls.map((call) => gaslessWalletCallSelector(call)),
  ]) {
    const normalized = selector.toLowerCase() as Hex;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    unique.push(normalized);
  }

  return unique;
}
