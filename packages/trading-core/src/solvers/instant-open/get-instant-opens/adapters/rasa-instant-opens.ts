import type { Address } from "viem";
import type { OrderType, PositionType } from "../../../../symmio-contracts/symmio/types";
import {
  getInstantRequestForQuotesInstantOpenAccountAddressGet,
  type InstantRFQResponse,
} from "../../../types/generated/rasa-solver";
import type { RasaInstantOpen } from "../types";

/**
 * Map one raw **Rasa** `/instant_open` record (`InstantRFQResponse`) to
 * {@link RasaInstantOpen}. Rasa returns every field required, with
 * `position_type` / `order_type` as `0 | 1` enums — the same numeric domain as
 * the SDK's `PositionType` / `OrderType`. Rasa has no `uuid`.
 */
export function toRasaInstantOpen(raw: InstantRFQResponse): RasaInstantOpen {
  return {
    kind: "rasa",
    tempQuoteId: raw.temp_quote_id,
    marketId: raw.symbol_id,
    positionType: raw.position_type as unknown as PositionType,
    orderType: raw.order_type as unknown as OrderType,
    partyA: raw.party_a_address as Address,
    requestedOpenPrice: raw.requested_open_price,
    quantity: raw.quantity,
    cva: raw.cva,
    lf: raw.lf,
    partyAmm: raw.partyAmm,
    partyBmm: raw.partyBmm,
  };
}

/**
 * Fetch and normalize a sub-account's pending instant opens from a **Rasa**
 * hedger — the generated client call plus mapping to {@link RasaInstantOpen}.
 *
 * @internal
 */
export async function fetchRasaInstantOpens(baseURL: string, partyA: Address): Promise<readonly RasaInstantOpen[]> {
  const response = await getInstantRequestForQuotesInstantOpenAccountAddressGet(partyA, { baseURL });
  return (response.data ?? []).map(toRasaInstantOpen);
}
