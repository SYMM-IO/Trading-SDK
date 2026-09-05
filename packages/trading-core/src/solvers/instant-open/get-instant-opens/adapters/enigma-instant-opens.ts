import type { Address } from "viem";
import { OrderType, PositionType } from "../../../../symmio-contracts/symmio/types";
import { getInstantOpenAccountAddress, type ApiGetInstantOpenResponse } from "../../../types/generated/enigma-solver";
import type { EnigmaInstantOpen } from "../types";

/** Zero address used as a fallback when the hedger omits `party_a_address`. */
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

/**
 * Map one raw **Enigma** `/instant_open` record to {@link EnigmaInstantOpen}.
 * Every wire field is optional, so missing numbers fall back to their zero
 * value, missing enums to their `0` member, a missing owner to the zero address,
 * and a missing `uuid` to `""`.
 */
export function toEnigmaInstantOpen(raw: ApiGetInstantOpenResponse): EnigmaInstantOpen {
  return {
    kind: "enigma",
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
    uuid: raw.uuid ?? "",
  };
}

/**
 * Fetch and normalize a sub-account's pending instant opens from an **Enigma**
 * hedger — the generated client call plus mapping to {@link EnigmaInstantOpen}.
 *
 * @internal
 */
export async function fetchEnigmaInstantOpens(baseURL: string, partyA: Address): Promise<readonly EnigmaInstantOpen[]> {
  const response = await getInstantOpenAccountAddress(partyA, { baseURL });
  return (response.data ?? []).map(toEnigmaInstantOpen);
}
