/**
 * A bearer token issued by the listing backend after a successful SIWE login.
 *
 * Present it as an `Authorization: Bearer <accessToken>` header on subsequent
 * authenticated Pools requests.
 */
export interface ListingAuthToken {
  /** The bearer token to send in the `Authorization` header. */
  accessToken: string;
  /** The token scheme, e.g. `"bearer"`. */
  tokenType: string;
}

/**
 * The structured SIWE (EIP-4361) fields the listing backend issued for a
 * sign-in. These are echoed back — unchanged — inside the login request so the
 * backend can verify the signature against the exact message it minted.
 */
export interface ListingSiweParams {
  /** RFC 4501 DNS authority that requested the signing. */
  domain: string;
  /** Address performing the signing (EIP-55 checksum). */
  address: string;
  /** RFC 3986 URI of the resource that is the subject of the signing. */
  uri: string;
  /** EIP-4361 message version. */
  version: string;
  /** EIP-155 chain id the session is bound to. */
  chainId: number;
  /** ISO 8601 datetime the message was issued at. */
  issuedAt: string;
  /** Randomized token that prevents replay of the message. */
  nonce: string;
  /** Human-readable assertion the user signs. */
  statement: string;
}

/**
 * The listing backend's sign-in challenge: the full message to sign plus the
 * structured fields it was built from.
 */
export interface ListingSignInMessage {
  /** The full EIP-4361 message string to hand to the wallet for signing. */
  message: string;
  /** The structured fields the {@link ListingSignInMessage.message} was built from. */
  params: ListingSiweParams;
}
