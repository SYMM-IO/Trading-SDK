import type { Address, Hex } from "viem";
import type { Config } from "../../../core/config";
import type { Compute, WriteSolverParameter } from "../../../shared/types/properties";
import { buildSignedOperation, signAndFormatInstantOperation } from "../../instant-open/shared/operations";
import { getMarketOrderDeadline } from "../../instant-open/shared/trade-math";
import { encodeRequestToClosePosition } from "../shared/calldata";
import { sendInstantClose } from "../shared/hedger-api";
import { ORDER_TYPE_MARKET, type InstantCloseOrder, type InstantCloseReturnType } from "../shared/types";

/**
 * Parameters for the pure {@link instantClose} primitive.
 *
 * Every domain value is the **final** 18-decimal-wei `bigint` ready to feed
 * `requestToClosePosition`. The caller (or the `prepareInstantCloseParams`
 * wizard) is responsible for trade math.
 */
export type InstantCloseParameters = Compute<
  WriteSolverParameter & {
    /** PartyA — the VA address that owns the position (EIP-712 `signerAccount`). */
    partyA: Address;
    /** Order-side values (`quoteId`, `closePrice`, `quantityToClose`). */
    order: InstantCloseOrder;
    /** Override the EIP-712 salt. Defaults to a random 32-byte salt. */
    salt?: Hex;
    /** Override the unix-seconds deadline (defaults to `now + 300s`). */
    deadline?: bigint;
  }
>;

/**
 * Close (or partially close) a lowcap instant position via the InstantLayer
 * v2 flow.
 *
 * Pure primitive — every domain value is already final wei. Builds calldata
 * for one `requestToClosePosition`, signs an EIP-712 `SignedOperation`, and
 * submits it to the chain's solver/hedger `/instant_trade/instant_close`
 * endpoint. Does no math, no fetching.
 *
 * Use `prepareInstantCloseParams` to derive this shape from UI-shape inputs,
 * or `instantCloseAuto` for the combined convenience.
 *
 * @throws {SymmApiError} when the hedger request fails.
 *
 * @example
 * ```ts
 * const { success } = await instantClose(config, {
 *   partyA,
 *   order: {
 *     quoteId: 42n,
 *     closePrice: 50_000_000_000_000_000_000n,
 *     quantityToClose: 1_000_000_000_000_000_000n,
 *   },
 * });
 * ```
 */
export async function instantClose(
  config: Config,
  parameters: InstantCloseParameters,
): Promise<InstantCloseReturnType> {
  const chainConfig = config.getChainConfig(parameters.chainId);
  const { symmioAddress } = chainConfig.addresses;

  const walletClient = await config.getWalletClient({ chainId: parameters.chainId, from: parameters.from });
  const signerAddress = walletClient.account.address;

  const deadline = parameters.deadline ?? getMarketOrderDeadline();

  const callData = encodeRequestToClosePosition({
    quoteId: parameters.order.quoteId,
    closePrice: parameters.order.closePrice,
    quantityToClose: parameters.order.quantityToClose,
    orderType: ORDER_TYPE_MARKET,
    deadline,
  });

  const operation = buildSignedOperation({
    signer: signerAddress,
    target: symmioAddress,
    callData,
    signerAccount: parameters.partyA,
    deadline,
    salt: parameters.salt,
  });

  const signed = await signAndFormatInstantOperation(config, {
    operation,
    chainId: parameters.chainId,
    walletClient,
  });

  await sendInstantClose(config, {
    chainId: parameters.chainId,
    solverId: parameters.solverId,
    operations: [signed],
  });

  return { success: true };
}
