import type { Address } from "viem";
import type { OrderType, PositionType } from "../../../symmio-contracts/symmio/types";

/**
 * Fields both solver kinds' `/instant_open/{account}` records share.
 *
 * Amount fields (`requestedOpenPrice`, `quantity`, `cva`, `lf`, `partyAmm`,
 * `partyBmm`) are decimal strings in human units — the hedger returns
 * human-scaled numbers, not 18-decimal wei. `tempQuoteId` is the hedger-local
 * handle for this pending trade; the on-chain quote id (once the trade is
 * anchored on-chain) is resolved separately via `getInstantOpenQuoteId`.
 */
interface BaseInstantOpen {
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
 * A pending instant-open record from an **Enigma** hedger — the shared fields
 * plus Enigma's `uuid`.
 */
export interface EnigmaInstantOpen extends BaseInstantOpen {
  /** Discriminant: from an Enigma solver. */
  kind: "enigma";
  /** Frontend-provided UUID from the V2 `sendQuote` metadata. Enigma-only. */
  uuid: string;
}

/**
 * A pending instant-open record from a **Rasa** hedger — the shared fields only.
 * Rasa returns no `uuid`, so that field does not exist here.
 */
export interface RasaInstantOpen extends BaseInstantOpen {
  /** Discriminant: from a Rasa solver. */
  kind: "rasa";
}

/**
 * A pending instant-open record returned by a single hedger's
 * `/instant_open/{account}` endpoint — a discriminated union on `kind`. The two
 * solvers share every field except Enigma's `uuid`; narrow on `kind` to reach it.
 */
export type PendingInstantOpen = EnigmaInstantOpen | RasaInstantOpen;

/** Maps each solver kind to its instant-open record type. */
export interface NormalizedInstantOpenByKind {
  enigma: EnigmaInstantOpen;
  rasa: RasaInstantOpen;
}
