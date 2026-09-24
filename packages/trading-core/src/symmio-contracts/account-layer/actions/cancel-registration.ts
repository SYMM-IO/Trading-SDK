import type { Address, Hash } from "viem";
import type { Config } from "../../../core/config";
import type { Compute, WriteContractParameter } from "../../../shared/types/properties";
import { shouldSimulateBeforeWrite } from "../../../shared/utils/simulate-before-write";
import { accountLayerAbi } from "../../abi/v0.8.6/account-layer";
import { simulateCancelRegistration } from "./simulate-cancel-registration";

/**
 * Parameters for {@link cancelRegistration}.
 */
export type CancelRegistrationParameters = Compute<
  WriteContractParameter & {
    /**
     * The pending affiliate (AccountManager) address to cancel. The bound wallet
     * must be that affiliate's registered `admin`; the contract reverts otherwise.
     */
    affiliate: Address;
  }
>;

/** Return type of {@link cancelRegistration}: the submitted transaction hash. */
export type CancelRegistrationReturnType = Hash;

/**
 * Send the on-chain transaction that cancels a still-`PENDING` affiliate
 * registration, clearing it back to `NONE`.
 *
 * Resolves the bound wallet client and `AccountLayer` address from `config`. The
 * bound EOA must be the affiliate's registered `admin`.
 *
 * Dry-runs the call with {@link simulateCancelRegistration} first unless
 * `simulateBeforeWrite` is `false` (per-call, falling back to the config default).
 *
 * @param config - The SDK config (must have a `getWalletClient` resolver).
 * @param parameters - Affiliate address, optional chain id / simulate opt-out.
 * @returns The submitted transaction hash. The caller waits on the receipt.
 * @throws {SymmError} when the chain is unsupported or no wallet is available.
 * @throws Viem's write errors (`ContractFunctionExecutionError`, ...).
 *
 * @example
 * ```ts
 * const hash = await cancelRegistration(config, { affiliate: "0xaff…" });
 * ```
 */
export async function cancelRegistration(
  config: Config,
  parameters: CancelRegistrationParameters,
): Promise<CancelRegistrationReturnType> {
  const { chainId, affiliate, from } = parameters;

  const { addresses } = config.getChainConfig(chainId);
  const walletClient = await config.getWalletClient({ chainId, from });

  if (shouldSimulateBeforeWrite(config, parameters)) {
    await simulateCancelRegistration(config, { chainId, affiliate, from: walletClient.account.address });
  }

  return walletClient.writeContract({
    address: addresses.accountLayerAddress,
    abi: accountLayerAbi,
    functionName: "cancelRegistration",
    args: [affiliate],
    account: walletClient.account,
    chain: walletClient.chain,
  });
}
