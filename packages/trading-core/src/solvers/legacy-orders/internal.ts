import axios, { isAxiosError, type AxiosRequestConfig } from "axios";
import type { Config } from "../../core/config";
import { SymmApiError, SymmError } from "../../shared/errors/symm-error";
import { assertSolverKind } from "../assert-solver-kind";
import type { LegacyConditionalOrder, LegacyConditionalOrderInput, LegacyOrderParameters } from "./types";

/** Private compatibility wire schema; public results use camelCase. */
export interface LegacyOrderWire {
  id: string;
  account: string;
  va_address?: string;
  symbol_id: number;
  conditional_order_type: LegacyConditionalOrderInput["conditionalOrderType"];
  quantity: string;
  trigger_price: string;
  limit_price?: string;
  side: "long" | "short";
  quote_id?: number;
  status?: LegacyConditionalOrder["status"];
  created_at: number;
  executed_at?: number;
  state?: string;
  close_status?: string | null;
  modify_time?: number;
  coh_quote_id?: string;
  cohQuoteId?: string;
  conditional_order_price?: number;
  price?: number;
  action_price_type?: string;
}

export function toLegacyOrder(raw: LegacyOrderWire): LegacyConditionalOrder {
  return {
    id: raw.id,
    account: raw.account,
    vaAddress: raw.va_address,
    symbolId: raw.symbol_id,
    conditionalOrderType: raw.conditional_order_type,
    quantity: raw.quantity,
    triggerPrice: raw.trigger_price,
    limitPrice: raw.limit_price,
    side: raw.side,
    quoteId: raw.quote_id,
    status: raw.status,
    createdAt: raw.created_at,
    executedAt: raw.executed_at,
    state: raw.state,
    closeStatus: raw.close_status,
    modifyTime: raw.modify_time,
    cohQuoteId: raw.coh_quote_id ?? raw.cohQuoteId,
    conditionalOrderPrice: raw.conditional_order_price,
    price: raw.price,
    actionPriceType: raw.action_price_type,
  };
}

export function toLegacyOrderWire(order: LegacyConditionalOrderInput) {
  return {
    account: order.account,
    va_address: order.vaAddress,
    symbol_id: order.symbolId,
    conditional_order_type: order.conditionalOrderType,
    quantity: order.quantity,
    trigger_price: order.triggerPrice,
    limit_price: order.limitPrice,
    side: order.side,
    quote_id: order.quoteId,
  };
}

/** Endpoint paths are selected only by the typed actions in this slice. */
export async function requestLegacyOrder<T>(
  config: Config,
  parameters: LegacyOrderParameters,
  request: Pick<AxiosRequestConfig, "method" | "url" | "data">,
): Promise<T> {
  const solver = config.getSolver(parameters);
  assertSolverKind(solver, "enigma", "legacyConditionalOrders");
  if (!solver.tpsl)
    throw new SymmError("config", "TPSL_NOT_CONFIGURED", "The selected solver has no conditional-order service.");
  const baseURL = solver.tpsl.url.replace(/\/$/, "") + "/api/v5";
  try {
    const response = await axios.request<T>({
      ...request,
      baseURL,
      signal: parameters.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${parameters.accessToken}` },
    });
    return response.data;
  } catch (error) {
    if (isAxiosError(error)) throw SymmApiError.fromAxios(error, { code: "LEGACY_CONDITIONAL_ORDER_FAILED", baseURL });
    throw error;
  }
}
