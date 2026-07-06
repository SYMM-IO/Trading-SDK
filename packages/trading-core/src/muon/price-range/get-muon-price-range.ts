import type { Address } from "viem";
import type { Config } from "../../core/config";
import type { ChainIdParameter, Compute } from "../../shared/types/properties";
import { fetchMuon, muonBigInt, toMuonAttestationBase } from "../client";
import { MUON_METHOD_PRICE_RANGE, type MuonAttestationBase } from "../types";

/** Parameters for {@link getMuonPriceRange}. */
export type GetMuonPriceRangeParameters = Compute<
  ChainIdParameter & {
    /** Window start in unix seconds. */
    t0: bigint;
    /** Window end in unix seconds. */
    t1: bigint;
    /** The partyA (virtual account for lowcap) to attest. */
    partyA: Address;
    /** The partyB counterparty of the position. */
    partyB: Address;
    /** The market symbol id the range is computed for. */
    symbolId: bigint;
  }
>;

/**
 * Normalized `priceRange` attestation: the shared signature envelope plus the
 * TWAP-style price-range fields used by `forceClosePosition` /
 * `settleAndForceClosePosition` validation.
 *
 * @remarks
 * TODO(muon-verify): beyond the signature envelope, the result field set/nesting
 * is best-effort from the Muon docs and has not been checked against a live
 * gateway; optional fields are absent when the gateway omits them.
 */
export interface GetMuonPriceRangeReturnType extends MuonAttestationBase {
  /** The attested partyA. */
  partyA: Address;
  /** The attested partyB. */
  partyB: Address;
  /** The market symbol id the range was computed for. */
  symbolId: bigint;
  /** Window start in unix seconds (echoed by the gateway). */
  startTime?: bigint;
  /** Window end in unix seconds (echoed by the gateway). */
  endTime?: bigint;
  /** Lowest observed price across the window (18-decimal). */
  lowest?: bigint;
  /** Highest observed price across the window (18-decimal). */
  highest?: bigint;
  /** TWAP/mean price across the window (18-decimal). */
  mean?: bigint;
  /** Spot price at the attestation (18-decimal). */
  price?: bigint;
  /** PartyA's unrealized PnL at the attestation (18-decimal, signed). */
  uPnlA?: bigint;
  /** PartyB's unrealized PnL at the attestation (18-decimal, signed). */
  uPnlB?: bigint;
}

/**
 * Fetch a fresh Muon `priceRange` attestation for a position over the
 * `[t0, t1]` window and normalize it to typed fields. The oracle URLs and the
 * SYMMIO diamond address (the `symmio` request param) are resolved from
 * `config`; gateways are tried in order until one succeeds.
 *
 * @remarks
 * `priceRange` produces the TWAP-style range a partyB needs to validate a
 * `forceClosePosition` / `settleAndForceClosePosition` against the configured
 * gap thresholds.
 *
 * @param config - The SDK config.
 * @param parameters - Window, parties, symbol id, and optional chain id.
 * @returns The normalized `priceRange` attestation.
 * @throws {SymmError} when the chain is unsupported, no Muon URLs are configured,
 *   or every oracle returns an unsuccessful or malformed attestation.
 *
 * @example
 * ```ts
 * const r = await getMuonPriceRange(config, {
 *   t0: 1_700_000_000n,
 *   t1: 1_700_000_900n,
 *   partyA: "0xva…",
 *   partyB: "0xpb…",
 *   symbolId: 1n,
 * });
 * console.log(r.lowest, r.highest, r.mean);
 * ```
 */
export async function getMuonPriceRange(
  config: Config,
  parameters: GetMuonPriceRangeParameters,
): Promise<GetMuonPriceRangeReturnType> {
  const { chainId, addresses, muon } = config.getChainConfig(parameters.chainId);
  const raw = await fetchMuon(muon.urls, MUON_METHOD_PRICE_RANGE, {
    t0: parameters.t0.toString(),
    t1: parameters.t1.toString(),
    partyA: parameters.partyA,
    partyB: parameters.partyB,
    chainId: chainId.toString(),
    symmio: addresses.symmioAddress,
    symbolId: parameters.symbolId.toString(),
  });
  const result = raw.data.result;
  return {
    ...toMuonAttestationBase(raw),
    partyA: parameters.partyA,
    partyB: parameters.partyB,
    symbolId: parameters.symbolId,
    startTime: muonBigInt(result.startTime),
    endTime: muonBigInt(result.endTime),
    lowest: muonBigInt(result.lowest),
    highest: muonBigInt(result.highest),
    mean: muonBigInt(result.mean),
    price: muonBigInt(result.price),
    uPnlA: muonBigInt(result.uPnlA),
    uPnlB: muonBigInt(result.uPnlB),
  };
}
