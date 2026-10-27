import type { GetListingSignInMessageParameters } from "./get-sign-in-message";
import type { ListingSignInMessage } from "./types";

/** Select cached challenges only for their original signing context. The server validates signatures and nonces. */
export function canReuseListingChallenge(
  challenge: ListingSignInMessage,
  request: GetListingSignInMessageParameters,
): boolean {
  const fields = challenge.params;
  return (
    fields.address.toLowerCase() === request.address.toLowerCase() &&
    fields.domain === request.domain &&
    fields.uri === request.uri &&
    (fields.statement ?? "") === (request.statement ?? "") &&
    (request.chainId == null || fields.chainId === request.chainId) &&
    (fields.expirationTime == null || Date.parse(fields.expirationTime) > Date.now())
  );
}
