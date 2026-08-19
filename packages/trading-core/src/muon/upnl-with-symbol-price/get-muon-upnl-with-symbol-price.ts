import type { Address } from "viem";
import type { Config } from "../../core/config";
import type { ChainIdParameter, Compute } from "../../shared/types/properties";
import { fetchMuon, muonBigInt, muonBigIntArray, toMuonAttestationBase } from "../client";
import { MUON_METHOD_UPNL_WITH_SYMBOL_PRICE, type MuonAttestationBase } from "../types";

/** Parameters for {@link getMuonUpnlWithSymbolPrice}. */
export type GetMuonUpnlWithSymbolPriceParameters = Compute<
  ChainIdParameter & {
    /** The partyB (solver) side of the attestation. */
    partyB: Address;
    /** The partyA (virtual account, lowcap) to attest. */
    partyA: Address;
    /** The symbol id whose price is included in the attestation. */
    symbolId: bigint;
  }
>;

/**
 * Normalized `uPnlWithSymbolPrice` attestation: the shared signature envelope plus
 * both parties' computed uPnL fields and a single symbol price.
 *
 * @remarks
 * TODO(muon-verify): beyond `uPnl` (verified against the reference frontend), the field set/nesting
 * is best-effort from the Muon docs; optional fields are absent when the gateway
 * omits them.
 */
export interface GetMuonUpnlWithSymbolPriceReturnType extends MuonAttestationBase {
  /** The attested partyB. */
  partyB: Address;
  /** The attested partyA. */
  partyA: Address;
  /** The symbol id the price is for. */
  symbolId: bigint;
  /** The attested symbol price (18-decimal). */
  price?: bigint;
  /** Signed unrealized PnL for partyA (18-decimal, signed). */
  uPnlA?: bigint;
  /** Signed unrealized PnL for partyB (18-decimal, signed). */
  uPnlB?: bigint;
  /** Quote ids included on partyA's side of the attestation. */
  quoteIdsA: bigint[];
  /** Quote ids included on partyB's side of the attestation. */
  quoteIdsB: bigint[];
}

/**
 * Fetch a fresh Muon `uPnlWithSymbolPrice` attestation for a `partyB`/`partyA`
 * pair and a `symbolId`, normalized to typed fields. The oracle URLs and the
 * SYMMIO diamond address (the `symmio` request param) are resolved from `config`;
 * gateways are tried in order until one succeeds.
 *
 * @remarks
 * This attestation carries both parties' uPnL plus a symbol price — the shape a
 * solver's `openPosition` call needs.
 *
 * @param config - The SDK config.
 * @param parameters - PartyB, partyA, symbol id, and optional chain id.
 * @returns The normalized `uPnlWithSymbolPrice` attestation.
 * @throws {SymmError} when the chain is unsupported, no Muon URLs are configured,
 *   or every oracle returns an unsuccessful or malformed attestation.
 *
 * @example
 * ```ts
 * const a = await getMuonUpnlWithSymbolPrice(config, {
 *   partyB: "0xsolver…",
 *   partyA: "0xva…",
 *   symbolId: 1n,
 * });
 * console.log(a.price, a.uPnlA, a.uPnlB);
 * ```
 */
export async function getMuonUpnlWithSymbolPrice(
  config: Config,
  parameters: GetMuonUpnlWithSymbolPriceParameters,
): Promise<GetMuonUpnlWithSymbolPriceReturnType> {
  const { chainId, addresses, muon } = config.getChainConfig(parameters.chainId);
  const raw = await fetchMuon(muon.urls, MUON_METHOD_UPNL_WITH_SYMBOL_PRICE, {
    partyB: parameters.partyB,
    partyA: parameters.partyA,
    chainId: chainId.toString(),
    symbolId: parameters.symbolId.toString(),
    symmio: addresses.symmioAddress,
  });
  const result = raw.data.result;
  return {
    ...toMuonAttestationBase(raw),
    partyB: parameters.partyB,
    partyA: parameters.partyA,
    symbolId: parameters.symbolId,
    price: muonBigInt(result.price),
    uPnlA: muonBigInt(result.uPnlA),
    uPnlB: muonBigInt(result.uPnlB),
    quoteIdsA: muonBigIntArray(result.quoteIdsA),
    quoteIdsB: muonBigIntArray(result.quoteIdsB),
  };
}
