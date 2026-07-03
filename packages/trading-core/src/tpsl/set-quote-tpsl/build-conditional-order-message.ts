import type { Address } from "viem";
import type { TpSlConditionalOrderLeg, TpSlConditionalOrderMessage, TpSlDeleteMessage } from "../types";

/** Generate a random uint256 salt (decimal string) for replay protection. */
export function generateTpSlSalt(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let value = 0n;
  for (let i = 0; i < bytes.length; i++) {
    value += BigInt(bytes[i] ?? 0) * 256n ** BigInt(i);
  }
  return value.toString();
}

/**
 * Build a conditional-order EIP-712 message body. The salt is generated
 * automatically; pass `salt` to override (e.g. test deterministically).
 */
export function buildConditionalOrderMessage(parameters: {
  virtualAccount: Address;
  subAccount: Address;
  quoteId: number | null;
  symbolId: number;
  positionType: 0 | 1;
  affiliate: Address;
  takeProfit: TpSlConditionalOrderLeg | null;
  stopLoss: TpSlConditionalOrderLeg | null;
  salt?: string;
}): TpSlConditionalOrderMessage {
  return {
    virtualAccount: parameters.virtualAccount,
    subAccount: parameters.subAccount,
    salt: parameters.salt ?? generateTpSlSalt(),
    quoteId: parameters.quoteId,
    symbolId: parameters.symbolId,
    positionType: parameters.positionType,
    affiliate: parameters.affiliate,
    takeProfit: parameters.takeProfit,
    stopLoss: parameters.stopLoss,
    sendQuote: null,
  };
}

/** Build a delete-conditional-order EIP-712 message body. */
export function buildTpSlDeleteMessage(parameters: {
  virtualAccount: Address;
  cohQuoteId: string;
  conditionalOrderType: "take_profit" | "stop_loss";
  salt?: string;
}): TpSlDeleteMessage {
  return {
    virtualAccount: parameters.virtualAccount,
    salt: parameters.salt ?? generateTpSlSalt(),
    cohQuoteId: parameters.cohQuoteId,
    conditionalOrderType: parameters.conditionalOrderType,
  };
}

/** Empty-leg sentinel used to pad `null` legs before signing. */
export const ZERO_LEG: TpSlConditionalOrderLeg = {
  quantity: "0",
  price: "0",
  orderType: 0,
  conditionalPrice: "0",
  conditionalPriceType: "market",
};

/**
 * EIP-712 can't hash `null` struct fields. Replace any `null` leg / sendQuote
 * with a zero-value struct before hashing. The same padded shape is sent on
 * the wire so the handler can verify the signature.
 */
export function toSignableTpSlMessage(message: Record<string, unknown>): Record<string, unknown> {
  return {
    ...message,
    ...("takeProfit" in message ? { takeProfit: message.takeProfit ?? ZERO_LEG } : {}),
    ...("stopLoss" in message ? { stopLoss: message.stopLoss ?? ZERO_LEG } : {}),
    ...("sendQuote" in message ? { sendQuote: message.sendQuote ?? { ...ZERO_LEG, leverage: 0 } } : {}),
    ...("quoteId" in message ? { quoteId: message.quoteId ?? 0 } : {}),
  };
}
