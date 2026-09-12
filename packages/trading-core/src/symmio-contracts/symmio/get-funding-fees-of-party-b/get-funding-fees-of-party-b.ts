import type { Address } from "viem";
import type { Config } from "../../../core/config";
import type { ChainIdParameter, Compute } from "../../../shared/types/properties";
import { symmioAbi } from "../../abi/v0.8.6/symmio";
import type { FundingFee } from "./types";

/**
 * Parameters for {@link getFundingFeesOfPartyB}.
 */
export type GetFundingFeesOfPartyBParameters = Compute<
  ChainIdParameter & {
    /** SYMMIO symbol id of the market. */
    symbolId: bigint;
    /** The solver (partyB) whose funding state to read — each partyB sets its own rates per symbol. */
    partyB: Address;
  }
>;

/** Return type of {@link getFundingFeesOfPartyB}: the pair's {@link FundingFee} state. */
export type GetFundingFeesOfPartyBReturnType = FundingFee;

/**
 * Read the accumulated-funding state a solver (partyB) keeps for one symbol —
 * the diamond's `FundingFee` struct: current and weighted-average rates, epoch
 * tracking and carried-over fee snapshots.
 *
 * Values are returned exactly as the contract stores them: rates are
 * **cost-positive** (a positive long/short value means that side pays), and
 * `epochDuration` / `startEpoch` / `startEpochTimeStamp` tell whether the pair
 * accrues accumulated funding at all (see {@link FundingFee}). A pair that was
 * never configured reads as an all-zero struct rather than reverting.
 *
 * Behaves the same on v0.8.5 and v0.8.6 chains: the view's inputs and outputs
 * are identical in both generations.
 *
 * @param config - The SDK config.
 * @param parameters - Symbol id, partyB address, optional chain id.
 * @returns The pair's funding state.
 * @throws {SymmError} when the chain is not supported.
 * @throws Viem's `ContractFunctionExecutionError` and friends for on-chain failures.
 *
 * @example
 * ```ts
 * const fee = await getFundingFeesOfPartyB(config, { symbolId: 1n, partyB });
 * const accruing = fee.epochDuration > 0n && (fee.startEpoch !== 0n || fee.startEpochTimeStamp !== 0n);
 * ```
 */
export async function getFundingFeesOfPartyB(
  config: Config,
  parameters: GetFundingFeesOfPartyBParameters,
): Promise<GetFundingFeesOfPartyBReturnType> {
  const { chainId, symbolId, partyB } = parameters;

  const { addresses } = config.getChainConfig(chainId);
  const client = config.getClient({ chainId });

  return client.readContract({
    address: addresses.symmioAddress,
    abi: symmioAbi,
    functionName: "getFundingFeesOfPartyB",
    args: [symbolId, partyB],
  });
}
