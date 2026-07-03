import type { Address } from "viem";
import { OrderType, PositionType } from "../../../symmio-contracts/symmio/types";
import type { ApiGetInstantOpenResponse } from "../../types/generated/enigma-solver";

/** Zero address used as a fallback when the hedger omits `party_a_address`. */
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

/**
 * A pending instant-open record returned by a single hedger's
 * `/instant_open/{account}` endpoint.
 *
 * Amount fields (`requestedOpenPrice`, `quantity`, `cva`, `lf`, `partyAmm`,
 * `partyBmm`) are decimal strings in human units — the hedger returns
 * human-scaled numbers, not 18-decimal wei. `tempQuoteId` is the hedger-local
 * handle for this pending trade; the on-chain quote id (once the trade is
 * anchored on-chain) is resolved separately via `getInstantOpenQuoteId`.
 */
export interface PendingInstantOpen {
  /** Hedger-local id for this pending instant trade. */
  tempQuoteId: number;
  /** Target market / symbol id. */
  marketId: number;
  /** Direction of the order — `LONG` or `SHORT`. */
  positionType: PositionType;
  /** Pricing mode of the order — `LIMIT` or `MARKET`. */
  orderType: OrderType;
  /** Sub-account (partyA) that owns this record. */
  partyA: Address;
  /** Requested open price, human-scaled decimal string. */
  requestedOpenPrice: string;
  /** Requested quantity, human-scaled decimal string. */
  quantity: string;
  /** Locked CVA, human-scaled decimal string. */
  cva: string;
  /** Locked liquidation fee, human-scaled decimal string. */
  lf: string;
  /** PartyA maintenance margin, human-scaled decimal string. */
  partyAmm: string;
  /** PartyB maintenance margin, human-scaled decimal string (`"0"` when absent). */
  partyBmm: string;
}

/**
 * Map one raw hedger `/instant_open` record to a normalized
 * {@link PendingInstantOpen}.
 *
 * Every wire field is optional, so missing numbers fall back to their zero
 * value (`0` / `"0"`), missing enums to their `0` member (`LONG` / `LIMIT`), and
 * a missing owner to the zero address.
 *
 * @param raw - A single element of the hedger's `/instant_open` array response.
 * @returns The normalized record.
 */
export function toPendingInstantOpen(raw: ApiGetInstantOpenResponse): PendingInstantOpen {
  return {
    tempQuoteId: raw.temp_quote_id ?? 0,
    marketId: raw.symbol_id ?? 0,
    positionType: (raw.position_type ?? PositionType.LONG) as PositionType,
    orderType: (raw.order_type ?? OrderType.LIMIT) as OrderType,
    partyA: (raw.party_a_address ?? ZERO_ADDRESS) as Address,
    requestedOpenPrice: raw.requested_open_price ?? "0",
    quantity: raw.quantity ?? "0",
    cva: raw.cva ?? "0",
    lf: raw.lf ?? "0",
    partyAmm: raw.partyAmm ?? "0",
    partyBmm: raw.partyBmm ?? "0",
  };
}
