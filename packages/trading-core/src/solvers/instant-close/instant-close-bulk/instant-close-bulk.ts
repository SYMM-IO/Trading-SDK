import type { Address, Hex } from "viem";
import type { Config } from "../../../core/config";
import { SymmError } from "../../../shared/errors/symm-error";
import type { Compute, WriteSolverParameter } from "../../../shared/types/properties";
import { buildSignedOperation, signAndFormatInstantOperation } from "../../instant-open/shared/operations";
import { getMarketOrderDeadline } from "../../instant-open/shared/trade-math";
import { encodeRequestToClosePosition } from "../shared/calldata";
import { sendInstantClose } from "../shared/hedger-api";
import { ORDER_TYPE_MARKET, type InstantCloseOrder } from "../shared/types";

/** Maximum orders per {@link instantCloseBulk} call (matches the hedger's `1–100` window). */
export const MAX_INSTANT_CLOSE_BULK_ORDERS = 100;

/**
 * One position contributing to a {@link instantCloseBulk} batch. Each entry is
 * already fully-resolved: a VA address, the wei-shape order, and optional
 * per-order salt / deadline overrides.
 */
export interface InstantCloseBulkOrder {
  /** PartyA — the VA that owns the position (EIP-712 `signerAccount`). */
  partyA: Address;
  /** Already-final wei order (`quoteId`, `closePrice`, `quantityToClose`). */
  order: InstantCloseOrder;
  /** Override the EIP-712 salt for this order. Defaults to a random 32-byte salt. */
  salt?: Hex;
  /** Override the unix-seconds deadline for this order. Defaults to `now + 300s`. */
  deadline?: bigint;
}

/**
 * Parameters for {@link instantCloseBulk}.
 *
 * The wallet client identified by `from` is reused to sign every order, so all
 * orders in a batch share the same signer (the subaccount-level session key).
 * Each order may still target a different VA via its own `partyA` — the
 * delegation lives on the subaccount and is inherited by every owned VA.
 */
export type InstantCloseBulkParameters = Compute<
  WriteSolverParameter & {
    /** Orders to submit. Length must be in `[1, MAX_INSTANT_CLOSE_BULK_ORDERS]`. */
    orders: readonly InstantCloseBulkOrder[];
  }
>;

/** Return type of {@link instantCloseBulk}. */
export interface InstantCloseBulkReturnType {
  /** Number of orders submitted. */
  count: number;
  /** Always `true` on success — the hedger returns no per-order body. */
  success: true;
}

/**
 * Close multiple lowcap positions in one solver round-trip via the InstantLayer
 * v2 `/instant_trade/instant_close` endpoint, which natively accepts 1–100
 * signed operations per request.
 *
 * Each order is signed with the same wallet client (the session key bound to
 * `from`), so the caller must hold a `requestToClosePosition` delegation on
 * the owning subaccount. The delegation is inherited by every owned VA, so
 * orders across different VAs in the same subaccount sign with one key.
 *
 * Pure primitive — every domain value is already final wei. Use
 * `instantCloseBulkAuto` to derive these inputs from UI-shape parameters.
 *
 * @throws {SymmError} `INSTANT_CLOSE_BULK_INVALID_ORDERS` when the batch is
 *   empty or exceeds {@link MAX_INSTANT_CLOSE_BULK_ORDERS}.
 * @throws {SymmApiError} when the hedger request fails — the whole batch is
 *   rejected; the caller should retry with fewer orders.
 *
 * @example
 * ```ts
 * await instantCloseBulk(config, {
 *   from: sessionKey,
 *   orders: [
 *     { partyA: vaA, order: { quoteId: 1n, closePrice: …, quantityToClose: … } },
 *     { partyA: vaB, order: { quoteId: 2n, closePrice: …, quantityToClose: … } },
 *   ],
 * });
 * ```
 */
export async function instantCloseBulk(
  config: Config,
  parameters: InstantCloseBulkParameters,
): Promise<InstantCloseBulkReturnType> {
  if (parameters.orders.length === 0) {
    throw new SymmError(
      "validation",
      "INSTANT_CLOSE_BULK_INVALID_ORDERS",
      "instantCloseBulk: at least one order is required.",
    );
  }
  if (parameters.orders.length > MAX_INSTANT_CLOSE_BULK_ORDERS) {
    throw new SymmError(
      "validation",
      "INSTANT_CLOSE_BULK_INVALID_ORDERS",
      `instantCloseBulk: at most ${MAX_INSTANT_CLOSE_BULK_ORDERS} orders per call; received ${parameters.orders.length}.`,
    );
  }

  const chainConfig = config.getChainConfig(parameters.chainId);
  const { symmioAddress } = chainConfig.addresses;

  const walletClient = await config.getWalletClient({ chainId: parameters.chainId, from: parameters.from });
  const signerAddress = walletClient.account.address;

  const signedOperations = [] as Awaited<ReturnType<typeof signAndFormatInstantOperation>>[];
  for (const entry of parameters.orders) {
    const deadline = entry.deadline ?? getMarketOrderDeadline();

    const callData = encodeRequestToClosePosition({
      quoteId: entry.order.quoteId,
      closePrice: entry.order.closePrice,
      quantityToClose: entry.order.quantityToClose,
      orderType: ORDER_TYPE_MARKET,
      deadline,
    });

    const operation = buildSignedOperation({
      signer: signerAddress,
      target: symmioAddress,
      callData,
      signerAccount: entry.partyA,
      deadline,
      salt: entry.salt,
    });

    const signed = await signAndFormatInstantOperation(config, {
      operation,
      chainId: parameters.chainId,
      walletClient,
    });
    signedOperations.push(signed);
  }

  await sendInstantClose(config, {
    chainId: parameters.chainId,
    // Forward the resolved solver so a bulk close on a rasa chain hits its own
    // endpoint instead of falling back to the chain default.
    solverId: parameters.solverId,
    operations: signedOperations,
  });

  return { count: signedOperations.length, success: true };
}
