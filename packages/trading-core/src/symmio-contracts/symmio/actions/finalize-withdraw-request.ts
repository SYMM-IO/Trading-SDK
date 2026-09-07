import type { Address, Hash } from "viem";
import { encodeFunctionData } from "viem";
import type { Config } from "../../../core/config";
import { maybeRelayAsGasless } from "../../../gasless/dispatch/maybe-relay-as-gasless";
import type { Compute, GaslessWriteParameter, WriteContractParameter } from "../../../shared/types/properties";
import { shouldSimulateBeforeWrite } from "../../../shared/utils/simulate-before-write";
import { symmioAbi } from "../../abi/v0.8.6/symmio";
import { simulateFinalizeWithdrawRequest } from "./simulate-finalize-withdraw-request";

/**
 * Parameters for {@link finalizeWithdrawRequest}.
 */
export type FinalizeWithdrawRequestParameters = Compute<
  WriteContractParameter &
    GaslessWriteParameter & {
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
 * Relayable: pass `gasless` (or run the chain in `gasless.execution.mode`) to
 * sign the same calldata as an InstantLayer operation instead of sending a
 * transaction. The operation is signed by `user` — the request's own owner
 * sub-account, which is therefore the account charged the operational fee —
 * unless `gasless.account` names another. This completes the gasless withdraw:
 * the initiating leg relays too, so neither step needs native gas.
 *
 * @param config - The SDK config (must have a `getWalletClient` resolver).
 * @param parameters - The request's owner subaccount, request id, optional chain id.
 * @returns The submitted transaction hash — the relayer's broadcast hash when relayed.
 * @throws {SymmError} when the chain is unsupported or no wallet is available.
 * @throws {SymmError} `GASLESS_NOT_CONFIGURED` when `gasless` is explicitly `true`
 *   on a chain that carries no gasless service.
 * @throws Viem's write errors (`ContractFunctionExecutionError`, ...) — including
 *   when the cooldown has not yet elapsed.
 *
 * @example
 * ```ts
 * const hash = await finalizeWithdrawRequest(config, { user: "0xsub…", requestId: 1n });
 *
 * // …or relayed, paying the fee from SYMMIO collateral instead of native gas:
 * const relayed = await finalizeWithdrawRequest(config, { user: "0xsub…", requestId: 1n, gasless: true });
 * ```
 */
export async function finalizeWithdrawRequest(
  config: Config,
  parameters: FinalizeWithdrawRequestParameters,
): Promise<FinalizeWithdrawRequestReturnType> {
  const { chainId, user, requestId, from } = parameters;

  const { addresses } = config.getChainConfig(chainId);

  /**
   * Transparent gasless seam — see {@link addMargin}. Unlike the other core
   * writes this one targets the diamond directly rather than through the
   * AccountLayer `_call` proxy (it is permissionless), so the relay signs it
   * as an operation of the request's own owner sub-account: `user` is the
   * billing/authority account unless `gasless.account` overrides it.
   * `null` means: proceed on the wallet path below, unchanged.
   */
  const relayed = await maybeRelayAsGasless(config, {
    chainId,
    from,
    gasless: parameters.gasless,
    signerAccount: user,
    calls: [
      {
        target: addresses.symmioAddress,
        callData: encodeFunctionData({
          abi: symmioAbi,
          functionName: "finalizeWithdrawRequest",
          args: [user, requestId],
        }),
      },
    ],
  });
  if (relayed !== null) return relayed;

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
