import type { Config } from "../../core/config";
import type { ChainIdParameter, Compute } from "../../shared/types/properties";
import { fetchMuon, muonBigIntArray, toMuonArrayParam, toMuonAttestationBase } from "../client";
import { MUON_METHOD_PRICE, type MuonAttestationBase } from "../types";

/** Parameters for {@link getMuonPrice}. */
export type GetMuonPriceParameters = Compute<
  ChainIdParameter & {
    /** The quote ids to price (the partyB liquidation flow validates these prices). */
    quoteIds: readonly bigint[];
  }
>;

/**
 * Normalized `price` attestation: the shared signature envelope plus the
 * validated prices for the requested quote ids.
 *
 * @remarks
 * Verified against the live gateway: `price` returns `quoteIds`, `symbols`, and
 * `prices`. `markPrices` / `maxLeverages` were not observed for this method but
 * stay optional for forward-compatibility (absent when the gateway omits them).
 */
export interface GetMuonPriceReturnType extends MuonAttestationBase {
  /** The attested quote ids (echoed from the request). */
  quoteIds: bigint[];
  /** Validated prices per quote id (18-decimal). */
  prices?: bigint[];
  /** Mark prices per quote id (18-decimal). */
  markPrices?: bigint[];
  /** Max leverage per quote id. */
  maxLeverages?: bigint[];
  /** Symbol names per quote id. */
  symbols?: string[];
}

/**
 * Fetch a fresh Muon `price` attestation for a set of quote ids and normalize it
 * to typed fields. The oracle URLs and the SYMMIO diamond address (the `symmio`
 * request param) are resolved from `config`; gateways are tried in order until
 * one succeeds.
 *
 * @param config - The SDK config.
 * @param parameters - The quote ids to price and optional chain id.
 * @returns The normalized `price` attestation.
 * @throws {SymmError} when the chain is unsupported, no Muon URLs are configured,
 *   or every oracle returns an unsuccessful or malformed attestation.
 *
 * @example
 * ```ts
 * const p = await getMuonPrice(config, { quoteIds: [10n, 11n] });
 * console.log(p.prices, p.quoteIds);
 * ```
 */
export async function getMuonPrice(
  config: Config,
  parameters: GetMuonPriceParameters,
): Promise<GetMuonPriceReturnType> {
  const { chainId, addresses, muon } = config.getChainConfig(parameters.chainId);
  const raw = await fetchMuon(muon.urls, MUON_METHOD_PRICE, {
    quoteIds: toMuonArrayParam(parameters.quoteIds),
    chainId: chainId.toString(),
    symmio: addresses.symmioAddress,
  });
  const result = raw.data.result;
  return {
    ...toMuonAttestationBase(raw),
    quoteIds: [...parameters.quoteIds],
    prices: Array.isArray(result.prices) ? muonBigIntArray(result.prices) : undefined,
    markPrices: Array.isArray(result.markPrices) ? muonBigIntArray(result.markPrices) : undefined,
    maxLeverages: Array.isArray(result.maxLeverages) ? muonBigIntArray(result.maxLeverages) : undefined,
    symbols: Array.isArray(result.symbols) ? result.symbols.map(String) : undefined,
  };
}
