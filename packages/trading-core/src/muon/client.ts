import axios, { isAxiosError } from "axios";
import type { Hex } from "viem";
import { SymmApiError, SymmError } from "../shared/errors/symm-error";
import type { SchnorrSign } from "../symmio-contracts/account-layer/types";
import { MUON_APP, type MuonAttestationBase, type MuonRawResult, type MuonResponse } from "./types";

/**
 * Plain (un-prefixed) Muon request fields. {@link fetchMuon} wraps each entry
 * into the gateway's `params[<key>]` query-string form and adds `app` + `method`.
 */
export type MuonRequestFields = Record<string, string>;

/**
 * GET a Muon `symmio` attestation for `method`, trying each configured gateway
 * URL in order until one returns a successful response. Returns the raw `result`
 * payload; callers normalize it into a typed, method-specific shape.
 *
 * @param urls - The chain's configured Muon oracle gateway base URLs.
 * @param method - The Muon app method (e.g. `"uPnl_A"`).
 * @param fields - Method params as plain key/value pairs (e.g. `{ partyA, chainId, symmio }`);
 *   each becomes a `params[<key>]` query parameter.
 * @returns The raw Muon `result` object.
 * @throws {SymmError} when no URLs are configured, or every gateway returns an
 *   unsuccessful or failed response.
 * @internal
 */
export async function fetchMuon(
  urls: readonly string[],
  method: string,
  fields: MuonRequestFields,
): Promise<MuonRawResult> {
  if (urls.length === 0) {
    throw new SymmError("config", "MUON_URLS_NOT_CONFIGURED", "No Muon oracle URLs are configured for this chain.");
  }

  const params: Record<string, string> = { app: MUON_APP, method };
  for (const [key, value] of Object.entries(fields)) {
    params[`params[${key}]`] = value;
  }

  let lastError: unknown;

  for (const baseURL of urls) {
    try {
      const response = await axios.get<MuonResponse>("", { baseURL, params });

      if (!response.data.success) {
        lastError = new SymmError(
          "api",
          "MUON_REQUEST_UNSUCCESSFUL",
          `Muon returned an unsuccessful "${method}" response from ${baseURL}.`,
        );
        continue;
      }

      return response.data.result;
    } catch (err) {
      if (err instanceof SymmError) {
        lastError = err;
        continue;
      }
      if (isAxiosError(err)) {
        lastError = SymmApiError.fromAxios(err, { code: "FETCH_MUON_REQUEST_FAILED", baseURL });
        continue;
      }
      lastError = err;
    }
  }

  if (lastError instanceof SymmError) throw lastError;

  throw new SymmError(
    "api",
    "FETCH_MUON_REQUEST_FAILED",
    `Failed to fetch the Muon "${method}" response from all oracle URLs: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
    { cause: lastError instanceof Error ? lastError : undefined },
  );
}

/**
 * Pull the replay-protection + signature envelope every Muon attestation carries
 * into a typed {@link MuonAttestationBase}. Method-specific normalizers spread
 * this and add their own result fields.
 *
 * @throws {SymmError} when the Schnorr signature share is missing.
 * @internal
 */
export function toMuonAttestationBase(raw: MuonRawResult): MuonAttestationBase {
  const share = raw.signatures[0];
  if (!share) {
    throw new SymmError("api", "MUON_SIG_MALFORMED", "Muon attestation is missing its Schnorr signature share.");
  }
  return {
    reqId: raw.reqId,
    timestamp: BigInt(raw.data.timestamp),
    nonce: raw.data.init.nonceAddress,
    owner: share.owner,
    signature: BigInt(share.signature),
    gatewaySignature: raw.nodeSignature,
  };
}

/**
 * The replay-protection + signature fields every **contract-ready** Muon sig
 * struct shares (`SingleUpnlSig`, `SingleUpnlAndPriceSig`, `HighLowPriceSig`).
 * @internal
 */
export interface MuonContractSigEnvelope {
  /** Muon request id (opaque bytes). */
  reqId: Hex;
  /** Attestation timestamp (seconds). */
  timestamp: bigint;
  /** Muon gateway signature over the request (opaque bytes). */
  gatewaySignature: Hex;
  /** The Schnorr TSS signature pieces. */
  sigs: SchnorrSign;
}

/**
 * Pull the envelope every contract-ready Muon sig struct shares out of a raw
 * attestation. Assemblers spread this and add their method-specific fields.
 *
 * Differs from {@link toMuonAttestationBase}, which produces the *raw-read*
 * shape (flat `owner` / `signature` / `nonce`); this one nests them into the
 * on-chain `SchnorrSign` tuple.
 *
 * @throws {SymmError} when the Schnorr signature share is missing.
 * @internal
 */
export function toContractSigEnvelope(raw: MuonRawResult): MuonContractSigEnvelope {
  const share = raw.signatures[0];
  if (!share) {
    throw new SymmError("api", "MUON_SIG_MALFORMED", "Muon attestation is missing its Schnorr signature share.");
  }
  return {
    reqId: raw.reqId,
    gatewaySignature: raw.nodeSignature,
    timestamp: BigInt(raw.data.timestamp),
    sigs: {
      owner: share.owner,
      nonce: raw.data.init.nonceAddress,
      signature: BigInt(share.signature),
    },
  };
}

/**
 * Parse a Muon numeric string/number field to `bigint`, or `undefined` when the
 * field is absent or unparseable. Use for best-effort result fields whose exact
 * presence/nesting is unverified.
 * @internal
 */
export function muonBigInt(value: unknown): bigint | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  try {
    return BigInt(value as string | number);
  } catch {
    return undefined;
  }
}

/**
 * Require a Muon numeric field, parsing it to `bigint`.
 * @throws {SymmError} when the field is missing or unparseable.
 * @internal
 */
export function requireMuonBigInt(value: unknown, field: string): bigint {
  const parsed = muonBigInt(value);
  if (parsed === undefined) {
    throw new SymmError("api", "MUON_FIELD_MALFORMED", `Muon attestation is missing the "${field}" field.`);
  }
  return parsed;
}

/**
 * Parse a Muon array field to `bigint[]`; `[]` when absent. Non-parseable
 * elements are dropped.
 * @internal
 */
export function muonBigIntArray(value: unknown): bigint[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const parsed = muonBigInt(item);
    return parsed === undefined ? [] : [parsed];
  });
}

/**
 * Encode an array request param for a Muon GET. The gateway validates each array
 * param as a single string and JSON-parses it server-side, so the array is sent
 * as a JSON-array string, e.g. `[10,11]`. Verified against the live gateway for
 * `price` / `settle_upnl` (sending a bracketed/repeated array fails validation
 * with `"quoteIds" must be a string`).
 * @internal
 */
export function toMuonArrayParam(values: readonly bigint[]): string {
  return `[${values.map(String).join(",")}]`;
}
