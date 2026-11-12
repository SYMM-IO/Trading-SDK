import { isAddressEqual, zeroAddress, type Address } from "viem";
import type { Config } from "../../../core/config";
import type { ChainIdParameter, Compute } from "../../../shared/types/properties";
import type { VirtualAccountIsolationType } from "../../../solvers/instant-open/shared/types";
import { accountLayerAbi } from "../../abi/v0.8.6/account-layer";

/**
 * Parameters for {@link getActiveVirtualAccountByKey}.
 */
export type GetActiveVirtualAccountByKeyParameters = Compute<
  ChainIdParameter & {
    /** The parent subaccount. */
    subAccount: Address;
    /** Isolation bucket of the VA — use `isolationTypeForSide(positionType)` for a side. */
    isolationType: VirtualAccountIsolationType;
    /** Market identifier (`symbolId`). */
    symbolId: bigint;
  }
>;

/** Return type of {@link getActiveVirtualAccountByKey}: the active VA, or `null` when there is none. */
export type GetActiveVirtualAccountByKeyReturnType = Address | null;

/**
 * Read a subaccount's **active** Virtual Account (VA) for an isolation key
 * `(isolationType, symbolId)` — the VA that new quotes on that market (and side)
 * are routed into while the subaccount runs in single-VA mode
 * (`AccountLayer.getActiveVAByKey`).
 *
 * Unlike {@link getPredictedNextVirtualAccount}, which answers "where would the
 * next position go", this answers "which VA currently holds the position", and
 * returns `null` when no VA is active for the key.
 *
 * @param config - The SDK config.
 * @param parameters - Parent subaccount, isolation type, market id, optional chain id.
 * @returns The active VA address, or `null` when none is active.
 * @throws {SymmError} when the chain is not supported.
 * @throws Viem's `ContractFunctionExecutionError` and friends for on-chain failures.
 *
 * @example
 * ```ts
 * import { isolationTypeForSide, PositionType } from "@symmio/trading-core";
 *
 * const va = await getActiveVirtualAccountByKey(config, {
 *   subAccount,
 *   isolationType: isolationTypeForSide(PositionType.LONG),
 *   symbolId: 42n,
 * });
 * ```
 */
export async function getActiveVirtualAccountByKey(
  config: Config,
  parameters: GetActiveVirtualAccountByKeyParameters,
): Promise<GetActiveVirtualAccountByKeyReturnType> {
  const { chainId, subAccount, isolationType, symbolId } = parameters;
  const { addresses } = config.getChainConfig(chainId);

  const active = await config.getClient({ chainId }).readContract({
    address: addresses.accountLayerAddress,
    abi: accountLayerAbi,
    functionName: "getActiveVAByKey",
    args: [subAccount, isolationType, symbolId],
  });

  return isAddressEqual(active, zeroAddress) ? null : active;
}
