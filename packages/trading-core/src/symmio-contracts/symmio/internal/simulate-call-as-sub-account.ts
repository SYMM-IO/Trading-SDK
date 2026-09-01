import type { Address, Hex, SimulateContractReturnType } from "viem";
import type { Config } from "../../../core/config";
import { accountLayerAbi } from "../../abi/v0.8.6/account-layer";

/**
 * Return type of {@link simulateCallAsSubAccount}: viem's `{ request, result }`
 * for the AccountLayer `_call` proxy.
 *
 * Written as an explicit alias over `SimulateContractReturnType<typeof accountLayerAbi, "_call">`
 * so the emitted declaration references the ABI by name instead of inlining the whole
 * ABI (which would bloat the published `.d.ts` and degrade consumers' type-checking).
 */
export type SimulateCallAsSubAccountReturnType = SimulateContractReturnType<typeof accountLayerAbi, "_call">;

/**
 * Dry-run pre-encoded SYMMIO-core calldata **as a subaccount**, mirroring
 * {@link callAsSubAccount}: it simulates the AccountLayer `_call(account, [data])`
 * proxy via the public client rather than sending it. A faithful dry-run of
 * exactly what the write would broadcast.
 *
 * Internal helper for the `_call`-routed withdraw simulations
 * (`simulateInitiateWithdraw`, `simulateRequestCancelWithdraw`).
 *
 * @param config - The SDK config.
 * @param parameters - Subaccount address, the encoded core calldata (a single
 *   `Hex`, or an array of `Hex` to batch several core calls into one `_call`),
 *   optional `from`, optional chain id.
 * @returns viem's `{ request, result }` for the `_call`.
 * @throws {SymmError} when the chain is unsupported.
 * @throws Viem's call errors when the routed call would revert.
 */
export async function simulateCallAsSubAccount(
  config: Config,
  parameters: { account: Address; data: Hex | readonly Hex[]; from?: Address; chainId?: number },
): Promise<SimulateCallAsSubAccountReturnType> {
  const { account, data, from, chainId } = parameters;
  const callDatas = typeof data === "string" ? [data] : data;

  const { addresses } = config.getChainConfig(chainId);

  return config.getClient({ chainId }).simulateContract({
    address: addresses.accountLayerAddress,
    abi: accountLayerAbi,
    functionName: "_call",
    args: [account, callDatas],
    account: from,
  });
}
