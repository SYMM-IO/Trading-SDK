import { isAxiosError } from "axios";
import type { Address } from "viem";
import type { Config } from "../../core/config";
import { SymmApiError, SymmError } from "../../shared/errors/symm-error";
import type { Compute, ReadSolverParameter } from "../../shared/types/properties";
import { resolveListingService } from "../resolve-listing";
import { getSignInMessageV2AuthSignInMessageGet } from "../types/generated/listing-backend";
import { toListingSignInMessage } from "./to-siwe";
import type { ListingSignInMessage } from "./types";

/** Parameters for {@link getListingSignInMessage}. */
export type GetListingSignInMessageParameters = Compute<
  ReadSolverParameter & {
    /** Address that will sign the message (EIP-55 checksum). */
    address: Address;
    /** RFC 4501 DNS authority requesting the sign-in. */
    domain: string;
    /** RFC 3986 URI of the dApp. */
    uri: string;
    /** Optional human-readable statement to embed in the message. */
    statement?: string;
  }
>;

/** Return type of {@link getListingSignInMessage}: the SIWE challenge to sign. */
export type GetListingSignInMessageReturnType = ListingSignInMessage;

/**
 * Fetch the listing backend's SIWE (EIP-4361) sign-in challenge — step 1 of the
 * listing authentication flow.
 *
 * The returned {@link ListingSignInMessage.message} is the exact string to hand
 * to the wallet for signing; {@link authenticateListing} runs the full flow
 * (fetch → sign → login) and is what most callers want.
 *
 * Enigma-only: the listing backend is an Enigma capability.
 *
 * @param config - The SDK config.
 * @param parameters - Address, domain, uri, and optional statement.
 * @returns The SIWE challenge to sign.
 * @throws {SymmApiError} when the backend request fails.
 * @throws {SymmError} `LISTING_UNSUPPORTED` when the resolved solver does not use
 *   the listing service, or `LISTING_NOT_CONFIGURED` when the chain has no
 *   listing backend.
 *
 * @example
 * ```ts
 * const signIn = await getListingSignInMessage(config, {
 *   address,
 *   domain: "app.example.com",
 *   uri: "https://app.example.com",
 * });
 * ```
 */
export async function getListingSignInMessage(
  config: Config,
  parameters: GetListingSignInMessageParameters,
): Promise<GetListingSignInMessageReturnType> {
  const { url } = resolveListingService(config, {
    chainId: parameters.chainId,
    solverId: parameters.solverId,
  });

  try {
    const response = await getSignInMessageV2AuthSignInMessageGet(
      {
        address: parameters.address,
        domain: parameters.domain,
        uri: parameters.uri,
        statement: parameters.statement,
      },
      { baseURL: url },
    );

    return toListingSignInMessage(response.data);
  } catch (err) {
    if (err instanceof SymmError) throw err;

    if (isAxiosError(err)) {
      throw SymmApiError.fromAxios(err, { code: "FETCH_LISTING_SIGN_IN_MESSAGE_FAILED", baseURL: url });
    }

    throw new SymmError(
      "api",
      "FETCH_LISTING_SIGN_IN_MESSAGE_FAILED",
      `Failed to fetch listing sign-in message: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err instanceof Error ? err : undefined },
    );
  }
}
