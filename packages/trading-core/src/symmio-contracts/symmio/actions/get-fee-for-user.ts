import type { Address } from "viem";
import type { Config } from "../../../core/config";
import type { ChainIdParameter, Compute } from "../../../shared/types/properties";
import { symmioAbi } from "../../abi/v0.8.5/symmio";

/** Fee settings returned by SYMMIO for a user, affiliate, and symbol id. */
export interface FeeForUser {
  /** Opening fee rate in 18-decimal fixed point units. */
  openFee: bigint;
  /** Closing fee rate in 18-decimal fixed point units. */
  closeFee: bigint;
  /** Whether the contract has an explicit fee entry for the pair. */
  isSet: boolean;
}

/**
 * Parameters for {@link getFeeForUser}.
 */
export type GetFeeForUserParameters = Compute<
  ChainIdParameter & {
    /** Affiliate address used by the fee lookup. Defaults to the chain config affiliate. */
    affiliate?: Address;
    /** User/account address passed to `getFeeForUser`. */
    user: Address;
    /** SYMMIO symbol id passed to `getFeeForUser`. */
    symbolId: bigint | number;
  }
>;

/** Return type of {@link getFeeForUser}: normalized fee tuple fields. */
export type GetFeeForUserReturnType = FeeForUser;

/**
 * Read the SYMMIO fee configuration for a user and symbol.
 *
 * If `affiliate` is omitted, the chain config's `addresses.affiliatesAddress`
 * is used. Fee values are raw 18-decimal fixed point rates from the contract.
 *
 * @param config - The SDK config.
 * @param parameters - User/account, symbol id, optional affiliate, and optional chain id.
 * @returns The open fee, close fee, and `isSet` flag.
 * @throws {SymmError} when the chain is not supported.
 * @throws Viem's `ContractFunctionExecutionError` and friends for on-chain failures.
 *
 * @example
 * ```ts
 * const fee = await getFeeForUser(config, { user, symbolId: 1n });
 * console.log(fee.openFee);
 * ```
 */
export async function getFeeForUser(
  config: Config,
  parameters: GetFeeForUserParameters,
): Promise<GetFeeForUserReturnType> {
  const { chainId, affiliate, user, symbolId } = parameters;

  const { addresses } = config.getChainConfig(chainId);
  const client = config.getClient({ chainId });

  const fee = await client.readContract({
    address: addresses.symmioAddress,
    abi: symmioAbi,
    functionName: "getFeeForUser",
    args: [affiliate ?? addresses.affiliatesAddress, user, BigInt(symbolId)],
  });

  return {
    openFee: fee.openFee,
    closeFee: fee.closeFee,
    isSet: fee.isSet,
  };
}
