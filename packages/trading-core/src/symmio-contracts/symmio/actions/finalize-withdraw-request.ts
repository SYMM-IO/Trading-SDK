import type { Address, Hash } from "viem";
import type { Config } from "../../../core/config";
import type { Compute, WriteContractParameter } from "../../../shared/types/properties";
import { shouldSimulateBeforeWrite } from "../../../shared/utils/simulate-before-write";
import { symmioAbi } from "../../abi/v0.8.6/symmio";
import { simulateFinalizeWithdrawRequest } from "./simulate-finalize-withdraw-request";

/**
 * Parameters for {@link finalizeWithdrawRequest}.
 */
export type FinalizeWithdrawRequestParameters = Compute<
  WriteContractParameter & {
    /** The subaccount that owns the request (the request's on-chain `user`). */
    user: Address;
    /** Id of the withdraw request to finalize. */
    requestId: bigint;
  }
>;

/** Return type of {@link finalizeWithdrawRequest}: the submitted transaction hash. */
export type FinalizeWithdrawRequestReturnType = Hash;

/**
 * Finalize a matured withdraw request, paying out collateral to its receivers.
 *
 * Calls the SYMMIO core `finalizeWithdrawRequest(user, requestId)` **directly** —
 * the function is permissionless (it only checks that the cooldown has elapsed and
 * the status is valid), so it does not need the AccountLayer `_call` proxy and any
 * wallet may submit it. Funds go to the `receiver` baked into each part, not to
 * the caller.
 *
 * Dry-runs the call with {@link simulateFinalizeWithdrawRequest} first unless
 * `simulateBeforeWrite` is `false` (per-call, falling back to the config default).
 *
 * @param config - The SDK config (must have a `getWalletClient` resolver).
 * @param parameters - The request's owner subaccount, request id, optional chain id.
 * @returns The submitted transaction hash. The caller waits on the receipt.
 * @throws {SymmError} when the chain is unsupported or no wallet is available.
 * @throws Viem's write errors (`ContractFunctionExecutionError`, ...) — including
 *   when the cooldown has not yet elapsed.
 *
 * @example
 * ```ts
 * const hash = await finalizeWithdrawRequest(config, { user: "0xsub…", requestId: 1n });
 * ```
 */
export async function finalizeWithdrawRequest(
  config: Config,
  parameters: FinalizeWithdrawRequestParameters,
): Promise<FinalizeWithdrawRequestReturnType> {
  const { chainId, user, requestId, from } = parameters;

  const { addresses } = config.getChainConfig(chainId);
  const walletClient = await config.getWalletClient({ chainId, from });

  if (shouldSimulateBeforeWrite(config, parameters)) {
    await simulateFinalizeWithdrawRequest(config, { chainId, user, requestId, from: walletClient.account.address });
  }

  return walletClient.writeContract({
    address: addresses.symmioAddress,
    abi: symmioAbi,
    functionName: "finalizeWithdrawRequest",
    args: [user, requestId],
    account: walletClient.account,
    chain: walletClient.chain,
  });
}
