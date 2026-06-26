import type { Address } from "viem";
import type { Config } from "../../core/config";
import { SymmError } from "../../shared/errors/symm-error";
import type { ChainIdParameter, Compute } from "../../shared/types/properties";
import type { SingleUpnlSig } from "../../symmio-contracts/account-layer/types";
import { fetchMuon } from "../client";
import { MUON_METHOD_UPNL_A, type MuonRawResult } from "../types";

/**
 * Parameters for {@link getDeallocateUpnlSig}.
 */
export type GetDeallocateUpnlSigParameters = Compute<
  ChainIdParameter & {
    /** The virtual account (Muon `partyA`) the uPnL attestation is for. */
    virtualAccount: Address;
  }
>;

/** Return type of {@link getDeallocateUpnlSig}: a contract-ready uPnL signature. */
export type GetDeallocateUpnlSigReturnType = SingleUpnlSig;

/**
 * Fetch a fresh Muon uPnL (`uPnl_A`) attestation for a virtual account, assembled
 * into the contract-ready {@link SingleUpnlSig} that {@link removeMargin} requires.
 *
 * The Muon oracle URLs and the SYMMIO diamond address (the `symmio` request
 * param) are resolved from `config` per call. The configured gateways are tried
 * in order until one returns a successful attestation.
 *
 * @remarks
 * The attestation is timestamped and short-lived — fetch it immediately before
 * submitting `removeMargin`, not ahead of time. The `@theoldvarorg/react`
 * `useRemoveMargin` hook does this for you. For the raw, un-assembled attestation
 * (all returned fields), use `getMuonUpnlA` instead.
 *
 * @param config - The SDK config.
 * @param parameters - Virtual account address and optional chain id.
 * @returns The assembled `SingleUpnlSig`.
 * @throws {SymmError} when the chain is unsupported, no Muon URLs are configured,
 *   or every oracle returns an unsuccessful or malformed attestation.
 *
 * @example
 * ```ts
 * const upnlSig = await getDeallocateUpnlSig(config, { virtualAccount: "0xva…" });
 * await removeMargin(config, { virtualAccount: "0xva…", amount: 50_000000000000000000n, upnlSig });
 * ```
 */
export async function getDeallocateUpnlSig(
  config: Config,
  parameters: GetDeallocateUpnlSigParameters,
): Promise<GetDeallocateUpnlSigReturnType> {
  const { chainId, addresses, muon } = config.getChainConfig(parameters.chainId);
  const raw = await fetchMuon(muon.urls, MUON_METHOD_UPNL_A, {
    partyA: parameters.virtualAccount,
    chainId: chainId.toString(),
    symmio: addresses.symmioAddress,
  });
  return toSingleUpnlSig(raw);
}

/**
 * Map a raw Muon `uPnl_A` result onto the on-chain {@link SingleUpnlSig} tuple,
 * converting numeric strings to `bigint` and pulling the nonce from
 * `data.init.nonceAddress`.
 *
 * @internal
 */
function toSingleUpnlSig(result: MuonRawResult): SingleUpnlSig {
  const sig = result.signatures[0];

  if (!sig) {
    throw new SymmError(
      "api",
      "MUON_UPNL_SIG_MALFORMED",
      "Muon uPnL attestation is missing its Schnorr signature share.",
    );
  }

  return {
    reqId: result.reqId,
    timestamp: BigInt(result.data.timestamp),
    upnl: BigInt(result.data.result.uPnl as string),
    gatewaySignature: result.nodeSignature,
    sigs: {
      signature: BigInt(sig.signature),
      owner: sig.owner,
      nonce: result.data.init.nonceAddress,
    },
  };
}
