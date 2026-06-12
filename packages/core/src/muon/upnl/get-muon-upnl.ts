import type { Address } from "viem";
import type { Config } from "../../core/config";
import type { ChainIdParameter, Compute } from "../../shared/types/properties";
import { fetchMuon, muonBigInt, muonBigIntArray, toMuonAttestationBase } from "../client";
import { MUON_METHOD_UPNL_PAIR, type MuonAttestationBase } from "../types";

/** Parameters for {@link getMuonUpnl}. */
export type GetMuonUpnlParameters = Compute<
  ChainIdParameter & {
    /** The partyB (solver/hedger) side of the pair to attest. */
    partyB: Address;
    /** The partyA (a subaccount for Majors, a virtual account for VibeCaps) to attest. */
    partyA: Address;
  }
>;

/**
 * Normalized `uPnl` attestation: the shared signature envelope plus the combined
 * partyA + partyB unrealized-PnL fields, with a per-party breakdown.
 *
 * @remarks
 * TODO(muon-verify): beyond the shared signature envelope, the field set/nesting
 * is best-effort from the Muon docs; optional fields are absent when the gateway
 * omits them.
 */
export interface GetMuonUpnlReturnType extends MuonAttestationBase {
  /** The attested partyB. */
  partyB: Address;
  /** The attested partyA. */
  partyA: Address;
  /** PartyA's signed unrealized PnL (18-decimal, signed). */
  uPnlA?: bigint;
  /** PartyB's signed unrealized PnL (18-decimal, signed). */
  uPnlB?: bigint;
  /** Sum of notional values across the partyA's positions. */
  notionalValueSumA?: bigint;
  /** Sum of notional values across the partyB's positions. */
  notionalValueSumB?: bigint;
  /** Quote ids included in the partyA side of the attestation. */
  quoteIdsA: bigint[];
  /** Quote ids included in the partyB side of the attestation. */
  quoteIdsB: bigint[];
}

/**
 * Fetch a fresh Muon `uPnl` attestation for a `partyB` / `partyA` pair and
 * normalize it to typed fields. The oracle URLs and the SYMMIO diamond address
 * (the `symmio` request param) are resolved from `config`; gateways are tried in
 * order until one succeeds.
 *
 * @remarks
 * Returns the combined attestation: partyA and partyB uPnL in one response, with
 * a per-party breakdown. For a single-party uPnL use `getMuonUpnlA` /
 * `getMuonUpnlB` instead.
 *
 * @param config - The SDK config.
 * @param parameters - PartyB and partyA addresses and optional chain id.
 * @returns The normalized `uPnl` attestation.
 * @throws {SymmError} when the chain is unsupported, no Muon URLs are configured,
 *   or every oracle returns an unsuccessful or malformed attestation.
 *
 * @example
 * ```ts
 * const a = await getMuonUpnl(config, { partyB: "0xb…", partyA: "0xva…" });
 * console.log(a.uPnlA, a.uPnlB);
 * ```
 */
export async function getMuonUpnl(config: Config, parameters: GetMuonUpnlParameters): Promise<GetMuonUpnlReturnType> {
  const { chainId, addresses, muon } = config.getChainConfig(parameters.chainId);
  const raw = await fetchMuon(muon.urls, MUON_METHOD_UPNL_PAIR, {
    partyB: parameters.partyB,
    partyA: parameters.partyA,
    chainId: chainId.toString(),
    symmio: addresses.symmioAddress,
  });
  const result = raw.data.result;
  return {
    ...toMuonAttestationBase(raw),
    partyB: parameters.partyB,
    partyA: parameters.partyA,
    uPnlA: muonBigInt(result.uPnlA),
    uPnlB: muonBigInt(result.uPnlB),
    notionalValueSumA: muonBigInt(result.notionalValueSumA),
    notionalValueSumB: muonBigInt(result.notionalValueSumB),
    quoteIdsA: muonBigIntArray(result.quoteIdsA),
    quoteIdsB: muonBigIntArray(result.quoteIdsB),
  };
}
