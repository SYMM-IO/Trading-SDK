import type { Address } from "viem";
import type { Config } from "../../../core/config";
import type { ChainIdParameter, Compute } from "../../../shared/types/properties";
import { symmioAbi } from "../../abi/v0.8.5/symmio";
import type { AccountBalanceInfo } from "../types";

/**
 * Parameters for {@link getAccountBalanceInfo}.
 */
export type GetAccountBalanceInfoParameters = Compute<
  ChainIdParameter & {
    /** Account address passed as `partyA` to `balanceInfoOfPartyA`. */
    account: Address;
  }
>;

/** Return type of {@link getAccountBalanceInfo}. */
export type GetAccountBalanceInfoReturnType = AccountBalanceInfo;

/**
 * Read raw balance info for a SYMMIO account from `balanceInfoOfPartyA`.
 *
 * Resolves the viem client and default SYMMIO core/diamond address from
 * `config`.
 *
 * @param config - The SDK config.
 * @param parameters - Account address and optional chain id.
 * @returns Raw allocated/locked/pending balance fields in collateral token units.
 * @throws {SymmError} when the chain is not supported.
 * @throws Viem's `ContractFunctionExecutionError` and friends for on-chain failures.
 *
 * @example
 * ```ts
 * const info = await getAccountBalanceInfo(config, { account });
 * console.log(info.allocatedBalance);
 * ```
 */
export async function getAccountBalanceInfo(
  config: Config,
  parameters: GetAccountBalanceInfoParameters,
): Promise<GetAccountBalanceInfoReturnType> {
  const { chainId, account } = parameters;

  const { addresses } = config.getChainConfig(chainId);
  const client = config.getClient({ chainId });

  const result = await client.readContract({
    address: addresses.symmioAddress,
    abi: symmioAbi,
    functionName: "balanceInfoOfPartyA",
    args: [account],
  });

  return {
    allocatedBalance: result[0],
    lockedCVA: result[1],
    lockedLF: result[2],
    lockedPartyAMM: result[3],
    lockedPartyBMM: result[4],
    pendingLockedCVA: result[5],
    pendingLockedLF: result[6],
    pendingLockedPartyAMM: result[7],
    pendingLockedPartyBMM: result[8],
  };
}
