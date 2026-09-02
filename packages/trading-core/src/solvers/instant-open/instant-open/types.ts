import type { Address, Hex } from "viem";
import type { SymmioSolverKind } from "../../../core/chains/types";
import type { ChainIdParameter, Compute, FromParameter } from "../../../shared/types/properties";
import type { PositionType } from "../../../symmio-contracts/symmio/types";
import type { RasaInstantOpen } from "../get-instant-opens/types";
import type {
  InstantOpenLockedParams,
  InstantOpenMargin,
  InstantOpenOrder,
  SolverFeeCaps,
  SolverOrderType,
} from "../shared/types";

/**
 * Parameters for {@link instantOpen}, generic over the target solver kind `K`.
 *
 * Every domain value is the **final** 18-decimal-wei `bigint` ready to feed the
 * quote-send call. The caller (or the `prepareInstantOpenParams` wizard) owns
 * trade math, platform-fee calc, and margin calc.
 *
 * Passing a literal `solverId` binds `K`, which narrows the **return** type to
 * that solver's result variant.
 */
export type InstantOpenParameters<K extends SymmioSolverKind = SymmioSolverKind> = Compute<
  ChainIdParameter &
    FromParameter & {
      /** Which solver to open against. Omit to use the chain's default solver. */
      solverId?: K;
      /** Sub-account / partyA address — the `signerAccount.addr` the operation runs under. */
      subAccountAddress: Address;
      /** Market `symbol_id`. */
      marketId: number;
      /** Trade side. */
      positionType: PositionType;
      /**
       * Order type: `ORDER_TYPE_MARKET` (default, instant fill) or
       * `ORDER_TYPE_LIMIT` (majors / rasa only — writes a pending on-chain quote
       * at `order.price`). Defaults to MARKET when omitted.
       */
      orderType?: SolverOrderType;
      /** Order-side values (`price`, `quantity`) — both 18-decimal-wei `bigint`. */
      order: InstantOpenOrder;
      /** Locked-margin breakdown (`cva`, `lf`, `partyAmm`, `partyBmm`) — all 18-decimal-wei `bigint`. */
      lockedParam: InstantOpenLockedParams;
      /**
       * Margin routed into the next virtual account — 18-decimal-wei `bigint`.
       *
       * **Required by the Enigma (lowcap) flow**, which funds a fresh VA in the
       * same batch as the quote; omitting it there throws
       * `INSTANT_OPEN_MARGIN_REQUIRED`. **Ignored by Rasa (majors)**, which is
       * cross-margin and has no `addMargin` step.
       */
      margin?: InstantOpenMargin;
      /**
       * Solver-fee rate caps authorized on the quote — 18-decimal ratios of
       * notional (perps-core v0.8.6 solver fees). Applied by the Enigma flow on
       * a `contractsVersion: "0.8.6"` chain, where it signs `sendQuote`;
       * defaults to zero caps there, which a fee-charging solver may reject —
       * `prepareInstantOpenParams` fills the market's `minOpenSolverFeeCap` /
       * `minCloseSolverFeeCap`. Ignored on `"0.8.5"` chains and by the Rasa
       * flow, which sign the legacy `sendQuoteWithAffiliateAndData`.
       */
      solverFeeCaps?: SolverFeeCaps;
      /** Override the metadata UUID. Defaults to `globalThis.crypto.randomUUID()`. */
      uuid?: string;
      /** Override the addMargin salt. Enigma-only. Defaults to a random 32-byte salt. */
      addMarginSalt?: Hex;
      /** Override the sendQuote salt. Defaults to a random 32-byte salt. */
      sendQuoteSalt?: Hex;
      /** Override the unix-seconds deadline (defaults to `now + 300s`). */
      deadline?: bigint;
    }
>;

/** Fields both solver kinds return from a successful instant open. */
interface BaseInstantOpenResult {
  /** `true` if the hedger accepted the request. */
  success: boolean;
  /** Hedger-issued temporary quote id (numeric string). */
  tempQuoteId?: string;
  /** Hedger response `partyBmm` field, if any. */
  partyBmm?: string;
}

/** Result of an instant open submitted to an **Enigma** hedger. */
export interface EnigmaInstantOpenResult extends BaseInstantOpenResult {
  /** Discriminant: submitted to an Enigma solver. */
  kind: "enigma";
}

/** Result of an instant open submitted to a **Rasa** hedger. */
export interface RasaInstantOpenResult extends BaseInstantOpenResult {
  /** Discriminant: submitted to a Rasa solver. */
  kind: "rasa";
  /**
   * The accepted request-for-quote, echoed by Rasa and normalized to the same
   * shape `getInstantOpens` returns. Enigma's response carries no equivalent.
   */
  rfq: RasaInstantOpen;
}

/** Maps each solver kind to its instant-open result shape. */
export interface InstantOpenResultByKind {
  enigma: EnigmaInstantOpenResult;
  rasa: RasaInstantOpenResult;
}

/**
 * Return type of {@link instantOpen}, narrowed by the target solver kind.
 *
 * Narrow on `kind` to reach a solver's exclusive fields; targeting a specific
 * solver via a literal `solverId` gives that variant directly.
 */
export type InstantOpenReturnType<K extends SymmioSolverKind = SymmioSolverKind> = InstantOpenResultByKind[K];
