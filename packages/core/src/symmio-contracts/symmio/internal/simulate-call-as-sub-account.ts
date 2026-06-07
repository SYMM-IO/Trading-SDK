import type { Address, Hex } from "viem";
import type { Config } from "../../../core/config";
import { accountLayerAbi } from "../../abi/v0.8.5/account-layer";

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
 * @param parameters - Subaccount address, the encoded core calldata, optional `from`, optional chain id.
 * @returns viem's `{ request, result }` for the `_call`.
 * @throws {SymmError} when the chain is unsupported.
 * @throws Viem's call errors when the routed call would revert.
 */
export async function simulateCallAsSubAccount(
  config: Config,
  parameters: { account: Address; data: Hex; from?: Address; chainId?: number },
) {
  const { account, data, from, chainId } = parameters;

  const { addresses } = config.getChainConfig(chainId);

  return config.getClient({ chainId }).simulateContract({
    address: addresses.accountLayerAddress,
    abi: accountLayerAbi,
    functionName: "_call",
    args: [account, [data]],
    account: from,
  });
}
