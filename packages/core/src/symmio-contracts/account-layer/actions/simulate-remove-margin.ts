import type { SimulateContractReturnType } from "viem";
import type { Config } from "../../../core/config";
import type { Compute, FromParameter } from "../../../shared/types/properties";
import { accountLayerAbi } from "../../abi/v0.8.5/account-layer";
import type { RemoveMarginParameters } from "./remove-margin";

/**
 * Parameters for {@link simulateRemoveMargin}: the write's parameters plus an
 * optional `from` (the address the dry-run runs as).
 */
export type SimulateRemoveMarginParameters = Compute<RemoveMarginParameters & FromParameter>;

/**
 * Return type of {@link simulateRemoveMargin}: viem's `{ request, result }`.
 *
 * Written as an explicit alias over `SimulateContractReturnType<typeof accountLayerAbi, …>`
 * so the emitted declaration references the ABI by name instead of inlining the whole
 * ABI (which would bloat the published `.d.ts` and degrade consumers' type-checking).
 */
export type SimulateRemoveMarginReturnType = SimulateContractReturnType<typeof accountLayerAbi, "removeMargin">;

/**
 * Dry-run {@link removeMargin} without sending a transaction. Runs `simulateContract`
 * against the AccountLayer via the public client; a would-be revert (e.g. the
 * deallocate debounce, an insolvent result, or a stale `upnlSig`) throws viem's
 * call error — a cheap way to surface those before signing.
 *
 * @param config - The SDK config.
 * @param parameters - Virtual account, amount, Muon `upnlSig`, optional `from`, optional chain id.
 * @returns viem's `{ request, result }`.
 * @throws {SymmError} when the chain is unsupported.
 * @throws Viem's call errors when the transaction would revert.
 */
export async function simulateRemoveMargin(
  config: Config,
  parameters: SimulateRemoveMarginParameters,
): Promise<SimulateRemoveMarginReturnType> {
  const { chainId, virtualAccount, amount, upnlSig, from } = parameters;

  const { addresses } = config.getChainConfig(chainId);

  return config.getClient({ chainId }).simulateContract({
    address: addresses.accountLayerAddress,
    abi: accountLayerAbi,
    functionName: "removeMargin",
    args: [virtualAccount, amount, upnlSig],
    account: from,
  });
}
