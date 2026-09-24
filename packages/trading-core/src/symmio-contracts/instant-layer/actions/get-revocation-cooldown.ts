import type { Config } from "../../../core/config";
import type { ChainIdParameter, Compute } from "../../../shared/types/properties";
import { instantLayerAbi } from "../../abi/v0.8.6/instant-layer";

/**
 * Parameters for {@link getRevocationCooldown}.
 */
export type GetRevocationCooldownParameters = Compute<ChainIdParameter>;

/** Return type of {@link getRevocationCooldown}: the cooldown in seconds. */
export type GetRevocationCooldownReturnType = bigint;

/**
 * Read the Instant Layer's global delegation revocation cooldown, in seconds.
 *
 * This is the delay the two-step revocation enforces.
 * {@link initiateRevokeDelegation} stamps
 * `pendingRevocationEta = block.timestamp + revocationCooldown`;
 * {@link finalizeRevokeDelegation} reverts until that ETA passes, and only then
 * clears the stored grant.
 *
 * **The value is the size of the residual authority window.** Between the
 * initiate and the ETA the delegation is still enforced — `isDelegationActive`
 * keeps returning `true` and the delegate can keep acting — so a UI must show
 * the revocation as *pending*, never as done, for exactly this long. Read the
 * per-delegation `pendingRevocationEta(delegator, delegate, selector)` mapping
 * on the InstantLayer to know when a specific revocation lands; this value only
 * tells you how long a freshly-initiated one will take.
 *
 * The cooldown is a contract-level parameter, not per account, so it is the
 * same for every delegator on the chain and is safe to cache for a long time.
 *
 * @param config - The SDK config.
 * @param parameters - Optional chain id.
 * @returns The cooldown in seconds.
 * @throws {SymmError} when the chain is unsupported.
 * @throws Viem read errors.
 *
 * @example
 * ```ts
 * const cooldown = await getRevocationCooldown(config);
 * // The key keeps acting for this long after the revocation is initiated.
 * const hours = Number(cooldown) / 3600;
 * ```
 */
export async function getRevocationCooldown(
  config: Config,
  parameters: GetRevocationCooldownParameters = {},
): Promise<GetRevocationCooldownReturnType> {
  const { chainId } = parameters;

  const { addresses } = config.getChainConfig(chainId);
  const client = config.getClient({ chainId });

  return client.readContract({
    address: addresses.instantLayerAddress,
    abi: instantLayerAbi,
    functionName: "revocationCooldown",
  });
}
