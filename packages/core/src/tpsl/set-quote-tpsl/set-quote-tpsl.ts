import { toDecimal } from "@symm-frontier/utils/decimal";
import type { Address } from "viem";
import type { Config } from "../../core/config";
import { SymmError } from "../../shared/errors/symm-error";
import type { Compute, WriteSolverParameter } from "../../shared/types/properties";
import { PositionType } from "../../symmio-contracts/symmio/types";
import { rethrowTpSlError } from "../internal/axios";
import { resolveTpSlConfig } from "../internal/resolve-tpsl-config";
import { getTpSlSigningSpec } from "../signing-spec/get-tpsl-signing-spec";
import { DEFAULT_TPSL_SLIPPAGE_LOWCAPS, priceSlippageCalculation } from "../slippage";
import type { TpSlConditionalOrderLeg, TpSlPriceType } from "../types";
import { conditionalOrderRequestV5ApiV5Post, type ConditionalOrderOperationV5 } from "../types/generated/tpsl-handler";
import { buildConditionalOrderLeg } from "./build-conditional-order-leg";
import { buildConditionalOrderMessage } from "./build-conditional-order-message";
import { signTpSlRequest } from "./sign-tpsl-request";

/**
 * One side (TP or SL) of a {@link setQuoteTpSl} call.
 */
export interface SetTpSlSide {
  /** Trigger price (decimal string). */
  triggerPrice: string;
  /** Mark vs last-close. */
  priceType: TpSlPriceType;
}

/**
 * Parameters for {@link setQuoteTpSl}.
 */
export type SetQuoteTpSlParameters = Compute<
  WriteSolverParameter & {
    /** On-chain quote id. */
    quoteId: bigint;
    /** PartyA (the VA address) that owns the quote. */
    virtualAccount: Address;
    /** SubAccount that owns the VA. */
    subAccount: Address;
    /** Solver market id. */
    symbolId: bigint;
    /** Quote direction. */
    positionType: PositionType;
    /** Quote quantity (decimal string). */
    quantity: string;
    /** Market price precision (rounds prices to N decimals). */
    pricePrecision: number;
    /**
     * Affiliate to bind to the order. Defaults to
     * `chainConfig.addresses.affiliatesAddress`.
     */
    affiliate?: Address;
    /**
     * Slippage percent applied when deriving each leg's `price`. Defaults to
     * {@link DEFAULT_TPSL_SLIPPAGE_LOWCAPS}.
     */
    slippage?: number;
    /** Take-profit side. Omit to skip TP. */
    tp?: SetTpSlSide;
    /** Stop-loss side. Omit to skip SL. */
    sl?: SetTpSlSide;
  }
>;

/** Return type of {@link setQuoteTpSl}. */
export interface SetQuoteTpSlReturnType {
  success: true;
  /** Handler-issued conditional-order id (when reported on the response). */
  cohQuoteId?: string;
}

/**
 * Submit a TP and/or SL order to the handler.
 *
 * Steps:
 * 1. Resolve the TP/SL handler URL + signing spec for the chain.
 * 2. Round trigger prices and compute slippage-shifted "opened" prices via
 *    {@link priceSlippageCalculation}.
 * 3. Build a {@link TpSlConditionalOrderMessage} with non-null legs only.
 * 4. Sign it with the session-key wallet client (`config.getWalletClient`).
 * 5. POST `{ typedData, signature, signer }` to the handler.
 *
 * The handler returns 200 on accept but the order is only "confirmed" once
 * the WebSocket reports `state: "new"`; callers should subscribe via
 * `watchTpSlNotifications` and reconcile.
 *
 * @throws {SymmError} when the chain has no `tpsl` config, both `tp` and `sl`
 *   are omitted, or signing fails.
 * @throws {SymmApiError} when the handler request fails.
 */
export async function setQuoteTpSl(
  config: Config,
  parameters: SetQuoteTpSlParameters,
): Promise<SetQuoteTpSlReturnType> {
  if (!parameters.tp && !parameters.sl) {
    throw new SymmError(
      "validation",
      "SET_TPSL_NOTHING_TO_SUBMIT",
      "setQuoteTpSl: at least one of `tp` or `sl` must be provided.",
    );
  }

  const chainConfig = config.getChainConfig(parameters.chainId);
  const tpsl = resolveTpSlConfig(config, parameters.chainId);
  const affiliate = parameters.affiliate ?? chainConfig.addresses.affiliatesAddress;
  const slippage = parameters.slippage ?? DEFAULT_TPSL_SLIPPAGE_LOWCAPS;

  const signingSpec = await getTpSlSigningSpec(config, { chainId: parameters.chainId });

  const tpLeg: TpSlConditionalOrderLeg | null = parameters.tp
    ? buildConditionalOrderLeg({
        quantity: parameters.quantity,
        price: priceSlippageCalculation(
          parameters.tp.triggerPrice,
          slippage,
          parameters.positionType,
          parameters.pricePrecision,
        ),
        conditionalPrice: toDecimal(parameters.tp.triggerPrice).toFixed(parameters.pricePrecision),
        priceType: parameters.tp.priceType,
      })
    : null;

  const slLeg: TpSlConditionalOrderLeg | null = parameters.sl
    ? buildConditionalOrderLeg({
        quantity: parameters.quantity,
        price: priceSlippageCalculation(
          parameters.sl.triggerPrice,
          slippage,
          parameters.positionType,
          parameters.pricePrecision,
        ),
        conditionalPrice: toDecimal(parameters.sl.triggerPrice).toFixed(parameters.pricePrecision),
        priceType: parameters.sl.priceType,
      })
    : null;

  const message = buildConditionalOrderMessage({
    virtualAccount: parameters.virtualAccount,
    subAccount: parameters.subAccount,
    quoteId: Number(parameters.quoteId),
    symbolId: Number(parameters.symbolId),
    positionType: parameters.positionType === PositionType.LONG ? 0 : 1,
    affiliate,
    takeProfit: tpLeg,
    stopLoss: slLeg,
  });

  const walletClient = await config.getWalletClient({ chainId: parameters.chainId, from: parameters.from });
  const signed = await signTpSlRequest({ signingSpec, message, walletClient });

  try {
    const response = await conditionalOrderRequestV5ApiV5Post(signed as unknown as ConditionalOrderOperationV5, {
      baseURL: tpsl.url,
      headers: { "App-Name": tpsl.appName, "Content-Type": "application/json", Accept: "application/json" },
    });
    const body = response.data ?? {};
    const successful = typeof body.successful === "string" ? body.successful !== "false" : body.successful !== false;
    if (!successful) {
      throw new SymmError("api", "SET_TPSL_REJECTED", body.message ?? "Handler rejected TP/SL submission.");
    }
    const extra = body as { coh_quote_id?: string; cohQuoteId?: string };
    return { success: true, cohQuoteId: extra.coh_quote_id ?? extra.cohQuoteId };
  } catch (err) {
    return rethrowTpSlError(err, { code: "SET_TPSL_FAILED", baseURL: tpsl.url });
  }
}
