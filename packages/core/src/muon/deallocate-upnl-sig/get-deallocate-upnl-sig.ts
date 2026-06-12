import axios, { isAxiosError } from "axios";
import type { Address } from "viem";
import type { Config } from "../../core/config";
import { SymmApiError, SymmError } from "../../shared/errors/symm-error";
import type { ChainIdParameter, Compute } from "../../shared/types/properties";
import type { SingleUpnlSig } from "../../symmio-contracts/account-layer/types";
import { MUON_APP, MUON_METHOD_UPNL, type MuonUpnlResponse, type MuonUpnlResult } from "../types";

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
 * submitting `removeMargin`, not ahead of time. The `@symm-frontier/react`
 * `useRemoveMargin` hook does this for you.
 *
 * @param config - The SDK config.
 * @param parameters - Virtual account address and optional chain id.
 * @returns The assembled `SingleUpnlSig`.
 * @throws {SymmApiError} when every oracle request fails.
 * @throws {SymmError} when the chain is unsupported, every oracle returns an
 *   unsuccessful or malformed attestation, or no Muon URLs are configured.
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
  return fetchDeallocateUpnlSig(muon.urls, parameters.virtualAccount, chainId, addresses.symmioAddress);
}

/**
 * GET the Muon `uPnl_A` attestation, trying each gateway URL in order until one
 * succeeds, then assemble the contract tuple.
 *
 * @internal
 */
async function fetchDeallocateUpnlSig(
  urls: readonly string[],
  virtualAccount: Address,
  chainId: number,
  symmio: Address,
): Promise<SingleUpnlSig> {
  if (urls.length === 0) {
    throw new SymmError("config", "MUON_URLS_NOT_CONFIGURED", "No Muon oracle URLs are configured for this chain.");
  }

  const params = {
    app: MUON_APP,
    method: MUON_METHOD_UPNL,
    "params[partyA]": virtualAccount,
    "params[chainId]": chainId.toString(),
    "params[symmio]": symmio,
  };

  let lastError: unknown;

  for (const baseURL of urls) {
    try {
      const response = await axios.get<MuonUpnlResponse>("", { baseURL, params });

      if (!response.data.success) {
        lastError = new SymmError(
          "api",
          "MUON_UPNL_SIG_UNSUCCESSFUL",
          `Muon returned an unsuccessful uPnL attestation from ${baseURL}.`,
        );
        continue;
      }

      return toSingleUpnlSig(response.data.result);
    } catch (err) {
      if (err instanceof SymmError) {
        lastError = err;
        continue;
      }
      if (isAxiosError(err)) {
        lastError = SymmApiError.fromAxios(err, { code: "FETCH_DEALLOCATE_UPNL_SIG_FAILED", baseURL });
        continue;
      }
      lastError = err;
    }
  }

  if (lastError instanceof SymmError) throw lastError;

  throw new SymmError(
    "api",
    "FETCH_DEALLOCATE_UPNL_SIG_FAILED",
    `Failed to fetch the Muon uPnL signature from all oracle URLs: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
    { cause: lastError instanceof Error ? lastError : undefined },
  );
}

/**
 * Map a raw Muon `uPnl_A` result onto the on-chain {@link SingleUpnlSig} tuple,
 * converting numeric strings to `bigint` and pulling the nonce from
 * `data.init.nonceAddress`.
 *
 * @internal
 */
function toSingleUpnlSig(result: MuonUpnlResult): SingleUpnlSig {
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
    upnl: BigInt(result.data.result.uPnl),
    gatewaySignature: result.nodeSignature,
    sigs: {
      signature: BigInt(sig.signature),
      owner: sig.owner,
      nonce: result.data.init.nonceAddress,
    },
  };
}
