import type { Address } from "viem";
import type { Config } from "../../core/config";
import type { ChainIdParameter, Compute } from "../../shared/types/properties";
import { fetchMuon, muonBigInt, muonBigIntArray, toMuonArrayParam, toMuonAttestationBase } from "../client";
import { MUON_METHOD_SETTLE_UPNL, type MuonAttestationBase } from "../types";

/** Parameters for {@link getMuonSettleUpnl}. */
export type GetMuonSettleUpnlParameters = Compute<
  ChainIdParameter & {
    /** The partyA (a subaccount for Majors, a virtual account for VibeCaps) whose quotes to settle. */
    partyA: Address;
    /** Quote ids to include in the settlement attestation. */
    quoteIds: readonly bigint[];
  }
>;

/**
 * Normalized `settle_upnl` attestation: the shared signature envelope plus the
 * partyA's settlement uPnL fields for the requested quotes.
 *
 * @remarks
 * Verified against the live gateway: `settle_upnl` returns `uPnlA` plus a nested
 * `quoteSettlementData` (rows of `[quoteId, price, …]`) that is intentionally not
 * typed here yet. `notionalValueSumA` stays optional (absent when omitted).
 */
export interface GetMuonSettleUpnlReturnType extends MuonAttestationBase {
  /** The attested partyA. */
  partyA: Address;
  /** Quote ids included in the attestation. */
  quoteIds: bigint[];
  /** Signed unrealized PnL for partyA (18-decimal, signed). */
  uPnlA?: bigint;
  /** Sum of notional values across partyA's settled positions. */
  notionalValueSumA?: bigint;
}

/**
 * Fetch a fresh Muon `settle_upnl` attestation for `partyA` over `quoteIds` and
 * normalize it to typed fields. The oracle URLs and the SYMMIO diamond address
 * (the `symmio` request param) are resolved from `config`; gateways are tried in
 * order until one succeeds.
 *
 * @remarks
 * Produces the uPnL settlement data that `settleUpnl` requires. The per-quote
 * settlement data is omitted from the normalized result for now (see the
 * TODO(muon-verify) note on {@link GetMuonSettleUpnlReturnType}).
 *
 * @param config - The SDK config.
 * @param parameters - PartyA address, quote ids, and optional chain id.
 * @returns The normalized `settle_upnl` attestation.
 * @throws {SymmError} when the chain is unsupported, no Muon URLs are configured,
 *   or every oracle returns an unsuccessful or malformed attestation.
 *
 * @example
 * ```ts
 * const s = await getMuonSettleUpnl(config, { partyA: "0xva…", quoteIds: [10n, 11n] });
 * console.log(s.uPnlA, s.quoteIds);
 * ```
 */
export async function getMuonSettleUpnl(
  config: Config,
  parameters: GetMuonSettleUpnlParameters,
): Promise<GetMuonSettleUpnlReturnType> {
  const { chainId, addresses, muon } = config.getChainConfig(parameters.chainId);
  const raw = await fetchMuon(muon.urls, MUON_METHOD_SETTLE_UPNL, {
    partyA: parameters.partyA,
    chainId: chainId.toString(),
    symmio: addresses.symmioAddress,
    quoteIds: toMuonArrayParam(parameters.quoteIds),
  });
  const result = raw.data.result;
  return {
    ...toMuonAttestationBase(raw),
    partyA: parameters.partyA,
    quoteIds: muonBigIntArray(result.quoteIds),
    uPnlA: muonBigInt(result.uPnlA),
    notionalValueSumA: muonBigInt(result.notionalValueSumA),
  };
}
