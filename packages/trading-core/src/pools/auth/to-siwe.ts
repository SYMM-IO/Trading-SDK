import type { CustomSiweMessage, SignInMessageResponseSchema, Token } from "../types/generated/listing-backend";
import type { ListingAuthToken, ListingSignInMessage, ListingSiweParams } from "./types";

/**
 * Normalize the backend's raw sign-in challenge into the SDK's
 * {@link ListingSignInMessage}.
 *
 * @param raw - The generated `SignInMessageResponseSchema` from the backend.
 * @returns The normalized sign-in message.
 */
export function toListingSignInMessage(raw: SignInMessageResponseSchema): ListingSignInMessage {
  return {
    message: raw.message,
    params: {
      domain: raw.params.domain,
      address: raw.params.address,
      uri: raw.params.uri,
      version: raw.params.version,
      chainId: raw.params.chainId,
      issuedAt: raw.params.issuedAt,
      nonce: raw.params.nonce,
      statement: raw.params.statement,
    },
  };
}

/**
 * Rebuild the backend's `CustomSiweMessage` login payload from the normalized
 * SIWE params, so the login request echoes back the exact message the backend
 * minted.
 *
 * @param params - The normalized SIWE params from a sign-in challenge.
 * @returns The generated `CustomSiweMessage` to send in the login request.
 */
export function toCustomSiweMessage(params: ListingSiweParams): CustomSiweMessage {
  return {
    domain: params.domain,
    address: params.address,
    uri: params.uri,
    version: params.version,
    chainId: params.chainId,
    issuedAt: params.issuedAt,
    nonce: params.nonce,
    statement: params.statement,
  };
}

/**
 * Normalize the backend's raw `Token` into the SDK's {@link ListingAuthToken}.
 *
 * @param raw - The generated `Token` from a successful login.
 * @returns The normalized bearer token.
 */
export function toListingAuthToken(raw: Token): ListingAuthToken {
  return {
    accessToken: raw.accessToken,
    tokenType: raw.tokenType,
  };
}
