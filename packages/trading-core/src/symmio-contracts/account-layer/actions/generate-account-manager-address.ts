import type { Address } from "viem";
import type { Config } from "../../../core/config";
import type { ChainIdParameter, Compute } from "../../../shared/types/properties";
import { accountLayerAbi } from "../../abi/v0.8.5/account-layer";

/**
 * Parameters for {@link generateAccountManagerAddress}.
 */
export type GenerateAccountManagerAddressParameters = Compute<
  ChainIdParameter & {
    /** The address that would submit the registration (`msg.sender` of the request). */
    registrant: Address;
    /** The affiliate name that would be registered. Part of the address salt. */
    name: string;
  }
>;

/** Return type of {@link generateAccountManagerAddress}: the predicted affiliate address. */
export type GenerateAccountManagerAddressReturnType = Address;

/**
 * Predict the deterministic affiliate (`AccountManager`) address for a
 * `(registrant, name)` pair — the same CREATE2 address
 * {@link requestToRegisterAffiliate} would assign.
 *
 * Pure view call; usable **before** registering to show the future affiliate
 * address, and after, since the value is deterministic. Resolves the viem client
 * and `AccountLayer` address from `config`.
 *
 * @param config - The SDK config.
 * @param parameters - Prospective registrant, affiliate name, optional chain id.
 * @returns The deterministic affiliate address for that registrant + name.
 * @throws {SymmError} when the chain is not supported.
 * @throws Viem's `ContractFunctionExecutionError` and friends for on-chain failures.
 *
 * @example
 * ```ts
 * const predicted = await generateAccountManagerAddress(config, {
 *   registrant: "0xme…",
 *   name: "Acme",
 * });
 * ```
 */
export async function generateAccountManagerAddress(
  config: Config,
  parameters: GenerateAccountManagerAddressParameters,
): Promise<GenerateAccountManagerAddressReturnType> {
  const { chainId, registrant, name } = parameters;

  const { addresses } = config.getChainConfig(chainId);
  const client = config.getClient({ chainId });

  const result = await client.readContract({
    address: addresses.accountLayerAddress,
    abi: accountLayerAbi,
    functionName: "generateAccountManagerAddress",
    args: [registrant, name],
  });

  return result;
}
