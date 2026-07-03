import type { SimulateContractReturnType } from "viem";
import type { Config } from "../../../core/config";
import type { Compute, FromParameter } from "../../../shared/types/properties";
import { accountLayerAbi } from "../../abi/v0.8.5/account-layer";
import type { AddMarginParameters } from "./add-margin";

/**
 * Parameters for {@link simulateAddMargin}: the write's parameters plus an
 * optional `from` (the address the dry-run runs as).
 */
export type SimulateAddMarginParameters = Compute<AddMarginParameters & FromParameter>;

/**
 * Return type of {@link simulateAddMargin}: viem's `{ request, result }`.
 *
 * Written as an explicit alias over `SimulateContractReturnType<typeof accountLayerAbi, …>`
 * so the emitted declaration references the ABI by name instead of inlining the whole
 * ABI (which would bloat the published `.d.ts` and degrade consumers' type-checking).
 */
export type SimulateAddMarginReturnType = SimulateContractReturnType<typeof accountLayerAbi, "addMargin">;

/**
 * Dry-run {@link addMargin} without sending a transaction. Runs `simulateContract`
 * against the AccountLayer via the public client; a would-be revert (e.g.
 * `ZeroAmount`, not the VA owner) throws viem's call error.
 *
 * @param config - The SDK config.
 * @param parameters - Virtual account, amount, optional `from`, optional chain id.
 * @returns viem's `{ request, result }`.
 * @throws {SymmError} when the chain is unsupported.
 * @throws Viem's call errors when the transaction would revert.
 */
export async function simulateAddMargin(
  config: Config,
  parameters: SimulateAddMarginParameters,
): Promise<SimulateAddMarginReturnType> {
  const { chainId, virtualAccount, amount, from } = parameters;

  const { addresses } = config.getChainConfig(chainId);

  return config.getClient({ chainId }).simulateContract({
    address: addresses.accountLayerAddress,
    abi: accountLayerAbi,
    functionName: "addMargin",
    args: [virtualAccount, amount],
    account: from,
  });
}
