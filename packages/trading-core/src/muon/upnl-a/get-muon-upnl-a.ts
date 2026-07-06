import type { Address } from "viem";
import type { Config } from "../../core/config";
import type { ChainIdParameter, Compute } from "../../shared/types/properties";
import { fetchMuon, muonBigInt, muonBigIntArray, requireMuonBigInt, toMuonAttestationBase } from "../client";
import { MUON_METHOD_UPNL_A, type MuonAttestationBase } from "../types";

/** Parameters for {@link getMuonUpnlA}. */
export type GetMuonUpnlAParameters = Compute<
  ChainIdParameter & {
    /** The partyA (virtual account for lowcap) to attest. */
    partyA: Address;
  }
>;

/**
 * Normalized `uPnl_A` attestation: the shared signature envelope plus partyA's
 * computed uPnL fields.
 *
 * @remarks
 * TODO(muon-verify): beyond `uPnl` (verified via Vibe-ui), the field set/nesting
 * is best-effort from the Muon docs; optional fields are absent when the gateway
 * omits them.
 */
export interface GetMuonUpnlAReturnType extends MuonAttestationBase {
  /** The attested partyA. */
  partyA: Address;
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
 * Fetch a fresh Muon `uPnl_A` attestation for `partyA` and normalize it to typed
 * fields. The oracle URLs and the SYMMIO diamond address (the `symmio` request
 * param) are resolved from `config`; gateways are tried in order until one
 * succeeds.
 *
 * @remarks
 * Returns the raw attestation. For the contract-ready {@link SingleUpnlSig} that
 * `removeMargin` needs, use `getDeallocateUpnlSig` instead.
 *
 * @param config - The SDK config.
 * @param parameters - PartyA address and optional chain id.
 * @returns The normalized `uPnl_A` attestation.
 * @throws {SymmError} when the chain is unsupported, no Muon URLs are configured,
 *   or every oracle returns an unsuccessful or malformed attestation.
 *
 * @example
 * ```ts
 * const a = await getMuonUpnlA(config, { partyA: "0xva…" });
 * console.log(a.uPnl, a.quoteIds);
 * ```
 */
export async function getMuonUpnlA(
  config: Config,
  parameters: GetMuonUpnlAParameters,
): Promise<GetMuonUpnlAReturnType> {
  const { chainId, addresses, muon } = config.getChainConfig(parameters.chainId);
  const raw = await fetchMuon(muon.urls, MUON_METHOD_UPNL_A, {
    partyA: parameters.partyA,
    chainId: chainId.toString(),
    symmio: addresses.symmioAddress,
  });
  const result = raw.data.result;
  return {
    ...toMuonAttestationBase(raw),
    partyA: parameters.partyA,
    uPnl: requireMuonBigInt(result.uPnl, "uPnl"),
    notionalValueSum: muonBigInt(result.notionalValueSum),
    symbolIds: muonBigIntArray(result.symbolIds),
    quoteIds: muonBigIntArray(result.quoteIds),
  };
}
