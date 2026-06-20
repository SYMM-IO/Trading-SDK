import { toWeiBigInt } from "../../instant-open/shared/trade-math";
import type { ApiGetInstantCloseResponse } from "../../types/generated/enigma-solver";

/**
 * A pending instant-close record returned by a single hedger's
 * `/instant_close/{account}` endpoint.
 *
 * The hedger reports each in-flight close until the matching on-chain close
 * request settles, at which point it drops from the response. Amount fields are
 * normalized to 18-decimal-wei `bigint` (the hedger returns human-scaled decimal
 * strings; {@link toPendingInstantClose} parses them to wei) so they line up with
 * the on-chain {@link "Quote"}'s `quantityToClose` / price fields without further
 * scaling.
 */
export interface PendingInstantClose {
  /** On-chain quote id this close targets. */
  quoteId: bigint;
  /** Quantity being closed (18-decimal wei). */
  quantityToClose: bigint;
  /** Requested close price (18-decimal wei). */
  closePrice: bigint;
}

/**
 * TODO: improve the swagger types, then remove this function or remove its default values
 * Map one raw hedger `/instant_close` record to a normalized
 * {@link PendingInstantClose}.
 *
 * Every wire field is optional, so a missing `quote_id` falls back to `0n` and
 * missing amounts to `0n`. The human-scaled decimal strings (`quantity_to_close`,
 * `close_price`) are parsed to 18-decimal wei via {@link toWeiBigInt}.
 *
 * @param raw - A single element of the hedger's `/instant_close` array response.
 * @returns The normalized record.
 */
export function toPendingInstantClose(raw: ApiGetInstantCloseResponse): PendingInstantClose {
  return {
    quoteId: BigInt(raw.quote_id ?? 0),
    quantityToClose: toWeiBigInt(raw.quantity_to_close ?? "0"),
    closePrice: toWeiBigInt(raw.close_price ?? "0"),
  };
}
