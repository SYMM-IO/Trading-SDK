import type { Address } from "viem";
import type { Config } from "../../core/config";
import type { ChainIdParameter, Compute } from "../../shared/types/properties";
import { fetchMuon, muonBigInt, muonBigIntArray, requireMuonBigInt, toMuonAttestationBase } from "../client";
import { MUON_METHOD_PARTY_A_OVERVIEW, type MuonAttestationBase } from "../types";

/** Parameters for {@link getMuonPartyAOverview}. */
export type GetMuonPartyAOverviewParameters = Compute<
  ChainIdParameter & {
    /** The partyA (a subaccount for Majors, a virtual account for VibeCaps) to attest. */
    partyA: Address;
  }
>;

/**
 * Normalized `partyA_overview` attestation: the shared signature envelope plus
 * partyA's liquidation-overview fields.
 *
 * @remarks
 * TODO(muon-verify): beyond `uPnl` (verified via Vibe-ui), the field set/nesting
 * is best-effort from the Muon docs; optional fields are absent when the gateway
 * omits them.
 */
export interface GetMuonPartyAOverviewReturnType extends MuonAttestationBase {
  /** The attested partyA. */
  partyA: Address;
  /** Signed unrealized PnL (18-decimal, signed). */
  uPnl: bigint;
  /** Sum of notional values across the partyA's positions. */
  notionalValueSum?: bigint;
  /** Aggregated loss used by the liquidation flow. */
  loss?: bigint;
  /** Raw liquidation id for this partyA, when the attestation carries one. */
  liquidationId?: string;
  /** Symbol ids included in the attestation. */
  symbolIds: bigint[];
  /** Quote ids included in the attestation. */
  quoteIds: bigint[];
}

/**
 * Fetch a fresh Muon `partyA_overview` attestation for `partyA` and normalize it
 * to typed fields. The oracle URLs and the SYMMIO diamond address (the `symmio`
 * request param) are resolved from `config`; gateways are tried in order until
 * one succeeds.
 *
 * @remarks
 * This is the uPnL + liquidation data behind `liquidatePartyA` / `setSymbolsPrice`
 * (it produces a `LiquidationSig`).
 *
 * @param config - The SDK config.
 * @param parameters - PartyA address and optional chain id.
 * @returns The normalized `partyA_overview` attestation.
 * @throws {SymmError} when the chain is unsupported, no Muon URLs are configured,
 *   or every oracle returns an unsuccessful or malformed attestation.
 *
 * @example
 * ```ts
 * const overview = await getMuonPartyAOverview(config, { partyA: "0xva…" });
 * console.log(overview.uPnl, overview.liquidationId);
 * ```
 */
export async function getMuonPartyAOverview(
  config: Config,
  parameters: GetMuonPartyAOverviewParameters,
): Promise<GetMuonPartyAOverviewReturnType> {
  const { chainId, addresses, muon } = config.getChainConfig(parameters.chainId);
  const raw = await fetchMuon(muon.urls, MUON_METHOD_PARTY_A_OVERVIEW, {
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
    loss: muonBigInt(result.loss),
    liquidationId: result.liquidationId as string | undefined,
    symbolIds: muonBigIntArray(result.symbolIds),
    quoteIds: muonBigIntArray(result.quoteIds),
  };
}
