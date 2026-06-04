import type { Address } from "viem";
import type { Config } from "../../../core/config";
import type { ChainIdParameter, Compute } from "../../../shared/types/properties";
import { accountLayerAbi } from "../../abi/v0.8.5/account-layer";
import type { SubAccountDetail } from "../types";

/**
 * Parameters for {@link getSubAccount}.
 */
export type GetSubAccountParameters = Compute<
  ChainIdParameter & {
    /** The subaccount address to read. */
    account: Address;
  }
>;

/** Return type of {@link getSubAccount}. */
export type GetSubAccountReturnType = SubAccountDetail;

/**
 * Read a single SYMMIO subaccount by its address.
 *
 * Resolves the viem client and `AccountLayer` address from `config` for the
 * given chain (or the config's default chain when `chainId` is omitted).
 *
 * @param config - The SDK config.
 * @param parameters - Subaccount address, optional chain id.
 * @returns The subaccount's on-chain detail. `isExists` is `false` for an unknown
 *   or deleted subaccount.
 * @throws {SymmError} when the chain is not supported.
 * @throws Viem's `ContractFunctionExecutionError` and friends for on-chain failures.
 *
 * @example
 * ```ts
 * const sub = await getSubAccount(config, { account: "0xsub…" });
 * ```
 */
export async function getSubAccount(
  config: Config,
  parameters: GetSubAccountParameters,
): Promise<GetSubAccountReturnType> {
  const { chainId, account } = parameters;

  const { addresses } = config.getChainConfig(chainId);
  const client = config.getClient({ chainId });

  const result = await client.readContract({
    address: addresses.accountLayerAddress,
    abi: accountLayerAbi,
    functionName: "getSubAccount",
    args: [account],
  });

  return result;
}
