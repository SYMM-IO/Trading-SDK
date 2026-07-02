import type { Address } from "viem";
import type { Config } from "../../core/config";
import { SymmError } from "../../shared/errors/symm-error";
import type { Compute, WriteSolverParameter } from "../../shared/types/properties";
import { rethrowTpSlError } from "../internal/axios";
import { resolveTpSlConfig } from "../internal/resolve-tpsl-config";
import { buildTpSlDeleteMessage } from "../set-quote-tpsl/build-conditional-order-message";
import { signTpSlRequest } from "../set-quote-tpsl/sign-tpsl-request";
import { getTpSlDeleteSigningSpec } from "../signing-spec/get-tpsl-delete-signing-spec";
import type { TpSlConditionalOrderType } from "../types";
import { deleteConditionalOrderV5ApiV5Delete, type ConditionalOrderOperationV5 } from "../types/generated/tpsl-handler";

/** Parameters for {@link deleteQuoteTpSl}. */
export type DeleteQuoteTpSlParameters = Compute<
  WriteSolverParameter & {
    /** On-chain quote id the order belongs to (used for cache invalidation). */
    quoteId: bigint;
    /** PartyA (the VA address) that owns the quote. */
    virtualAccount: Address;
    /** Handler-issued conditional-order id targeted by the delete. */
    cohQuoteId: string;
    /** Which side is being canceled. */
    conditionalOrderType: TpSlConditionalOrderType;
  }
>;

/** Return type of {@link deleteQuoteTpSl}. */
export interface DeleteQuoteTpSlReturnType {
  success: true;
}

/**
 * Cancel a live TP or SL order by its handler-issued `cohQuoteId`.
 *
 * Steps:
 * 1. Resolve the TP/SL handler URL + DELETE signing spec.
 * 2. Build a {@link TpSlDeleteMessage} bound to the target cohQuoteId + side.
 * 3. Sign with the session-key wallet.
 * 4. DELETE `/api/v5/` with `{ typedData, signature, signer }`.
 *
 * The handler returns 200 on accept — the cancel is only fully "confirmed"
 * once the WebSocket reports `state: "cancel"` (or `canceled` / `cancelled`).
 * Callers should subscribe via `watchTpSlNotifications` and reconcile.
 *
 * @throws {SymmError} when the chain has no `tpsl` config or signing fails.
 * @throws {SymmApiError} when the handler request fails.
 */
export async function deleteQuoteTpSl(
  config: Config,
  parameters: DeleteQuoteTpSlParameters,
): Promise<DeleteQuoteTpSlReturnType> {
  const tpsl = resolveTpSlConfig(config, parameters.chainId);
  const signingSpec = await getTpSlDeleteSigningSpec(config, { chainId: parameters.chainId });

  const message = buildTpSlDeleteMessage({
    virtualAccount: parameters.virtualAccount,
    cohQuoteId: parameters.cohQuoteId,
    conditionalOrderType: parameters.conditionalOrderType,
  });

  const walletClient = await config.getWalletClient({ chainId: parameters.chainId, from: parameters.from });
  const signed = await signTpSlRequest({ signingSpec, message, walletClient });

  try {
    const response = await deleteConditionalOrderV5ApiV5Delete(signed as unknown as ConditionalOrderOperationV5, {
      baseURL: tpsl.url,
      headers: { "App-Name": tpsl.appName, "Content-Type": "application/json", Accept: "application/json" },
    });
    const body = response.data ?? {};
    const successful = typeof body.successful === "string" ? body.successful !== "false" : body.successful !== false;
    if (!successful) {
      throw new SymmError("api", "DELETE_TPSL_REJECTED", body.message ?? "Handler rejected TP/SL delete.");
    }
    return { success: true };
  } catch (err) {
    return rethrowTpSlError(err, { code: "DELETE_TPSL_FAILED", baseURL: tpsl.url });
  }
}
