import type { Address } from "viem";
import type { Config } from "../../../core/config";
import type { ChainIdParameter, Compute } from "../../../shared/types/properties";
import { symmioAbi } from "../../abi/v0.8.6/symmio";

/**
 * Parameters for {@link isPartyALiquidated}.
 */
export type IsPartyALiquidatedParameters = Compute<
  ChainIdParameter & {
    /** The partyA (virtual account, lowcap; or the sub-account, cross-margin) to check. */
    partyA: Address;
  }
>;

/** Return type of {@link isPartyALiquidated}: `true` while a liquidation is in progress. */
export type IsPartyALiquidatedReturnType = boolean;

/**
 * Read whether a partyA is **in liquidation** right now.
 *
 * The flag turns `true` when a liquidator starts the partyA's liquidation (the
 * account was proven insolvent) and back to `false` once that liquidation is
 * settled and finalized. It is not a "was ever liquidated" history flag. While it
 * is `true` the account is frozen: solvers cannot fill or open against it and
 * most partyA actions revert, while its quotes still appear in
 * `getPartyAOpenPositions` (typically as `LIQUIDATED_PENDING`).
 *
 * @param config - The SDK config.
 * @param parameters - PartyA and optional chain id.
 * @returns `true` while the partyA's liquidation is in progress.
 * @throws {SymmError} when the chain is not supported.
 * @throws Viem's `ContractFunctionExecutionError` and friends for on-chain failures.
 *
 * @example
 * ```ts
 * if (await isPartyALiquidated(config, { partyA: "0xva…" })) {
 *   // hide the account's positions: every action on them would revert
 * }
 * ```
 */
export async function isPartyALiquidated(
  config: Config,
  parameters: IsPartyALiquidatedParameters,
): Promise<IsPartyALiquidatedReturnType> {
  const { chainId, partyA } = parameters;

  const { addresses } = config.getChainConfig(chainId);
  const client = config.getClient({ chainId });

  return client.readContract({
    address: addresses.symmioAddress,
    abi: symmioAbi,
    functionName: "isPartyALiquidated",
    args: [partyA],
  });
}
