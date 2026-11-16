import type { ReadSolverParameter } from "../../shared/types/properties";

/** Bearer authorization for legacy conditional-order endpoints; never used for modern signed TP/SL. */
export type LegacyOrderParameters = ReadSolverParameter & {
  /** Stored solver SIWE credential, owned by the consumer. */ accessToken: string;
  /** Abort the underlying request. */ signal?: AbortSignal;
};
/** Legacy conditional-order creation fields, in human decimal units. */
export interface LegacyConditionalOrderInput {
  /** Owning subaccount. */ account: string;
  /** Optional virtual account. */ vaAddress?: string;
  /** Symbol identity. */ symbolId: number;
  /** Conditional action. */ conditionalOrderType: "take_profit" | "stop_loss" | "send_quote";
  /** Human quantity. */ quantity: string;
  /** Human trigger price. */ triggerPrice: string;
  /** Optional human execution limit. */ limitPrice?: string;
  /** Position direction. */ side: "long" | "short";
  /** Existing quote for closing orders. */ quoteId?: number;
}
/** A normalized legacy conditional-order row. */
export interface LegacyConditionalOrder extends LegacyConditionalOrderInput {
  /** Order identifier. */ id: string;
  /** Optional backend lifecycle state. */ status?: "pending" | "triggered" | "cancelled" | "expired";
  /** Creation time in Unix seconds. */ createdAt: number;
  /** Optional execution time in Unix seconds. */ executedAt?: number;
  /** Optional handler state. */ state?: string;
  /** Optional terminal close state. */ closeStatus?: string | null;
  /** Optional last modification in Unix seconds. */ modifyTime?: number;
  /** Handler quote identifier. */ cohQuoteId?: string;
  /** Entry price used for slippage. */ conditionalOrderPrice?: number;
  /** Execution price. */ price?: number;
  /** Price source. */ actionPriceType?: string;
}
/** Terminal history row from the authenticated history endpoint. */
export interface LegacyOrderHistoryEntry extends LegacyConditionalOrder {
  /** Terminal legacy order state. */ status: "triggered" | "cancelled" | "expired";
}
/** Parameters for authenticated legacy history. */
export type GetLegacyOrderHistoryParameters = LegacyOrderParameters & { /** Owning account. */ account: string };
/** Parameters for legacy conditional creation. */
export type CreateLegacyConditionalOrderParameters = LegacyOrderParameters & {
  /** Order to submit. */ order: LegacyConditionalOrderInput;
};
/** Parameters for legacy cancellation. */
export type CancelLegacyConditionalOrderParameters = LegacyOrderParameters & { /** Order identity. */ orderId: string };
/** Parameters for the legacy locked-collateral read. */
export type GetLegacyCollateralLockedParameters = LegacyOrderParameters & {
  /** PartyA/subaccount or virtual account. */ account: string;
};
