import type { Address } from "viem";
import type { Config } from "../../core/config";
import type { ChainIdParameter, Compute } from "../../shared/types/properties";
import { fetchMuon, muonBigInt, muonBigIntArray, requireMuonBigInt, toMuonAttestationBase } from "../client";
import { MUON_METHOD_UPNL_A_WITH_SYMBOL_PRICE, type MuonAttestationBase } from "../types";

/** Parameters for {@link getMuonUpnlAWithSymbolPrice}. */
export type GetMuonUpnlAWithSymbolPriceParameters = Compute<
  ChainIdParameter & {
    /** The partyA (a subaccount for Majors, a virtual account for VibeCaps) to attest. */
    partyA: Address;
    /** The symbol whose price is attested alongside the uPnL. */
    symbolId: bigint;
  }
>;

/**
 * Normalized `uPnl_A_withSymbolPrice` attestation: the shared signature envelope
 * plus partyA's computed uPnL fields and the requested symbol's price.
 *
 * @remarks
 * TODO(muon-verify): beyond `uPnl` (verified via Vibe-ui), the field set/nesting
 * is best-effort from the Muon docs; optional fields are absent when the gateway
 * omits them.
 */
export interface GetMuonUpnlAWithSymbolPriceReturnType extends MuonAttestationBase {
  /** The attested partyA. */
  partyA: Address;
  /** The symbol whose price is attested. */
  symbolId: bigint;
  /** The attested price for `symbolId` (18-decimal). */
  price?: bigint;
  /** Signed unrealized PnL (18-decimal, signed). */
  uPnl: bigint;
  /** Sum of notional values across the partyA's positions. */
  notionalValueSum?: bigint;
  /** Symbol ids included in the attestation. */
  symbolIds: bigint[];
  /** Quote ids included in the attestation. */
  quoteIds: bigint[];
}

/**
 * Fetch a fresh Muon `uPnl_A_withSymbolPrice` attestation for `partyA` and a
 * single `symbolId`, and normalize it to typed fields. The oracle URLs and the
 * SYMMIO diamond address (the `symmio` request param) are resolved from `config`;
 * gateways are tried in order until one succeeds.
 *
 * @remarks
 * This attestation bundles partyA's uPnL with one symbol's price; it feeds the
 * `sendQuoteWithAffiliate` flow.
 *
 * @param config - The SDK config.
 * @param parameters - PartyA address, symbol id, and optional chain id.
 * @returns The normalized `uPnl_A_withSymbolPrice` attestation.
 * @throws {SymmError} when the chain is unsupported, no Muon URLs are configured,
 *   or every oracle returns an unsuccessful or malformed attestation.
 *
 * @example
 * ```ts
 * const a = await getMuonUpnlAWithSymbolPrice(config, { partyA: "0xva…", symbolId: 1n });
 * console.log(a.uPnl, a.price);
 * ```
 */
export async function getMuonUpnlAWithSymbolPrice(
  config: Config,
  parameters: GetMuonUpnlAWithSymbolPriceParameters,
): Promise<GetMuonUpnlAWithSymbolPriceReturnType> {
  const { chainId, addresses, muon } = config.getChainConfig(parameters.chainId);
  const raw = await fetchMuon(muon.urls, MUON_METHOD_UPNL_A_WITH_SYMBOL_PRICE, {
    partyA: parameters.partyA,
    chainId: chainId.toString(),
    symbolId: parameters.symbolId.toString(),
    symmio: addresses.symmioAddress,
  });
  const result = raw.data.result;
  return {
    ...toMuonAttestationBase(raw),
    partyA: parameters.partyA,
    symbolId: parameters.symbolId,
    price: muonBigInt(result.price),
    uPnl: requireMuonBigInt(result.uPnl, "uPnl"),
    notionalValueSum: muonBigInt(result.notionalValueSum),
    symbolIds: muonBigIntArray(result.symbolIds),
    quoteIds: muonBigIntArray(result.quoteIds),
  };
}
