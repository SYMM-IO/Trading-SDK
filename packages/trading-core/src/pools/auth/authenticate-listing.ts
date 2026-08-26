import { isAxiosError } from "axios";
import type { Config } from "../../core/config";
import { SymmApiError, SymmError } from "../../shared/errors/symm-error";
import type { Compute, WriteSolverParameter } from "../../shared/types/properties";
import { resolveListingService } from "../resolve-listing";
import { loginV2AuthLoginPost } from "../types/generated/listing-backend";
import { getListingSignInMessage } from "./get-sign-in-message";
import { toCustomSiweMessage, toListingAuthToken } from "./to-siwe";
import type { ListingAuthToken } from "./types";

/**
 * Parameters for {@link authenticateListing}.
 *
 * The signing address is taken from the resolved wallet account, so it is not a
 * parameter.
 */
export type AuthenticateListingParameters = Compute<
  WriteSolverParameter & {
    /** RFC 4501 DNS authority requesting the sign-in. */
    domain: string;
    /** RFC 3986 URI of the dApp. */
    uri: string;
    /** Optional human-readable statement to embed in the message. */
    statement?: string;
  }
>;

/** Return type of {@link authenticateListing}: the issued bearer token. */
export type AuthenticateListingReturnType = ListingAuthToken;

/**
 * Authenticate against the listing backend with the full SIWE (EIP-4361) flow:
 * fetch the sign-in challenge, sign it with the connected wallet, and exchange
 * the signature for a bearer token.
 *
 * The signing address comes from the resolved wallet account. Wallet or viem
 * rejection errors from signing pass through unwrapped.
 *
 * Enigma-only: the listing backend is an Enigma capability.
 *
 * @param config - The SDK config.
 * @param parameters - Domain, uri, and optional statement.
 * @returns The issued bearer token.
 * @throws {SymmApiError} when the sign-in or login request fails.
 * @throws {SymmError} `LISTING_UNSUPPORTED` when the resolved solver does not use
 *   the listing service, or `LISTING_NOT_CONFIGURED` when the chain has no
 *   listing backend.
 *
 * @example
 * ```ts
 * const token = await authenticateListing(config, {
 *   domain: "app.example.com",
 *   uri: "https://app.example.com",
 * });
 * // Authorization: `Bearer ${token.accessToken}`
 * ```
 */
export async function authenticateListing(
  config: Config,
  parameters: AuthenticateListingParameters,
): Promise<AuthenticateListingReturnType> {
  const { url } = resolveListingService(config, {
    chainId: parameters.chainId,
    solverId: parameters.solverId,
  });

  const walletClient = await config.getWalletClient({ chainId: parameters.chainId, from: parameters.from });
  const address = walletClient.account.address;

  const signIn = await getListingSignInMessage(config, {
    chainId: parameters.chainId,
    solverId: parameters.solverId,
    address,
    domain: parameters.domain,
    uri: parameters.uri,
    statement: parameters.statement,
  });

  const signature = await walletClient.signMessage({
    account: walletClient.account,
    message: signIn.message,
  });

  try {
    const response = await loginV2AuthLoginPost(
      { message: toCustomSiweMessage(signIn.params), signature },
      { baseURL: url },
    );

    return toListingAuthToken(response.data);
  } catch (err) {
    if (err instanceof SymmError) throw err;

    if (isAxiosError(err)) {
      throw SymmApiError.fromAxios(err, { code: "LISTING_LOGIN_FAILED", baseURL: url });
    }

    throw new SymmError(
      "api",
      "LISTING_LOGIN_FAILED",
      `Failed to log in to the listing service: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err instanceof Error ? err : undefined },
    );
  }
}
