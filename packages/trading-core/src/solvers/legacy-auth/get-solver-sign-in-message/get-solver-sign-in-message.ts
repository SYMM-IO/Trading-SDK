import axios, { isAxiosError } from "axios";
import { createSiweMessage } from "viem/siwe";
import type { Config } from "../../../core/config";
import { SymmApiError, SymmError } from "../../../shared/errors/symm-error";
import { assertSolverKind } from "../../assert-solver-kind";
import type { GetSolverSignInMessageParameters, SolverSignInChallenge } from "../types";

/**
 * Fetch an owner's nonce and build the legacy solver SIWE message.
 * @param config - Selected deployment.
 * @param parameters - Owner, subaccount, origin, chain and explicit lifetime.
 * @returns Unsigned message and exchange fields. No wallet or storage access.
 */
export async function getSolverSignInMessage(
  config: Config,
  parameters: GetSolverSignInMessageParameters,
): Promise<SolverSignInChallenge> {
  const solver = config.getSolver(parameters);
  assertSolverKind(solver, "enigma", "getSolverSignInMessage");
  let nonce: unknown;
  try {
    const response = await axios.get<{ nonce?: unknown }>(`/nonce/${encodeURIComponent(parameters.owner)}`, {
      baseURL: solver.url,
      signal: parameters.signal,
    });
    nonce = response.data.nonce;
  } catch (error) {
    if (isAxiosError(error)) throw SymmApiError.fromAxios(error, { code: "SOLVER_NONCE_FAILED", baseURL: solver.url });
    throw error;
  }
  if (typeof nonce !== "string" || nonce.length === 0)
    throw new SymmError("api", "INVALID_SOLVER_NONCE", "Solver returned no nonce.");
  const { owner, account, issuedAt, expirationTime } = parameters;
  const message = createSiweMessage({
    address: owner,
    chainId: parameters.chainId,
    domain: parameters.domain,
    statement: `msg: ${account}`,
    uri: `${solver.url.replace(/\/$/, "")}/login`,
    nonce,
    version: "1",
    issuedAt: new Date(issuedAt),
    expirationTime: new Date(expirationTime),
  });
  return { message, owner, nonce, issuedAt, expirationTime };
}
