import type { Address } from "viem";
import type { Config } from "../../core/config";
import type { ChainIdParameter, Compute } from "../../shared/types/properties";
import type { SingleUpnlAndPriceSig } from "../../symmio-contracts/symmio/types";
import { fetchMuon, muonBigInt, requireMuonBigInt, toContractSigEnvelope } from "../client";
import { MUON_METHOD_UPNL_A_WITH_SYMBOL_PRICE, type MuonRawResult } from "../types";

/**
 * Parameters for {@link getSendQuoteUpnlSig}.
 */
export type GetSendQuoteUpnlSigParameters = Compute<
  ChainIdParameter & {
    /**
     * The Muon `partyA` to attest. For cross-margin solvers (Rasa / majors) this
     * is the **sub-account**; for lowcap it is the virtual account.
     */
    partyA: Address;
    /** Market symbol id whose price is attested alongside the uPnL. */
    symbolId: bigint;
  }
>;

/** Return type of {@link getSendQuoteUpnlSig}: a contract-ready uPnL + price signature. */
export type GetSendQuoteUpnlSigReturnType = SingleUpnlAndPriceSig;

/**
 * Fetch a fresh Muon `uPnl_A_withSymbolPrice` attestation and assemble it into
 * the contract-ready {@link SingleUpnlAndPriceSig} that
 * `sendQuoteWithAffiliateAndData` takes as its `upnlSig` argument.
 *
 * The Muon oracle URLs and the SYMMIO diamond address (the `symmio` request
 * param) are resolved from `config` per call. The configured gateways are tried
 * in order until one returns a successful attestation.
 *
 * @remarks
 * The attestation is timestamped and short-lived, and it is signed *inside* the
 * quote calldata — fetch it immediately before signing, never ahead of time.
 * Solvers that enforce Muon verification (Rasa / majors) require a live
 * attestation here; the lowcap InstantLayer flow instead signs a placeholder and
 * delegates the byte range to the solver, so it does not call this.
 *
 * For the raw, un-assembled attestation (all returned fields), use
 * `getMuonUpnlAWithSymbolPrice` instead.
 *
 * @param config - The SDK config.
 * @param parameters - PartyA address, market symbol id, and optional chain id.
 * @returns The assembled `SingleUpnlAndPriceSig`.
 * @throws {SymmError} when the chain is unsupported, no Muon URLs are configured,
 *   or every oracle returns an unsuccessful or malformed attestation.
 *
 * @example
 * ```ts
 * const upnlSig = await getSendQuoteUpnlSig(config, {
 *   partyA: subAccountAddress,
 *   symbolId: 1n,
 * });
 * ```
 */
export async function getSendQuoteUpnlSig(
  config: Config,
  parameters: GetSendQuoteUpnlSigParameters,
): Promise<GetSendQuoteUpnlSigReturnType> {
  const { chainId, addresses, muon } = config.getChainConfig(parameters.chainId);
  const raw = await fetchMuon(muon.urls, MUON_METHOD_UPNL_A_WITH_SYMBOL_PRICE, {
    partyA: parameters.partyA,
    chainId: chainId.toString(),
    symmio: addresses.symmioAddress,
    symbolId: parameters.symbolId.toString(),
  });
  return toSingleUpnlAndPriceSig(raw);
}

/**
 * Map a raw Muon `uPnl_A_withSymbolPrice` result onto the on-chain
 * {@link SingleUpnlAndPriceSig} tuple.
 *
 * `price` falls back to `0n` when the gateway omits it — the contract reads the
 * field unconditionally, and the reference implementation defaults it the same
 * way rather than failing the trade.
 *
 * @internal
 */
function toSingleUpnlAndPriceSig(result: MuonRawResult): SingleUpnlAndPriceSig {
  return {
    ...toContractSigEnvelope(result),
    upnl: requireMuonBigInt(result.data.result.uPnl, "uPnl"),
    price: muonBigInt(result.data.result.price) ?? 0n,
  };
}
