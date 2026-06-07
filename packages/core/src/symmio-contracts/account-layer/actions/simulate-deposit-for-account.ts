import type { Config } from "../../../core/config";
import type { Compute, FromParameter } from "../../../shared/types/properties";
import { accountLayerAbi } from "../../abi/v0.8.5/account-layer";
import type { DepositForAccountParameters } from "./deposit-for-account";

/**
 * Parameters for {@link simulateDepositForAccount}: the write's parameters plus
 * an optional `from` (the address the dry-run runs as).
 */
export type SimulateDepositForAccountParameters = Compute<DepositForAccountParameters & FromParameter>;

/**
 * Dry-run {@link depositForAccount} without sending a transaction. Runs
 * `simulateContract` against the AccountLayer via the public client; a would-be
 * revert (e.g. insufficient collateral allowance) throws viem's call error.
 *
 * @param config - The SDK config.
 * @param parameters - Subaccount, amount, optional `from`, optional chain id.
 * @returns viem's `{ request, result }`.
 * @throws {SymmError} when the chain is unsupported.
 * @throws Viem's call errors when the transaction would revert.
 */
export async function simulateDepositForAccount(config: Config, parameters: SimulateDepositForAccountParameters) {
  const { chainId, account, amount, from } = parameters;

  const { addresses } = config.getChainConfig(chainId);

  return config.getClient({ chainId }).simulateContract({
    address: addresses.accountLayerAddress,
    abi: accountLayerAbi,
    functionName: "depositForAccount",
    args: [account, amount],
    account: from,
  });
}

/** Return type of {@link simulateDepositForAccount}: viem's `{ request, result }`. */
export type SimulateDepositForAccountReturnType = Awaited<ReturnType<typeof simulateDepositForAccount>>;
