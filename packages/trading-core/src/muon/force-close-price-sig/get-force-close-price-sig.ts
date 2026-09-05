import type { Address } from "viem";
import type { Config } from "../../core/config";
import type { ChainIdParameter, Compute } from "../../shared/types/properties";
import type { HighLowPriceSig } from "../../symmio-contracts/symmio/types";
import { fetchMuon, requireMuonBigInt, toContractSigEnvelope } from "../client";
import { MUON_METHOD_PRICE_RANGE, type MuonRawResult } from "../types";

/**
 * Parameters for {@link getForceClosePriceSig}.
 */
export type GetForceClosePriceSigParameters = Compute<
  ChainIdParameter & {
    /** Window start timestamp (unix seconds). */
    t0: bigint;
    /** Window end timestamp (unix seconds). */
    t1: bigint;
    /** PartyA of the position being force-closed. */
    partyA: Address;
    /** PartyB (the solver) of the position being force-closed. */
    partyB: Address;
    /** Market symbol id of the position. */
    symbolId: bigint;
  }
>;

/** Return type of {@link getForceClosePriceSig}: a contract-ready price-range signature. */
export type GetForceClosePriceSigReturnType = HighLowPriceSig;

/**
 * Fetch a fresh Muon `priceRange` attestation for a time window and assemble it
 * into the contract-ready {@link HighLowPriceSig} that `forceClosePosition` /
 * `settleAndForceClosePosition` verify.
 *
 * The Muon oracle URLs and the SYMMIO diamond address (the `symmio` request
 * param) are resolved from `config` per call. The configured gateways are tried
 * in order until one returns a successful attestation.
 *
 * @remarks
 * The attestation is timestamped and short-lived — fetch it immediately before
 * submitting, not ahead of time. For the raw, un-assembled attestation (all
 * returned fields), use `getMuonPriceRange` instead.
 *
 * TODO(muon-verify): `priceRange`'s exact response nesting has not been checked
 * against a live gateway (see `src/muon/MUON-VERIFY.md`). The field mapping here
 * follows the reference implementation and is best-effort until verified.
 *
 * @param config - The SDK config.
 * @param parameters - Window bounds, both parties, symbol id, optional chain id.
 * @returns The assembled `HighLowPriceSig`.
 * @throws {SymmError} when the chain is unsupported, no Muon URLs are configured,
 *   or every oracle returns an unsuccessful or malformed attestation.
 *
 * @example
 * ```ts
 * const sig = await getForceClosePriceSig(config, {
 *   partyA: "0x…",
 *   partyB: solverAddress,
 *   symbolId: 1n,
 *   t0: 1735689600n,
 *   t1: 1735693200n,
 * });
 * ```
 */
export async function getForceClosePriceSig(
  config: Config,
  parameters: GetForceClosePriceSigParameters,
): Promise<GetForceClosePriceSigReturnType> {
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
  return toHighLowPriceSig(raw);
}

/**
 * Map a raw Muon `priceRange` result onto the on-chain {@link HighLowPriceSig}
 * tuple.
 *
 * Three of the wire names differ from the struct's: Muon returns `mean` for
 * `averagePrice`, `price` for `currentPrice`, and `uPnlB` / `uPnlA` for
 * `upnlPartyB` / `upnlPartyA`.
 *
 * @internal
 */
function toHighLowPriceSig(raw: MuonRawResult): HighLowPriceSig {
  const result = raw.data.result;
  return {
    ...toContractSigEnvelope(raw),
    symbolId: requireMuonBigInt(result.symbolId, "symbolId"),
    highest: requireMuonBigInt(result.highest, "highest"),
    lowest: requireMuonBigInt(result.lowest, "lowest"),
    averagePrice: requireMuonBigInt(result.mean, "mean"),
    startTime: requireMuonBigInt(result.startTime, "startTime"),
    endTime: requireMuonBigInt(result.endTime, "endTime"),
    upnlPartyB: requireMuonBigInt(result.uPnlB, "uPnlB"),
    upnlPartyA: requireMuonBigInt(result.uPnlA, "uPnlA"),
    currentPrice: requireMuonBigInt(result.price, "price"),
  };
}
