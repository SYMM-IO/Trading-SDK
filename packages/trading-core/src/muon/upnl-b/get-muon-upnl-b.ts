import type { Address } from "viem";
import type { Config } from "../../core/config";
import type { ChainIdParameter, Compute } from "../../shared/types/properties";
import { fetchMuon, muonBigInt, muonBigIntArray, requireMuonBigInt, toMuonAttestationBase } from "../client";
import { MUON_METHOD_UPNL_B, type MuonAttestationBase } from "../types";

/** Parameters for {@link getMuonUpnlB}. */
export type GetMuonUpnlBParameters = Compute<
  ChainIdParameter & {
    /** The partyB (a hedger/solver) to attest. */
    partyB: Address;
    /** The partyA the partyB's uPnL is computed against. */
    partyA: Address;
  }
>;

/**
 * Normalized `uPnl_B` attestation: the shared signature envelope plus a partyB's
 * computed uPnL fields against a given partyA.
 *
 * @remarks
 * TODO(muon-verify): beyond `uPnl` (verified against the reference frontend), the field set/nesting
 * is best-effort from the Muon docs; optional fields are absent when the gateway
 * omits them.
 */
export interface GetMuonUpnlBReturnType extends MuonAttestationBase {
  /** The attested partyB. */
  partyB: Address;
  /** The partyA the attestation is computed against. */
  partyA: Address;
  /** Signed unrealized PnL (18-decimal, signed). */
  uPnl: bigint;
  /** Sum of notional values across the partyB's positions with the partyA. */
  notionalValueSum?: bigint;
  /** Quote ids included in the attestation. */
  quoteIds: bigint[];
}

/**
 * Fetch a fresh Muon `uPnl_B` attestation for `partyB` against `partyA` and
 * normalize it to typed fields. The oracle URLs and the SYMMIO diamond address
 * (the `symmio` request param) are resolved from `config`; gateways are tried in
 * order until one succeeds.
 *
 * @remarks
 * A partyB's uPnL against a partyA is used in `lockQuote` solvency validation.
 *
 * @param config - The SDK config.
 * @param parameters - PartyB and partyA addresses and optional chain id.
 * @returns The normalized `uPnl_B` attestation.
 * @throws {SymmError} when the chain is unsupported, no Muon URLs are configured,
 *   or every oracle returns an unsuccessful or malformed attestation.
 *
 * @example
 * ```ts
 * const b = await getMuonUpnlB(config, { partyB: "0xpb…", partyA: "0xva…" });
 * console.log(b.uPnl, b.quoteIds);
 * ```
 */
export async function getMuonUpnlB(
  config: Config,
  parameters: GetMuonUpnlBParameters,
): Promise<GetMuonUpnlBReturnType> {
  const { chainId, addresses, muon } = config.getChainConfig(parameters.chainId);
  const raw = await fetchMuon(muon.urls, MUON_METHOD_UPNL_B, {
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
    uPnl: requireMuonBigInt(result.uPnl, "uPnl"),
    notionalValueSum: muonBigInt(result.notionalValueSum),
    quoteIds: muonBigIntArray(result.quoteIds),
  };
}
