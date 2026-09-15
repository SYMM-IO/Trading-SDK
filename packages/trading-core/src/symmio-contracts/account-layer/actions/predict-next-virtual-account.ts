import type { Address } from "viem";
import type { Config } from "../../../core/config";
import type { ChainIdParameter, Compute } from "../../../shared/types/properties";
import type { VirtualAccountIsolationType } from "../../../solvers/instant-open/shared/types";
import { accountLayerAbi } from "../../abi/v0.8.6/account-layer";

/**
 * Parameters for {@link getPredictedNextVirtualAccount}.
 */
export type GetPredictedNextVirtualAccountParameters = Compute<
  ChainIdParameter & {
    /** The subaccount that will own the next Virtual Account (VA). */
    subAccount: Address;
    /** Isolation mode the next VA will be created with — encodes side for `MARKET_LONG` / `MARKET_SHORT`. */
    isolationType: VirtualAccountIsolationType;
    /** Market identifier (`symbolId`) the next VA will trade. */
    symbolId: bigint;
  }
>;

/** Return type of {@link getPredictedNextVirtualAccount}: the predicted VA address. */
export type GetPredictedNextVirtualAccountReturnType = Address;

/**
 * Predict the deterministic address of the next Virtual Account (VA) a
 * subaccount would create for a given `(isolationType, symbolId)`.
 *
 * In lowcap, an instant-open isolates its position into a VA that does not exist
 * on-chain until the trade lands; the AccountLayer computes that VA's address up
 * front from `(subAccount, isolationType, symbolId)` and the subaccount's current
 * virtual nonce. Use this to surface a brand-new position's VA — e.g. as the
 * `partyA` for quote reads — before it is created.
 *
 * @remarks
 * The prediction is stable for a given `(subAccount, isolationType, symbolId)`
 * **only until the subaccount's virtual nonce advances** (i.e. until the next VA
 * is actually created). Treat the result as short-lived rather than fixed.
 *
 * @param config - The SDK config.
 * @param parameters - Subaccount, isolation type, market id, optional chain id.
 * @returns The predicted next VA address.
 * @throws {SymmError} when the chain is not supported.
 * @throws Viem's `ContractFunctionExecutionError` and friends for on-chain failures.
 *
 * @example
 * ```ts
 * const va = await getPredictedNextVirtualAccount(config, {
 *   subAccount: "0xsub…",
 *   isolationType: VIRTUAL_ACCOUNT_ISOLATION_TYPE.MARKET_LONG,
 *   symbolId: 1n,
 * });
 * ```
 */
export async function getPredictedNextVirtualAccount(
  config: Config,
  parameters: GetPredictedNextVirtualAccountParameters,
): Promise<GetPredictedNextVirtualAccountReturnType> {
  const { chainId, subAccount, isolationType, symbolId } = parameters;

  const { addresses } = config.getChainConfig(chainId);
  const client = config.getClient({ chainId });

  return client.readContract({
    address: addresses.accountLayerAddress,
    abi: accountLayerAbi,
    functionName: "predictNextVirtualAccountAddress",
    args: [subAccount, isolationType, symbolId],
  });
}
