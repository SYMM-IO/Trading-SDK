import type { Address } from "viem";
import type { ReadSolverParameter } from "../../shared/types/properties";

/** Inputs for a legacy solver SIWE challenge. The consumer owns session lifetime. */
export type GetSolverSignInMessageParameters = ReadSolverParameter & {
  /** Chain included in the signed message. */ chainId: number;
  /** Signing owner, used for the nonce endpoint. */ owner: Address;
  /** Subaccount named in the signed statement. */ account: Address;
  /** Consumer origin hostname. */ domain: string;
  /** ISO issuance time selected by the consumer. */ issuedAt: string;
  /** ISO expiry selected by the consumer. */ expirationTime: string;
  /** Optional request cancellation. */ signal?: AbortSignal;
};
/** Unsigned legacy challenge. Never persisted or signed by core. */
export interface SolverSignInChallenge {
  /** Complete EIP-4361 message to sign. */ message: string;
  /** Owner of the nonce. */ owner: Address;
  /** Solver-issued nonce. */ nonce: string;
  /** ISO issuance time. */ issuedAt: string;
  /** ISO expiry. */ expirationTime: string;
}
/** Exchange a user-signed challenge without changing consumer session storage. */
export type AuthenticateSolverParameters = ReadSolverParameter & {
  /** Challenge returned by getSolverSignInMessage. */ challenge: SolverSignInChallenge;
  /** Signature of challenge.message. */ signature: string;
  /** Optional vendor signature type, e.g. ERC4337. */ signType?: string;
  /** Optional request cancellation. */ signal?: AbortSignal;
};
/** Legacy bearer credential. Consumers own secure storage and expiry. */
export interface SolverAuthentication {
  /** Opaque bearer credential. */ accessToken: string;
}
