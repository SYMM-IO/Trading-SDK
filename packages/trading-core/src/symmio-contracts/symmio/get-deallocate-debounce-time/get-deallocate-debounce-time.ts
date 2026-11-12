import type { Config } from "../../../core/config";
import type { ChainIdParameter, Compute } from "../../../shared/types/properties";
import { symmioAbi } from "../../abi/v0.8.6/symmio";

/** Parameters for {@link getDeallocateDebounceTime}. */
export type GetDeallocateDebounceTimeParameters = Compute<ChainIdParameter>;

/** Protocol deallocation debounce duration in seconds. */
export type GetDeallocateDebounceTimeReturnType = bigint;

/**
 * Read the protocol's configured deallocation debounce duration.
 *
 * @param config - SDK configuration.
 * @param parameters - Optional chain ID.
 * @returns Raw duration in seconds; zero is a valid configured value.
 * @throws {SymmError} when the chain is not supported.
 * @throws Viem's `ContractFunctionExecutionError` and friends for on-chain failures.
 *
 * @example
 * ```ts
 * const duration = await getDeallocateDebounceTime(config);
 * ```
 */
export async function getDeallocateDebounceTime(
  config: Config,
  parameters: GetDeallocateDebounceTimeParameters = {},
): Promise<GetDeallocateDebounceTimeReturnType> {
  const { chainId } = parameters;

  const { addresses } = config.getChainConfig(chainId);
  const client = config.getClient({ chainId });

  return client.readContract({
    address: addresses.symmioAddress,
    abi: symmioAbi,
    functionName: "getDeallocateDebounceTime",
  });
}
